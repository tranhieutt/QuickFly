# Backend API Gateway

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Foundation — bottleneck, thiết kế trước nhất

## Overview

Backend API Gateway là một Express server chạy trên Railway, đóng vai trò trung gian duy nhất giữa React frontend và các external API (Gemini 2.5 Flash, Duffel). Gateway expose một endpoint công khai duy nhất — `POST /chat` — nhận tin nhắn tiếng Việt từ người dùng, điều phối qua NLP Parser → Flight Search → Filter Engine, và trả kết quả về frontend. Thiết kế stateless hoàn toàn: mỗi request độc lập, frontend tự giữ conversation history. Vai trò quan trọng nhất của Gateway là bảo vệ API keys (Gemini, Duffel) không bị lộ ở phía client, đồng thời là điểm kiểm soát tập trung cho rate limiting, error handling, và logging.

## User Stories

**As a Chat UI (frontend)**, I want to send a user message to `POST /chat` and receive a structured response, so that I can display results without knowing about Gemini or Duffel.

Acceptance Criteria:

- Given a valid message, when `POST /chat` is called, then response contains `type` (`"results"` | `"clarify"` | `"error"`) and `payload` within 8s
- Given an invalid/empty body, when `POST /chat` is called, then returns 400 with descriptive error message

**As a Chat UI (frontend)**, I want the Gateway to handle all external API failures gracefully, so that I always receive a structured response (never a raw crash).

Acceptance Criteria:

- Given Gemini API timeout, when `POST /chat` is called, then returns structured error response (503), not an unhandled exception
- Given Duffel API error, when `POST /chat` is called, then returns friendly Vietnamese error message in response payload

**As a Developer**, I want all requests and errors logged with enough context, so that I can debug issues in production without needing to reproduce them.

Acceptance Criteria:

- Given any request, when processed, then logs: timestamp, request ID, message length, response type, duration (ms)
- Given any unhandled error, when it occurs, then logs full stack trace with request context (never exposed to client)

## Acceptance Criteria

- [ ] Given `{ message: "HCM đi Hà Nội ngày 5/4" }`, when `POST /chat`, then response 200 với shape `{ type: "results", payload: [...] }` trong ≤ 8s
- [ ] Given `{ message: "Tôi muốn đặt vé" }` (thiếu thông tin), when `POST /chat`, then response 200 với `{ type: "clarify", payload: { question: "..." } }`
- [ ] Given body rỗng hoặc thiếu field `message`, when `POST /chat`, then response 400 với `{ error: "message là bắt buộc" }`
- [ ] Given Gemini API không phản hồi sau 8s, when `POST /chat`, then response 503 với `{ type: "error", payload: { message: "..." } }` — không crash server
- [ ] Given Duffel API trả lỗi 4xx/5xx, when `POST /chat`, then response 200 với `{ type: "error", payload: { message: "Không tìm được chuyến bay..." } }`
- [ ] Given request hợp lệ, when processed, then server log ghi: requestId, duration(ms), responseType — không ghi nội dung message
- [ ] Given CORS request từ Vercel frontend domain, when OPTIONS/POST, then response có header `Access-Control-Allow-Origin` đúng domain
- [ ] Performance: `POST /chat` phản hồi trong ≤ 8s (bao gồm cả thời gian gọi Gemini + Duffel) tại p95 dưới tải bình thường (< 10 concurrent users)

## Technical Design

### API Contracts

**Endpoint duy nhất:**

```http
POST /chat
Content-Type: application/json
Origin: [Vercel frontend domain]
```

**Request body:**

```json
{
  "message": "string (required, max 500 chars)",
  "conversationHistory": [
    { "role": "user | bot", "content": "string" }
  ]
}
```

*`conversationHistory` optional — frontend gửi lên để NLP Parser hiểu ngữ cảnh hỏi lại.*

**Response — type: `"results"`** (tìm được chuyến bay):

```json
{
  "type": "results",
  "payload": [
    {
      "id": "string",
      "airline": "string",
      "price": 850000,
      "currency": "VND",
      "departure": "07:00",
      "arrival": "09:10",
      "duration": "2h10m",
      "stops": 0,
      "bookingUrl": "https://..."
    }
  ]
}
```

**Response — type: `"clarify"`** (thiếu thông tin):

```json
{ "type": "clarify", "payload": { "question": "Bạn muốn bay ngày nào?" } }
```

**Response — type: `"error"`** (lỗi external API / không có kết quả):

```json
{ "type": "error", "payload": { "message": "Không tìm thấy chuyến bay phù hợp..." } }
```

**HTTP error responses (4xx/5xx):**

```json
400: { "error": "message là bắt buộc" }
429: { "error": "Quá nhiều yêu cầu, vui lòng thử lại sau" }
503: { "error": "Dịch vụ tạm thời không khả dụng" }
```

**Rate limiting**: 20 requests/phút per IP.

### Data Models

Gateway không lưu dữ liệu (stateless). Internal type contracts:

```ts
FlightOffer:  { id, airline, price(VND), currency, departure, arrival, duration, stops, bookingUrl }
ChatRequest:  { message, conversationHistory? }
ChatResponse: { type: "results" | "clarify" | "error", payload }
```

### State & Flow

```text
Frontend → POST /chat
    │
    ▼
[1] Validate request body (message tồn tại, không rỗng)
    │
    ▼
[2] NLP Parser ← gọi Gemini 2.5 Flash
    │  Output: ParsedIntent { origin, destination, date, adults, filters }
    │  Nếu thiếu field bắt buộc → return { type: "clarify", payload: { question } }
    │
    ▼
[3] Input Validator ← validate ParsedIntent
    │  Nếu invalid → return { type: "clarify" }
    │
    ▼
[4] Flight Search ← gọi Duffel API
    │  Output: raw flight list
    │  Nếu lỗi → return { type: "error" }
    │
    ▼
[5] Filter Engine ← áp dụng filters từ ParsedIntent
    │  Output: top 3 flights, price converted sang VND
    │
    ▼
[6] Return { type: "results", payload: [...] }
```

### Business Rules

- Chỉ trả về tối đa **3 chuyến bay** (`MAX_RESULTS = 3`)
- Giá luôn convert sang **VND** trước khi trả về (tỉ giá lấy từ config, không real-time)
- Nếu filter "bay thẳng" không có kết quả → không fallback sang có điểm dừng, trả `type: "error"` với message gợi ý bỏ filter
- `conversationHistory` được pass xuống NLP Parser để resolve context (ví dụ: "sáng thôi" sau khi đã biết route)
- Không log nội dung `message` của user (privacy)

## Edge Cases & Error Handling

| Scenario | Input Condition | Expected Behavior |
| --- | --- | --- |
| Body rỗng | Request không có body | 400 `{ error: "message là bắt buộc" }` |
| Message rỗng | `message: ""` | 400 `{ error: "message không được để trống" }` |
| Message quá dài | `message` > 500 chars | 400 `{ error: "message tối đa 500 ký tự" }` |
| Gemini timeout | Gemini không phản hồi sau 8s | 503 `{ error: "Dịch vụ tạm thời không khả dụng" }` |
| Gemini lỗi parse | Gemini trả về JSON không hợp lệ | `{ type: "clarify", payload: { question: "Bạn có thể nói rõ hơn không?" } }` |
| Duffel timeout | Duffel không phản hồi sau 8s | `{ type: "error", payload: { message: "Không thể tìm vé lúc này..." } }` |
| Duffel 429 | Duffel rate limit | `{ type: "error", payload: { message: "..." } }` + log cảnh báo |
| Không có kết quả | Duffel trả về 0 chuyến bay | `{ type: "error", payload: { message: "Không tìm thấy chuyến bay..." } }` |
| Filter loại hết kết quả | Bay thẳng filter → 0 chuyến | `{ type: "error", payload: { message: "Không có chuyến bay thẳng, thử bỏ filter?" } }` |
| Rate limit | > 20 req/phút cùng IP | 429 `{ error: "Quá nhiều yêu cầu, thử lại sau" }` |
| Unhandled exception | Bug không lường trước | 500, log full stack trace (không expose ra client) |
| CORS sai origin | Request từ domain không phải Vercel | 403 blocked bởi CORS middleware |

## Dependencies

**External (hard — Gateway không hoạt động nếu thiếu):**

- **Gemini 2.5 Flash API** — Google AI Studio. Dùng trong bước NLP parsing. Key: `GEMINI_API_KEY`.
- **Duffel Air API** (`api.duffel.com`) — Dùng trong bước Flight Search. Token: `DUFFEL_TOKEN`.

**Internal systems phụ thuộc vào Gateway (downstream):**

- **NLP Parser** (#4) — gọi Gemini qua Gateway
- **Flight Search** (#6) — gọi Duffel qua Gateway
- Gián tiếp: Filter Engine (#7), Conversation State Manager (#8), Redirect Handler (#9), Result Display (#10), Chat UI (#11)

**Runtime:**

- **Node.js + Express** — runtime và HTTP framework
- **Railway** — deployment platform

**Frontend caller:**

- **Chat UI** (#11) — React app trên Vercel, gọi `POST /chat` qua HTTPS

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `PORT` | int | `3000` | Port Express server lắng nghe |
| `GEMINI_API_KEY` | string | — | Google AI Studio API key (bắt buộc) |
| `DUFFEL_TOKEN` | string | — | Duffel API Bearer token — `duffel_test_...` cho sandbox (bắt buộc) |
| `DUFFEL_MAX_RESULTS` | int | `15` | Số offer tối đa fetch từ Duffel trước khi Filter Engine lọc |
| `GEMINI_MODEL` | string | `"gemini-2.5-flash"` | Model NLP sử dụng |
| `API_TIMEOUT_MS` | int | `8000` | Timeout cho Gemini và Duffel (ms) |
| `MAX_RESULTS` | int | `3` | Số chuyến bay tối đa trả về |
| `RATE_LIMIT_RPM` | int | `20` | Max requests/phút per IP |
| `VND_EXCHANGE_RATE` | float | `25000` | Tỉ giá USD→VND (cập nhật thủ công) |
| `CORS_ALLOWED_ORIGIN` | string | `"http://localhost:5173"` | Domain frontend được phép gọi (Vercel URL trong prod) |
| `LOG_LEVEL` | string | `"info"` | `"debug"` / `"info"` / `"error"` |

> Tất cả giá trị nhạy cảm (`*_KEY`, `*_SECRET`) lưu trong Railway environment variables, không commit vào code. Xem `.env.example` để biết tên biến cần cấu hình.

## Non-Functional Requirements

**Performance:**

- `POST /chat` phản hồi ≤ 8s tại p95 (bao gồm Gemini + Duffel round-trip)
- Server khởi động trong ≤ 5s trên Railway
- Memory footprint ≤ 256MB (Railway free tier limit)

**Availability:**

- Target: 99% uptime (Railway managed infra)
- Graceful shutdown khi deploy mới: drain in-flight requests trước khi tắt

**Scalability (MVP):**

- Thiết kế cho < 10 concurrent users — không cần horizontal scaling ở MVP
- Stateless nên scale-out trivial khi cần

**Observability:**

- Structured logs (JSON) với: `timestamp`, `requestId`, `duration`, `responseType`, `statusCode`
- Không log `message` content của user

**Reliability:**

- Không retry tự động external API (Gemini, Duffel) — timeout fast-fail để tránh cascade delay
- Unhandled exceptions bắt bằng global error middleware, không crash process

## Security Considerations

**API Key Protection:**

- `GEMINI_API_KEY`, `DUFFEL_TOKEN` chỉ tồn tại ở backend (Railway env vars)
- Không bao giờ trả về API keys trong response hoặc log

**CORS:**

- Chỉ cho phép request từ `CORS_ALLOWED_ORIGIN` (Vercel domain trong prod, `localhost:5173` trong dev)
- Không dùng `*` wildcard trong production

**Input Sanitization:**

- Validate và giới hạn `message` length (max 500 chars) trước khi forward sang Gemini
- `conversationHistory` chỉ nhận array of `{ role, content }` — reject unknown fields
- Không eval/execute bất kỳ nội dung nào từ user input

**Rate Limiting:**

- 20 req/phút per IP để ngăn abuse và chi phí API không kiểm soát

**Error Responses:**

- Không bao giờ expose stack traces, tên internal module, hoặc thông tin hệ thống trong response
- Log chi tiết ở server, trả về message thân thiện cho client

**Logging:**

- Không log `message` content của user (privacy)
- Không log `conversationHistory`
- Log: requestId, IP (hashed), duration, responseType, statusCode

**Data:**

- Không lưu bất kỳ dữ liệu người dùng nào (stateless) — không có attack surface từ data storage
- Không có auth/session → không có session fixation hay token theft risk

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Validation logic (body schema, length check), Business rules (MAX_RESULTS, VND conversion, filter fallback) | Jest |
| Integration | `POST /chat` end-to-end với Gemini/Duffel mock — verify đúng response shape cho cả 3 type | Jest + Supertest |
| Integration | CORS headers trả về đúng origin | Jest + Supertest |
| Integration | Rate limit trả 429 sau N requests | Jest + Supertest |
| Integration | Timeout handling — mock Gemini delay > 8s → expect 503 | Jest + Supertest |
| Manual/E2E | Happy path: nhập câu tiếng Việt thật → nhận top 3 vé (Duffel sandbox) | Manual / Playwright |
| Manual | Kiểm tra API keys không lộ trong browser Network tab | Manual |

> External API calls (Gemini, Duffel) luôn mock trong unit và integration tests. Chỉ test thật với Duffel sandbox trong E2E/manual.

## Open Questions

- **Tỉ giá VND**: `VND_EXCHANGE_RATE` hiện là config cứng (25,000). Khi nào cần update? Ai update? Cân nhắc thêm cron job hoặc dùng free exchange rate API trong tương lai.
