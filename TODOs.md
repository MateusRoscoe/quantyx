# TODO

## `apps/api-event-webhook`

- [ ] Add authentication to healthcheck route
  - Implement x-api-key validation as a simple protection layer
  - Prevent unnecessary Kafka connections
- [ ] Add tenant validation for event publishing
  - Verify tenant_id is registered in the system
  - Check tenant has sufficient quota before accepting events

## `apps/event-consumer`

- [ ] Create app to consume Kafka events
  - Set up consumer service in new app
  - Handle event processing and storage

## `apps/event-display`

- [ ] Create frontend app to display events
  - Build UI to visualize consumed events
  - Implement real-time updates
