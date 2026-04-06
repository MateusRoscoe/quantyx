# OVERWATCH - User & Group Identification System

Review of the plan and its implementation. Issues are categorized by severity.

---

## CRITICAL

### 1. WHERE placement in `mv_metrics_all` is after ARRAY JOIN (performance)

**File:** `infrastructure/clickhouse/init/01_create_tables.sql`

The `WHERE event_name NOT LIKE '$%'` clause was placed AFTER the ARRAY JOIN:

```sql
FROM analytics.events
ARRAY JOIN
    arrayFilter(x -> x.2 != '', [...]) AS dim
WHERE event_name NOT LIKE '$%'        -- <-- after ARRAY JOIN
GROUP BY project_id, hour, dim.1, dim.2;
```

This is valid ClickHouse syntax, but suboptimal. System events go through the expensive ARRAY JOIN (expanding 10 dimensions per event) before being filtered out. The WHERE should be BEFORE the ARRAY JOIN:

```sql
FROM analytics.events
WHERE event_name NOT LIKE '$%'        -- <-- before ARRAY JOIN
ARRAY JOIN
    arrayFilter(x -> x.2 != '', [...]) AS dim
GROUP BY project_id, hour, dim.1, dim.2;
```

**Impact:** Performance regression on MV insert speed. Every system event does 10x work before being discarded.

### 2. Server events use generated session_id instead of empty string (creates phantom sessions)

**Files:** `apps/api-server-ingest/src/app/routes/identify.ts:23`, `apps/api-server-ingest/src/app/routes/groups.ts:40,74`

The plan says server events should have "empty session_id". But the implementation generates real UUIDs:

```ts
// identify.ts
const event = {
  session_id: generateUUIDv7(),  // BUG: should be ''
  ...
};

// groups.ts (both routes)
session_id: generateUUIDv7(),    // BUG: should be ''
```

Since `mv_sessions` filters `WHERE session_id != ''`, every server API call creates a phantom single-event "session" in the sessions table. A single `POST /users/identify` call would create a ghost session with 1 event, polluting session analytics.

**Fix:** Use `session_id: ''` for all server-generated events.

### 3. Double-reply bug in `groups.ts` sendEvent helper

**File:** `apps/api-server-ingest/src/app/routes/groups.ts:12-24,54-56`

The `sendEvent` helper catches `BackpressureError` and calls `reply.serviceUnavailable()`, but doesn't prevent the handler from continuing:

```ts
function sendEvent(reply, event) {
  try { sendMessage(...); }
  catch (err) {
    if (err instanceof BackpressureError) {
      return reply.serviceUnavailable(err.message);  // sends 503
    }
    throw err;
  }
}

// In handler:
sendEvent(reply, event);
return reply.status(202).send({ status: 'accepted' });  // sends 202 too!
```

If BackpressureError occurs, Fastify receives two replies (503 then 202). In Fastify 5 this throws `FST_ERR_REP_ALREADY_SENT`.

Compare with `identify.ts` which uses inline try/catch with `return`, correctly preventing the 202 reply.

**Fix:** Either make `sendEvent` throw instead of replying, or check its return value.

---

## MODERATE

### 2. Session MVs still count system events in `total_events`

**File:** `infrastructure/clickhouse/init/01_create_tables.sql`

The plan says `mv_sessions`/`mv_sessions_daily` are "Already safe (no changes)". But these MVs count ALL events toward `total_events`:

```sql
-- mv_sessions
sumState(toUInt64(1)) AS total_events,   -- counts $identify, $group_assign, etc.

-- mv_sessions_daily
toUInt64(count()) AS total_events,       -- same issue
```

Meanwhile, `mv_users` explicitly excludes system events:
```sql
toUInt64(countIf(event_name NOT LIKE '$%')) AS total_events
```

**Impact:** Inconsistency. A user's total events (from users table) won't match the sum of their session events. For example: user has 10 track events + 1 $identify event. Users table shows `total_events = 10`, but the session shows `total_events = 11`.

**Fix:** Add `countIf(event_name NOT LIKE '$%')` to session MVs, or explicitly document this as intentional.

### 4. `$group_assign` without prior `$group_identify` creates orphaned memberships

**Tables:** `user_groups`, `groups`

If the SDK calls `group("company", "acme")` for an anonymous user (no identify called yet), ONLY `$group_identify` is emitted (no `$group_assign` since no userId). Later when `identify()` is called, there's no automatic group re-assignment.

Conversely, if the server API calls `POST /groups/assign` before any `$group_identify`, the `user_groups` table has an entry but `groups` table doesn't. BFF routes like `GET /groups/:groupType/:groupId` would return 404 for a group that has members.

**Fix:** BFF group routes should handle missing group entries gracefully (e.g., return group with just membership count, no properties). Or document that `$group_identify` must be called before `$group_assign`.

### 5. Last-write-wins semantics for identify/group traits may surprise SDK users

**File:** `infrastructure/clickhouse/init/01_create_tables.sql` (mv_users, mv_groups)

The `argMaxState` approach replaces the ENTIRE property map with the latest event's properties. Example:

```js
// First call - sets plan
client.identify("user-1", { props_str: { plan: "pro" } });
// Second call - only sets email, "plan" is LOST
client.identify("user-1", { props_str: { email: "u@x.com" } });
// Result: user.props_str = { email: "u@x.com" }  (plan is gone)
```

This is how `argMax` works (full replacement, not merge), but it's a common gotcha. Same applies to `group()` traits.

**Impact:** SDK users must always send ALL properties on every identify/group call, not just the changed ones.

**Recommendation:** Document this clearly in the SDK. Consider whether a `mapMerge` pattern would be more user-friendly (though more complex in ClickHouse).

### 6. `$group_identify` always emitted even without traits

**File:** `libs/react-sdk/src/client.ts`

```ts
group(groupType: string, groupId: string, traits?: GroupTraits): void {
    // Always emits $group_identify, even when traits is undefined
    this.track('$group_identify', {
      props_str: groupProps,  // only has $group_type/$group_id
      props_num: traits?.props_num,   // undefined
      props_bool: traits?.props_bool, // undefined
    });
```

When the caller only wants to assign a user to a group (no traits), this generates an unnecessary `$group_identify` event that flows through the entire pipeline just to set empty properties.

**Impact:** Extra event volume. If a user only wants `$group_assign`, they get both events.

**Suggestion:** Only emit `$group_identify` when traits are provided (non-empty).

---

## LOW / VERIFY

### 7. `map()` type compatibility in conditional `argMaxState`

**File:** `infrastructure/clickhouse/init/01_create_tables.sql`

```sql
argMaxState(
    if(event_name = '$identify', props_str, map()),  -- map() returns Map(Nothing, Nothing)
    if(event_name = '$identify', timestamp, toDateTime(0))
)
```

ClickHouse's `map()` returns `Map(Nothing, Nothing)`. The `if()` function requires compatible types in both branches. `Map(String, String)` vs `Map(Nothing, Nothing)` should be auto-coerced (Nothing is subtype of all types), and this is a documented ClickHouse pattern. However, this should be verified by actually creating the MV.

**Action:** Test by running `docker compose down -v && docker compose up -d` and checking that MVs are created successfully.

### 8. Groups `first_seen`/`last_seen` only reflect identify events, not assignments

**File:** `infrastructure/clickhouse/init/01_create_tables.sql` (mv_groups)

The `mv_groups` MV only triggers on `$group_identify`/`$server_group_identify`. So `first_seen`/`last_seen` reflect when group properties were set, NOT when the group was first referenced via `$group_assign`.

If a group is only ever assigned (never identified with traits), it won't exist in the `groups` table at all, and `first_seen` will never be set.

**Impact:** Misleading timestamps if groups are assigned before being identified.

### 9. Unrelated docker-compose change (consumer replicas hardcoded)

**File:** `docker-compose.apps.yaml`

The consumer replicas changed from configurable `${CONSUMER_REPLICAS:-4}` to hardcoded `6`. This is NOT part of the plan and appears to be an accidental or debugging change.

### 10. BFF groups cursor uses colon delimiter (fragile if group_id contains colons)

**File:** `apps/api-analytics-bff/src/app/routes/groups.ts:44,75`

The cursor format is `group_type:group_id`, split with `splitByChar(':', cursor)`. If `group_id` contains a colon (e.g., `urn:company:acme`), the split breaks pagination.

**Impact:** Edge case. Low risk if group IDs are simple strings, but could cause pagination bugs with URN-style IDs.

---

## PLAN TEXT ISSUES (not implementation bugs)

The plan text had several corruption/truncation artifacts that the implementation correctly interpreted:

- `countIf(ent_name NOT LIKE '$%')` -> should be `event_name` (implementation is correct)
- `Agunction(argMax, ...)` -> should be `AggregateFunction(argMax, ...)`
- `pn system events` -> truncated
- `propr` -> should be `props`
- `compati` -> truncated `compatibility`
- `api-analsrc` -> truncated path
- `Vating init SQL` -> truncated

---

## VERIFIED CORRECT

These aspects of the implementation were reviewed and found to be correct:

- `EventMessage` now extends `EventMessageInputBase` (not refined) so $server* events pass through Kafka to the consumer
- `EventMessageInput` uses `superRefine` to reject `$server*` from webhook, require user_id for `$identify`/`$group_assign`, and require group identity keys for `$group_identify`/`$group_assign`
- Server-side schemas (`ServerIdentifyBody`, `ServerGroupIdentifyBody`, `ServerGroupAssignBody`) are correctly defined with proper constraints
- `SYSTEM_EVENTS` and `GROUP_IDENTITY_KEYS` constants are properly exported
- SDK `identify()` preserves session-reset-on-user-switch behavior, adds optional trait emission
- SDK `group()` correctly merges `$group_type`/`$group_id` into `props_str` alongside traits
- `mv_groups` correctly strips `$group_type`/`$group_id` from stored properties via `mapFilter`
- `mv_user_groups` correctly extracts group identity from props_str
- `mv_metrics_overall`, `mv_city_coordinates`, and `mv_metrics_geo` all have correct system event exclusion
- `mv_metrics_path` is already safe (filters `page_view`)
- React hooks (`useIdentify`, `useGroup`) correctly delegate to client methods
- New types (`UserTraits`, `GroupTraits`) and exports are properly wired up
- Uses native RdKafka producer pattern (matching api-event-webhook's `createNativeProducer`)

---

## IMPLEMENTATION STATUS (all phases complete)

| Phase | Status | Notes |
|-------|--------|-------|
| 1. ClickHouse Schema | Done | Tables, MVs, filters all implemented |
| 2. Shared Validators | Done | SYSTEM_EVENTS, superRefine, server schemas |
| 3. Webhook/Consumer | Done | No code changes needed (correct) |
| 4. React SDK | Done | identify(), group(), hooks, types |
| 5. api-server-ingest | Done | New app with identify/groups routes |
| 6. Analytics BFF | Done | User detail + 4 group routes |
| 7. Scheduler | Done | System event filter added |
