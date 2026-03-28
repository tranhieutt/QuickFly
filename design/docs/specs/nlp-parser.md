# NLP Parser

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Core

## Overview

NLP Parser là module Core trong backend, chịu trách nhiệm chuyển đổi tin nhắn tiếng Việt tự nhiên từ người dùng thành một `ParsedIntent` JSON có cấu trúc để các hệ thống phía sau (Input Validator, Flight Search) có thể xử lý. Module gọi Gemini 2.5 Flash với system prompt được thiết kế sẵn, pass toàn bộ `conversationHistory` để Gemini hiểu ngữ cảnh hội thoại (ví dụ: "sáng thôi" sau khi đã biết route), rồi gọi IATA Code Mapper để chuẩn hóa tên địa danh sang IATA code. Nếu Gemini trích xuất được đủ thông tin → trả về `ParsedIntent`. Nếu thiếu field bắt buộc → tạo câu hỏi hỏi lại tiếng Việt và throw `NLPParseError` để Gateway trả `type: "clarify"`. Nếu Gemini timeout hoặc lỗi → throw `GeminiError`.

## User Stories

**As a Backend API Gateway**, I want to pass `{ message, conversationHistory }` to the NLP Parser and receive a `ParsedIntent`, so that I can forward it to Flight Search without knowing anything about Gemini.

Acceptance Criteria:

- Given `"HCM đi Hà Nội ngày 5/4"`, when `parse()` is called, then returns `ParsedIntent` với đầy đủ fields
- Given `"sáng thôi"` với history chứa route đã biết, when `parse()` is called, then returns `ParsedIntent` với `filters.timeOfDay: "morning"`

**As a Backend API Gateway**, I want NLP Parser to throw a structured `NLPParseError` with a Vietnamese question when info is missing, so that I can return `type: "clarify"` to the frontend.

Acceptance Criteria:

- Given `"tôi muốn đặt vé"` (không có route/ngày), when `parse()` is called, then throws `NLPParseError` với `clarifyQuestion: "Bạn muốn bay từ đâu đến đâu?"`
- Given `"HCM đi Hà Nội"` (không có ngày), then throws `NLPParseError` với `clarifyQuestion: "Bạn muốn bay ngày nào?"`

**As a Developer**, I want to modify the Gemini system prompt without changing application code, so that I can tune parsing accuracy based on real-world failures.

Acceptance Criteria:

- Prompt được load từ file `src/prompts/nlp-system-prompt.txt` lúc startup
- Thay đổi prompt + restart server → có hiệu lực ngay, không cần redeploy code

## Acceptance Criteria

**Parse thành công:**

- [ ] `"HCM đi Hà Nội ngày 5/4"` → `{ origin:"SGN", destination:"HAN", departureDate:"2026-04-05", adults:1, tripType:"one-way", filters:{ timeOfDay:null, stops:"any" } }`
- [ ] `"bay thẳng sáng sớm Đà Nẵng đi Hà Nội ngày 10/4 2 người"` → `origin:"DAD", destination:"HAN", departureDate:"2026-04-10", adults:2, filters:{ timeOfDay:"morning", stops:"direct" }`
- [ ] Tên thành phố `"sài gòn"` được map sang IATA code `"SGN"` (không phải giữ nguyên chuỗi)

**Clarify (thiếu field bắt buộc):**

- [ ] `"tôi muốn đặt vé"` → throws `NLPParseError`, `clarifyQuestion` chứa câu hỏi về route
- [ ] `"HCM đi Hà Nội"` (không ngày) → throws `NLPParseError`, `clarifyQuestion` hỏi ngày bay
- [ ] `"ngày mai"` với history có sẵn route → parse được, không throw

**Context-awareness:**

- [ ] `"sáng thôi"` sau khi user đã nói route trong history → `filters.timeOfDay:"morning"` được parse đúng
- [ ] `"bay thẳng thôi"` → `filters.stops:"direct"` được parse đúng

**Lỗi external:**

- [ ] Gemini timeout (> 8s) → throws `GeminiError` (không phải `NLPParseError`)
- [ ] Gemini trả JSON không hợp lệ / ngoài schema → throws `NLPParseError` với generic clarify question

**Performance:**

- [ ] `parse()` hoàn thành trong ≤ 5s (Gemini round-trip, trong ngân sách 8s của Gateway)

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
async parse(
  message: string,
  conversationHistory?: Array<{ role: string, content: string }>
): Promise<ParsedIntent>

// Throws:
//   GeminiError     — Gemini timeout hoặc API fail
//   NLPParseError   — thiếu required fields hoặc không map được IATA
```

### Data Models

```ts
interface ParsedIntent {
  origin: string;           // IATA code, e.g. "SGN"
  destination: string;      // IATA code, e.g. "HAN"
  departureDate: string;    // ISO 8601, e.g. "2026-04-05"
  adults: number;           // Default: 1
  tripType: "one-way" | "round-trip";  // Default: "one-way"
  filters: {
    timeOfDay: "morning" | "afternoon" | null;  // null = không lọc
    stops: "direct" | "any";                     // Default: "any"
  };
}

// NLPParseError bổ sung field:
// clarifyQuestion: string  — câu hỏi tiếng Việt trả về user
```

**Gemini raw output schema** (JSON mà Gemini phải trả về):

```json
{
  "origin_raw": "hcm",
  "destination_raw": "hà nội",
  "departureDate": "2026-04-05",
  "adults": 1,
  "tripType": "one-way",
  "filters": { "timeOfDay": null, "stops": "any" },
  "missingFields": []
}
```

*`origin_raw` / `destination_raw`: tên thô từ Gemini — IATA Mapper sẽ chuẩn hóa sau. `missingFields`: Gemini tự khai báo field nào còn thiếu.*

### State & Flow

```text
parse(message, history)
    │
    ▼
[1] Build Gemini prompt:
    System prompt (load từ nlp-system-prompt.txt)
    + conversationHistory (full)
    + message hiện tại
    │
    ▼
[2] Gọi Gemini 2.5 Flash (timeout: GEMINI_TIMEOUT_MS)
    │  Lỗi / timeout → throw GeminiError
    │
    ▼
[3] Parse JSON response từ Gemini
    │  JSON không hợp lệ → throw NLPParseError("Bạn có thể nói rõ hơn không?")
    │
    ▼
[4] Kiểm tra missingFields từ Gemini response
    │  Thiếu origin/destination/departureDate → throw NLPParseError(clarifyQuestion)
    │
    ▼
[5] Gọi IATA Code Mapper cho origin_raw và destination_raw
    │  Mapper trả null → throw NLPParseError("Bạn có thể nói rõ hơn bạn muốn đi sân bay nào không?")
    │
    ▼
[6] Build và return ParsedIntent
```

### Business Rules

- **3 required fields**: `origin`, `destination`, `departureDate` — thiếu bất kỳ → clarify
- **`adults`** default `1` nếu Gemini không trích xuất được
- **`tripType`** default `"one-way"` nếu không đề cập
- **`filters.timeOfDay`** default `null`, **`filters.stops`** default `"any"`
- **IATA mapping**: gọi `mapToIATA(origin_raw)` và `mapToIATA(destination_raw)`. Kết quả `null` → throw `NLPParseError` với câu hỏi làm rõ địa điểm
- **Clarify question priority** khi nhiều field thiếu: route (origin/destination) trước, ngày sau
- **Không retry** Gemini — fail fast, throw error ngay
- **System prompt** load từ `src/prompts/nlp-system-prompt.txt` lúc startup — không hardcode trong code

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| Câu ngoài chủ đề | `"thời tiết hôm nay thế nào?"` | Gemini khai báo missingFields đầy đủ → clarify về route |
| Origin = Destination | `"SGN đi SGN"` | Pass xuống Input Validator để bắt |
| Ngày trong quá khứ | `"ngày 1/1"` → 2026-01-01 | Pass xuống Input Validator để bắt |
| Ngày mơ hồ | `"tuần tới"` | Gemini ước tính ngày; nếu không chắc → `missingFields: ["departureDate"]` |
| Cả 2 thành phố không map được IATA | `origin_raw: "xyz"`, `destination_raw: "abc"` | Throw `NLPParseError` hỏi origin trước |
| Gemini trả text thay vì JSON | Gemini trả lời kiểu chat | Catch parse error → throw `NLPParseError` generic |
| `conversationHistory` rất dài | > 20 tin nhắn | Pass hết vào Gemini (không giới hạn ở MVP) |
| Round trip | `"HCM đi Hà Nội và về"` | `tripType:"round-trip"` — MVP chưa support, Gemini khai báo `missingFields:["returnDate"]` → clarify |

## Dependencies

**Upstream (NLP Parser phụ thuộc vào):**

- **IATA Code Mapper (#2)** — `mapToIATA()` để chuẩn hóa địa danh → IATA code
- **Error Handler (#3)** — throw `GeminiError`, `NLPParseError`
- **Gemini 2.5 Flash API** (external) — key: `GEMINI_API_KEY`
- **`src/prompts/nlp-system-prompt.txt`** — system prompt, load lúc startup

**Downstream (phụ thuộc vào NLP Parser):**

- **Input Validator (#5)** — nhận `ParsedIntent` để validate
- **Conversation State Manager (#8)** — dùng NLP Parser để parse mọi tin nhắn trong session

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | string | — | Đã định nghĩa trong API Gateway spec |
| `GEMINI_MODEL` | string | `"gemini-2.5-flash"` | Đã định nghĩa trong API Gateway spec |
| `GEMINI_TIMEOUT_MS` | int | `5000` | Timeout riêng cho Gemini call (trong ngân sách 8s của Gateway) |
| `NLP_PROMPT_PATH` | string | `"src/prompts/nlp-system-prompt.txt"` | Đường dẫn system prompt file |

## Non-Functional Requirements

- `parse()` hoàn thành trong ≤ 5s tại p95 (Gemini round-trip)
- Stateless — mỗi call độc lập, không lưu trạng thái
- System prompt load 1 lần lúc startup, cache in-memory

## Security Considerations

- `GEMINI_API_KEY` chỉ tồn tại trong Railway env var — không log, không expose
- `conversationHistory` và `message` không được log (chứa thông tin cá nhân của user)
- System prompt được thiết kế để Gemini chỉ output JSON theo schema cố định — giảm thiểu prompt injection risk
- Validate JSON schema của Gemini output trước khi dùng — không trust field ngoài schema

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Clarify question đúng khi thiếu từng required field | Jest + Gemini mock |
| Unit | IATA Mapper trả null → throw `NLPParseError` | Jest |
| Unit | Gemini trả JSON không hợp lệ → throw `NLPParseError` | Jest |
| Unit | Gemini timeout → throw `GeminiError` | Jest (mock timeout) |
| Unit | Default values: `adults=1`, `tripType="one-way"` khi không đề cập | Jest |
| Integration | Context-awareness: `"sáng thôi"` với history chứa route → `filters.timeOfDay:"morning"` | Jest + Gemini mock |
| Manual/E2E | Real Gemini call với 10+ câu tiếng Việt đa dạng → kiểm tra parse accuracy | Manual |

> Gemini luôn mock trong unit/integration tests. Chỉ test thật trong manual E2E.

## Open Questions

- **Round-trip support**: MVP chỉ support one-way. Nếu user hỏi round-trip, bot clarify hay thông báo không hỗ trợ?
- **`conversationHistory` size limit**: Có cần giới hạn số tin nhắn pass vào Gemini để kiểm soát token cost không? (Hiện tại: pass hết, không giới hạn)
- **System prompt versioning**: Khi update prompt, làm sao biết parse accuracy cải thiện hay xấu đi? Cần eval set.
