// Seed script — generates realistic mock analytics events and sends them
// to the api-event-webhook /ingest-bulk endpoint using parallel goroutines.
//
// Usage:
//
//	go run ./scripts/seed-events --api-key <key> [options]
//
// Options:
//
//	--api-key        Required. The X-API-Key for the target project.
//	--endpoint       API base URL (default: http://localhost:3002)
//	--total          Total events to generate (default: 1_000_000_000)
//	--batch-size     Events per HTTP request (default: 5000)
//	--workers        Number of parallel goroutines (default: NumCPU * 2)
//	--concurrency    In-flight HTTP requests per worker (default: 10)
//	--days-back      Days of history to generate (default: 90)
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	mrand "math/rand/v2"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ── CLI flags ───────────────────────────────────────────────────────────────

var (
	apiKey      = flag.String("api-key", "", "X-API-Key (required)")
	endpoint    = flag.String("endpoint", "http://localhost:3002", "API base URL")
	total       = flag.Int64("total", 1_000_000_000, "Total events to generate")
	batchSize   = flag.Int("batch-size", 1000, "Events per HTTP request")
	workers     = flag.Int("workers", 0, "Parallel goroutines (default: NumCPU*2)")
	concurrency = flag.Int("concurrency", 10, "In-flight HTTP requests per worker")
	daysBack    = flag.Int("days-back", 90, "Days of history")
)

// ── UUIDv7 ──────────────────────────────────────────────────────────────────

var hexTable [256]string

func init() {
	for i := range 256 {
		hexTable[i] = fmt.Sprintf("%02x", i)
	}
}

func uuidv7(timestampMs int64) string {
	var buf [16]byte
	rand.Read(buf[:])

	buf[0] = byte(timestampMs >> 40)
	buf[1] = byte(timestampMs >> 32)
	buf[2] = byte(timestampMs >> 24)
	buf[3] = byte(timestampMs >> 16)
	buf[4] = byte(timestampMs >> 8)
	buf[5] = byte(timestampMs)
	buf[6] = 0x70 | (buf[6] & 0x0f) // version 7
	buf[8] = (buf[8] & 0x3f) | 0x80  // variant 10xx

	var sb strings.Builder
	sb.Grow(36)
	for i, b := range buf {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			sb.WriteByte('-')
		}
		sb.WriteString(hexTable[b])
	}
	return sb.String()
}

// Faster variant for event IDs where we can batch random bytes
func uuidv7Batch(timestampMs int64, randomBytes []byte) string {
	copy(randomBytes[0:6], []byte{
		byte(timestampMs >> 40), byte(timestampMs >> 32),
		byte(timestampMs >> 24), byte(timestampMs >> 16),
		byte(timestampMs >> 8), byte(timestampMs),
	})
	randomBytes[6] = 0x70 | (randomBytes[6] & 0x0f)
	randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80

	var dst [36]byte
	hex.Encode(dst[0:8], randomBytes[0:4])
	dst[8] = '-'
	hex.Encode(dst[9:13], randomBytes[4:6])
	dst[13] = '-'
	hex.Encode(dst[14:18], randomBytes[6:8])
	dst[18] = '-'
	hex.Encode(dst[19:23], randomBytes[8:10])
	dst[23] = '-'
	hex.Encode(dst[24:36], randomBytes[10:16])
	return string(dst[:])
}

// ── Data pools ──────────────────────────────────────────────────────────────

var eventNames = []string{
	"page_view", "page_view", "page_view", "page_view",
	"click", "click",
	"form_submit", "sign_up", "login",
	"add_to_cart", "purchase", "search",
	"scroll_depth", "video_play",
}

var pages = []string{
	"/", "/pricing", "/about", "/docs", "/docs/getting-started",
	"/docs/api-reference", "/docs/sdk", "/blog", "/blog/launch-announcement",
	"/blog/analytics-guide", "/dashboard", "/dashboard/settings",
	"/dashboard/events", "/signup", "/login", "/contact",
	"/features", "/integrations",
}

type deviceProfile struct {
	DeviceType     string
	Browser        string
	BrowserVersion string
	OS             string
	OSVersion      string
	Platform       string
}

type deviceTemplate struct {
	Weight     float64
	DeviceType string
	Browser    string
	OS         string
	Platform   string
}

var deviceTemplates = []deviceTemplate{
	{35, "desktop", "Chrome", "Windows", "web"},
	{10, "desktop", "Chrome", "macOS", "web"},
	{3, "desktop", "Chrome", "Linux", "web"},
	{17, "mobile", "Chrome", "Android", "android"},
	{7, "desktop", "Safari", "macOS", "web"},
	{11, "mobile", "Safari", "iOS", "ios"},
	{2, "tablet", "Safari", "iOS", "ios"},
	{5, "desktop", "Edge", "Windows", "web"},
	{1.5, "desktop", "Firefox", "Windows", "web"},
	{0.5, "desktop", "Firefox", "macOS", "web"},
	{1, "desktop", "Firefox", "Linux", "web"},
	{2.5, "mobile", "Samsung Internet", "Android", "android"},
	{2, "tablet", "Chrome", "Android", "android"},
}

var browserVersions = map[string][]string{
	"Chrome":           {"120.0", "121.0", "122.0", "123.0", "124.0", "125.0"},
	"Firefox":          {"121.0", "122.0", "123.0", "124.0"},
	"Safari":           {"17.2", "17.3", "17.4", "17.5"},
	"Edge":             {"120.0", "121.0", "122.0", "123.0"},
	"Samsung Internet": {"24.0", "25.0", "26.0"},
}

var osVersions = map[string][]string{
	"Windows": {"10", "11"},
	"macOS":   {"13.0", "14.0", "14.3", "14.5"},
	"Linux":   {"6.1", "6.5", "6.8"},
	"iOS":     {"17.0", "17.2", "17.4", "18.0"},
	"Android": {"13", "14", "15"},
}

type location struct {
	Code  string
	State string
	City  string
}

var countries = []location{
	{"USA", "California", "San Francisco"}, {"USA", "California", "Los Angeles"},
	{"USA", "New York", "New York"}, {"USA", "Texas", "Austin"},
	{"USA", "Washington", "Seattle"}, {"GBR", "England", "London"},
	{"GBR", "Scotland", "Edinburgh"}, {"DEU", "Bavaria", "Munich"},
	{"DEU", "Berlin", "Berlin"}, {"FRA", "Île-de-France", "Paris"},
	{"BRA", "São Paulo", "São Paulo"}, {"BRA", "Rio de Janeiro", "Rio de Janeiro"},
	{"BRA", "Minas Gerais", "Belo Horizonte"}, {"JPN", "Tokyo", "Tokyo"},
	{"AUS", "New South Wales", "Sydney"}, {"CAN", "Ontario", "Toronto"},
	{"IND", "Karnataka", "Bangalore"}, {"IND", "Maharashtra", "Mumbai"},
	{"KOR", "Seoul", "Seoul"}, {"NLD", "North Holland", "Amsterdam"},
}

var referrers = []string{
	"google", "google", "google", "twitter", "linkedin",
	"github", "direct", "direct", "hackernews", "reddit", "producthunt",
}

var utmSources = []string{"google", "twitter", "linkedin", "newsletter", "github"}
var utmMediums = []string{"cpc", "organic", "social", "email", "referral"}
var utmCampaigns = []string{"spring-launch", "beta-invite", "docs-update", "black-friday", "webinar-q1"}

// ── Public IP generation ────────────────────────────────────────────────────

var publicFirstOctets []int

func init() {
	for i := 1; i <= 126; i++ {
		publicFirstOctets = append(publicFirstOctets, i)
	}
	for i := 128; i <= 190; i++ {
		publicFirstOctets = append(publicFirstOctets, i)
	}
	for i := 193; i <= 254; i++ {
		publicFirstOctets = append(publicFirstOctets, i)
	}
}

func randomPublicIPv4(rng *mrand.Rand) string {
	first := publicFirstOctets[rng.IntN(len(publicFirstOctets))]
	return fmt.Sprintf("%d.%d.%d.%d", first, rng.IntN(256), rng.IntN(256), rng.IntN(254)+1)
}

// ── User agent generation ───────────────────────────────────────────────────

func userAgent(browser, bv, os, osv string) string {
	switch browser {
	case "Chrome":
		switch os {
		case "Android":
			return fmt.Sprintf("Mozilla/5.0 (Linux; Android %s) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Mobile Safari/537.36", osv, bv)
		case "macOS":
			return fmt.Sprintf("Mozilla/5.0 (Macintosh; Intel Mac OS X %s) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36", strings.ReplaceAll(osv, ".", "_"), bv)
		case "Linux":
			return fmt.Sprintf("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36", bv)
		default:
			return fmt.Sprintf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36", bv)
		}
	case "Safari":
		if os == "iOS" {
			return fmt.Sprintf("Mozilla/5.0 (iPhone; CPU iPhone OS %s like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/%s Mobile/15E148 Safari/604.1", strings.ReplaceAll(osv, ".", "_"), bv)
		}
		return fmt.Sprintf("Mozilla/5.0 (Macintosh; Intel Mac OS X %s) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/%s Safari/605.1.15", strings.ReplaceAll(osv, ".", "_"), bv)
	case "Firefox":
		switch os {
		case "macOS":
			return fmt.Sprintf("Mozilla/5.0 (Macintosh; Intel Mac OS X %s; rv:%s) Gecko/20100101 Firefox/%s", strings.ReplaceAll(osv, ".", "_"), bv, bv)
		case "Linux":
			return fmt.Sprintf("Mozilla/5.0 (X11; Linux x86_64; rv:%s) Gecko/20100101 Firefox/%s", bv, bv)
		default:
			return fmt.Sprintf("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:%s) Gecko/20100101 Firefox/%s", bv, bv)
		}
	case "Edge":
		return fmt.Sprintf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36 Edg/%s", bv, bv)
	case "Samsung Internet":
		return fmt.Sprintf("Mozilla/5.0 (Linux; Android %s) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/%s Chrome/120.0 Mobile Safari/537.36", osv, bv)
	}
	return "Mozilla/5.0"
}

// ── Weighted device profile picker ──────────────────────────────────────────

var deviceCdf []float64
var deviceCdfTotal float64

func init() {
	for _, t := range deviceTemplates {
		deviceCdfTotal += t.Weight
		deviceCdf = append(deviceCdf, deviceCdfTotal)
	}
}

func pickDeviceProfile(rng *mrand.Rand) deviceProfile {
	r := rng.Float64() * deviceCdfTotal
	idx := 0
	for i, c := range deviceCdf {
		if r <= c {
			idx = i
			break
		}
	}
	t := deviceTemplates[idx]
	bv := browserVersions[t.Browser][rng.IntN(len(browserVersions[t.Browser]))]
	ov := osVersions[t.OS][rng.IntN(len(osVersions[t.OS]))]
	return deviceProfile{
		DeviceType:     t.DeviceType,
		Browser:        t.Browser,
		BrowserVersion: bv,
		OS:             t.OS,
		OSVersion:      ov,
		Platform:       t.Platform,
	}
}

// ── Time distribution ───────────────────────────────────────────────────────

type dailyWeight struct {
	weight float64
	dateMs int64
}

func buildDailyWeights(rng *mrand.Rand, daysBack int) ([]dailyWeight, []float64, float64) {
	endMs := time.Now().UnixMilli()
	startMs := endMs - int64(daysBack)*24*60*60*1000
	msPerDay := int64(24 * 60 * 60 * 1000)
	startOfFirstDay := startMs - (startMs % msPerDay)

	numSpikes := max(2, daysBack*12/100)
	spikeDays := make(map[int]bool)
	for range numSpikes {
		spikeDays[rng.IntN(daysBack)] = true
	}

	weights := make([]dailyWeight, 0, daysBack)
	cdf := make([]float64, 0, daysBack)
	var cdfTotal float64

	for d := range daysBack {
		dateMs := startOfFirstDay + int64(d)*msPerDay
		t := time.UnixMilli(dateMs).UTC()
		isWeekend := t.Weekday() == time.Sunday || t.Weekday() == time.Saturday

		w := 1.0 + (float64(d)/float64(daysBack))*1.0
		if isWeekend {
			w *= 0.4 + rng.Float64()*0.15
		}
		if spikeDays[d] {
			w *= 1.5 + rng.Float64()*2.0
		}
		w *= 0.8 + rng.Float64()*0.4

		weights = append(weights, dailyWeight{weight: w, dateMs: dateMs})
		cdfTotal += w
		cdf = append(cdf, cdfTotal)
	}

	return weights, cdf, cdfTotal
}

func pickDay(rng *mrand.Rand, weights []dailyWeight, cdf []float64, cdfTotal float64) dailyWeight {
	r := rng.Float64() * cdfTotal
	lo, hi := 0, len(cdf)-1
	for lo < hi {
		mid := (lo + hi) >> 1
		if cdf[mid] < r {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	return weights[lo]
}

func generateHourOfDay(rng *mrand.Rand) float64 {
	if rng.Float64() < 0.2 {
		return rng.Float64() * 24
	}
	u1 := rng.Float64()
	u2 := rng.Float64()
	z := math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)
	hour := 13 + z*3
	for hour < 0 {
		hour += 24
	}
	for hour >= 24 {
		hour -= 24
	}
	return hour
}

func realisticTimestamp(rng *mrand.Rand, weights []dailyWeight, cdf []float64, cdfTotal float64) int64 {
	day := pickDay(rng, weights, cdf, cdfTotal)
	hourMs := int64(generateHourOfDay(rng) * 60 * 60 * 1000)
	return day.dateMs + hourMs
}

// ── Session ─────────────────────────────────────────────────────────────────

type session struct {
	sessionID  string
	userID     string
	startMs    int64
	device     deviceProfile
	ua         string
	ip         string
	country    location
	eventCount int
}

func newSession(rng *mrand.Rand, users []string, ts int64) session {
	dev := pickDeviceProfile(rng)
	return session{
		sessionID:  uuidv7(ts),
		userID:     users[rng.IntN(len(users))],
		startMs:    ts,
		device:     dev,
		ua:         userAgent(dev.Browser, dev.BrowserVersion, dev.OS, dev.OSVersion),
		ip:         randomPublicIPv4(rng),
		country:    countries[rng.IntN(len(countries))],
		eventCount: 0,
	}
}

// ── Event generation ────────────────────────────────────────────────────────

type event struct {
	EventID        string            `json:"event_id"`
	SessionID      string            `json:"session_id"`
	UserID         string            `json:"user_id"`
	EventName      string            `json:"event_name"`
	Timestamp      string            `json:"timestamp"`
	Country        string            `json:"country"`
	State          string            `json:"state"`
	City           string            `json:"city"`
	DeviceType     string            `json:"device_type"`
	Platform       string            `json:"platform"`
	Browser        string            `json:"browser"`
	BrowserVersion string            `json:"browser_version"`
	OS             string            `json:"os"`
	OSVersion      string            `json:"os_version"`
	IPAddress      string            `json:"ip_address"`
	UserAgent      string            `json:"user_agent"`
	PropsStr       map[string]string  `json:"props_str,omitempty"`
	PropsNum       map[string]float64 `json:"props_num,omitempty"`
	PropsBool      map[string]bool    `json:"props_bool,omitempty"`
}

func generateEvent(rng *mrand.Rand, s *session, randomBuf []byte) event {
	eventName := eventNames[rng.IntN(len(eventNames))]
	eventMs := s.startMs + int64(s.eventCount)*(1000+int64(rng.Float64()*29_000))
	s.eventCount++

	// Fill random bytes for UUID
	rand.Read(randomBuf[:16])

	e := event{
		EventID:        uuidv7Batch(eventMs, randomBuf[:16]),
		SessionID:      s.sessionID,
		UserID:         s.userID,
		EventName:      eventName,
		Timestamp:      time.UnixMilli(eventMs).UTC().Format("2006-01-02T15:04:05.000Z"),
		Country:        s.country.Code,
		State:          s.country.State,
		City:           s.country.City,
		DeviceType:     s.device.DeviceType,
		Platform:       s.device.Platform,
		Browser:        s.device.Browser,
		BrowserVersion: s.device.BrowserVersion,
		OS:             s.device.OS,
		OSVersion:      s.device.OSVersion,
		IPAddress:      s.ip,
		UserAgent:      s.ua,
	}

	switch eventName {
	case "page_view":
		e.PropsStr = map[string]string{
			"path":     pages[rng.IntN(len(pages))],
			"referrer": referrers[rng.IntN(len(referrers))],
		}
		if rng.Float64() < 0.3 {
			e.PropsStr["utm_source"] = utmSources[rng.IntN(len(utmSources))]
			e.PropsStr["utm_medium"] = utmMediums[rng.IntN(len(utmMediums))]
			e.PropsStr["utm_campaign"] = utmCampaigns[rng.IntN(len(utmCampaigns))]
		}
	case "click":
		elements := []string{"button", "link", "card", "nav-item", "cta"}
		e.PropsStr = map[string]string{
			"element": elements[rng.IntN(len(elements))],
			"page":    pages[rng.IntN(len(pages))],
		}
	case "purchase":
		currencies := []string{"USD", "EUR", "GBP", "BRL"}
		plans := []string{"starter", "pro", "enterprise"}
		e.PropsStr = map[string]string{
			"currency": currencies[rng.IntN(len(currencies))],
			"plan":     plans[rng.IntN(len(plans))],
		}
		e.PropsNum = map[string]float64{
			"amount": math.Round(rng.Float64()*500*100) / 100,
		}
	case "search":
		queries := []string{"analytics", "pricing", "api docs", "sdk", "integration", "dashboard", "events"}
		e.PropsStr = map[string]string{
			"query": queries[rng.IntN(len(queries))],
		}
		e.PropsNum = map[string]float64{
			"results_count": float64(rng.IntN(50)),
		}
	case "scroll_depth":
		depths := []float64{25, 50, 75, 100}
		e.PropsStr = map[string]string{
			"page": pages[rng.IntN(len(pages))],
		}
		e.PropsNum = map[string]float64{
			"depth_percent": depths[rng.IntN(len(depths))],
		}
	case "video_play":
		videos := []string{"intro", "demo", "tutorial-1", "tutorial-2"}
		e.PropsStr = map[string]string{
			"video_id": videos[rng.IntN(len(videos))],
		}
		e.PropsNum = map[string]float64{
			"duration_sec": float64(rng.IntN(300)),
		}
		e.PropsBool = map[string]bool{
			"autoplay": rng.Float64() < 0.3,
		}
	case "form_submit":
		forms := []string{"contact", "newsletter", "feedback", "demo-request"}
		e.PropsStr = map[string]string{
			"form_name": forms[rng.IntN(len(forms))],
		}
		e.PropsBool = map[string]bool{
			"success": rng.Float64() < 0.9,
		}
	case "add_to_cart":
		products := []string{"starter", "pro", "enterprise", "addon-seats", "addon-storage"}
		e.PropsStr = map[string]string{
			"product": products[rng.IntN(len(products))],
		}
		e.PropsNum = map[string]float64{
			"quantity": float64(rng.IntN(5) + 1),
		}
	}

	return e
}

// ── Batch generation ────────────────────────────────────────────────────────

func generateBatch(rng *mrand.Rand, users []string, size int, weights []dailyWeight, cdf []float64, cdfTotal float64) []byte {
	batch := make([]event, 0, size)
	randomBuf := make([]byte, 16)

	s := newSession(rng, users, realisticTimestamp(rng, weights, cdf, cdfTotal))
	eventsPerSession := 3 + rng.IntN(15)

	for range size {
		if s.eventCount >= eventsPerSession {
			s = newSession(rng, users, realisticTimestamp(rng, weights, cdf, cdfTotal))
			eventsPerSession = 3 + rng.IntN(15)
		}
		batch = append(batch, generateEvent(rng, &s, randomBuf))
	}

	data, _ := json.Marshal(batch)
	return data
}

// ── HTTP client ─────────────────────────────────────────────────────────────

func newHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        500,
			MaxIdleConnsPerHost: 500,
			MaxConnsPerHost:     500,
			IdleConnTimeout:     90 * time.Second,
			DialContext: (&net.Dialer{
				Timeout:   5 * time.Second,
				KeepAlive: 30 * time.Second,
				FallbackDelay: -1, // disable Happy Eyeballs, use first resolved address (IPv6 on macOS Docker)
			}).DialContext,
			DisableCompression: true,
		},
	}
}

func sendBatch(client *http.Client, url, key string, body []byte) error {
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", key)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}

// ── Worker ──────────────────────────────────────────────────────────────────

// Track first N errors so we can diagnose failures
var (
	errSamples   []string
	errSamplesMu sync.Mutex
	maxErrSamples = 5
)

func recordError(err error) {
	errSamplesMu.Lock()
	defer errSamplesMu.Unlock()
	if len(errSamples) < maxErrSamples {
		errSamples = append(errSamples, err.Error())
		fmt.Fprintf(os.Stderr, "\n  Error: %s\n", err.Error())
	}
}

func worker(
	id int,
	batches <-chan int,
	sent *atomic.Int64,
	failed *atomic.Int64,
	wg *sync.WaitGroup,
	url, key string,
	users []string,
	weights []dailyWeight,
	cdf []float64,
	cdfTotal float64,
	concurrencyCap int,
) {
	defer wg.Done()

	client := newHTTPClient()
	rng := mrand.New(mrand.NewPCG(mrand.Uint64(), mrand.Uint64()))
	sem := make(chan struct{}, concurrencyCap)
	var batchWg sync.WaitGroup

	for size := range batches {
		body := generateBatch(rng, users, size, weights, cdf, cdfTotal)

		sem <- struct{}{}
		batchWg.Add(1)
		go func(b []byte, sz int) {
			defer func() { <-sem; batchWg.Done() }()
			if err := sendBatch(client, url, key, b); err != nil {
				failed.Add(1)
				recordError(err)
			} else {
				sent.Add(int64(sz))
			}
		}(body, size)
	}

	batchWg.Wait()
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	flag.Parse()

	if *apiKey == "" {
		fmt.Fprintln(os.Stderr, "Error: --api-key is required")
		os.Exit(1)
	}

	if *workers == 0 {
		*workers = runtime.NumCPU()
	}

	// Generate user pool — capped at 1M to avoid slow startup
	numUsers := max(100, int(*total/30))
	if numUsers > 1_000_000 {
		numUsers = 1_000_000
	}
	fmt.Printf("Generating %s user IDs...\n", formatNum(int64(numUsers)))
	users := make([]string, numUsers)
	uidBuf := make([]byte, 6)
	for i := range users {
		rand.Read(uidBuf)
		users[i] = "user_" + hex.EncodeToString(uidBuf)
	}
	// Anonymous users
	users = append(users, "", "", "")

	// Build daily weights (shared across workers)
	rng := mrand.New(mrand.NewPCG(mrand.Uint64(), mrand.Uint64()))
	weights, cdf, cdfTotal := buildDailyWeights(rng, *daysBack)

	totalBatches := int((*total + int64(*batchSize) - 1) / int64(*batchSize))
	url := *endpoint + "/ingest-bulk"

	fmt.Printf("Seeding %s events\n", formatNum(*total))
	fmt.Printf("  Endpoint:    %s\n", url)
	fmt.Printf("  Batch size:  %d\n", *batchSize)
	fmt.Printf("  Batches:     %s\n", formatNum(int64(totalBatches)))
	fmt.Printf("  Workers:     %d\n", *workers)
	fmt.Printf("  Concurrency: %d per worker (%d total)\n", *concurrency, *workers**concurrency)
	fmt.Printf("  Time range:  last %d days\n", *daysBack)
	fmt.Printf("  Users:       ~%s\n", formatNum(int64(numUsers)))
	fmt.Println()

	var sent, failed atomic.Int64
	var wg sync.WaitGroup

	batches := make(chan int, *workers*(*concurrency))

	// Start workers
	for i := range *workers {
		wg.Add(1)
		go worker(i, batches, &sent, &failed, &wg, url, *apiKey, users, weights, cdf, cdfTotal, *concurrency)
	}

	// Progress reporter
	t0 := time.Now()
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s := sent.Load()
				f := failed.Load()
				elapsed := time.Since(t0).Seconds()
				rate := float64(s) / elapsed
				fmt.Printf("\r  Sent %s / %s events (%.1fs, ~%s events/s, %s failed)   ",
					formatNum(s), formatNum(*total), elapsed, formatNum(int64(rate)), formatNum(f))
			case <-done:
				return
			}
		}
	}()

	// Feed batches
	remaining := *total
	for remaining > 0 {
		size := min(int64(*batchSize), remaining)
		batches <- int(size)
		remaining -= size
	}
	close(batches)

	wg.Wait()
	close(done)

	elapsed := time.Since(t0).Seconds()
	s := sent.Load()
	rate := float64(s) / elapsed
	fmt.Printf("\r\n\nDone in %.1fs — %s events sent (~%s events/s)\n",
		elapsed, formatNum(s), formatNum(int64(rate)))
	if f := failed.Load(); f > 0 {
		fmt.Printf("  %s batches failed\n", formatNum(f))
	}
}

func formatNum(n int64) string {
	s := fmt.Sprintf("%d", n)
	if len(s) <= 3 {
		return s
	}
	var result strings.Builder
	remainder := len(s) % 3
	if remainder > 0 {
		result.WriteString(s[:remainder])
	}
	for i := remainder; i < len(s); i += 3 {
		if result.Len() > 0 {
			result.WriteByte(',')
		}
		result.WriteString(s[i : i+3])
	}
	return result.String()
}
