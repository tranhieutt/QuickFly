# Filter Engine

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Feature

## Overview

Filter Engine là một pure function module trong Feature layer, nhận `FlightOffer[]` từ Flight Search và `filters` từ `ParsedIntent`, áp dụng bộ lọc theo giờ bay (`timeOfDay`) rồi trả về top 3 chuyến bay rẻ nhất còn lại. Lọc `stops` đã được xử lý tại Flight Search (Amadeus `nonStop` param), nên Filter Engine chỉ cần xử lý `timeOfDay`. Nếu sau khi lọc không còn kết quả nào → throw `FilterError` với message tiếng Việt gợi ý bỏ filter. Không có external call, không lưu state.

## User Stories

**As a Backend API Gateway**, I want to call `applyFilters(offers, filters)` and receive top 3 offers, so that I can return results to the frontend without knowing about filter logic.

Acceptance Criteria:

- Given 15 offers và `filters.timeOfDay: null`, when called, then returns top 3 cheapest offers
- Given 15 offers và `filters.timeOfDay: "morning"`, when called, then returns only morning departure offers, top 3 cheapest

**As a Chat UI (frontend)**, I want a clear Vietnamese error message when filters yield no results, so that users know to adjust their search.

Acceptance Criteria:

- Given 0 offers remain after filter, when called, then throws `FilterError` với message gợi ý bỏ filter

## Acceptance Criteria

- [ ] `applyFilters(offers, { timeOfDay: null, stops: "any" })` → trả về top 3 cheapest từ list đầu vào
- [ ] `applyFilters(offers, { timeOfDay: "morning" })` → chỉ giữ offers có `departure` trong `06:00–11:59`, trả top 3 cheapest
- [ ] `applyFilters(offers, { timeOfDay: "afternoon" })` → chỉ giữ offers có `departure` trong `12:00–17:59`, trả top 3 cheapest
- [ ] Sau filter → 0 offers → throw `FilterError` với message tiếng Việt phù hợp
- [ ] `applyFilters([], ...)` → throw `FilterError`
- [ ] `applyFilters()` hoàn thành trong ≤ 1ms (pure in-memory, no I/O)

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
applyFilters(
  offers: FlightOffer[],
  filters: { timeOfDay: "morning" | "afternoon" | null, stops: "direct" | "any" }
): FlightOffer[]
// Throws FilterError nếu result rỗng sau filter
```

### Data Models

Không lưu dữ liệu. Nhận và trả `FlightOffer[]` (định nghĩa trong Flight Search spec).

`FilterError` — error class mới, cần thêm vào Error Handler:

| Class | HTTP Status | Response type | userMessage |
| --- | --- | --- | --- |
| `FilterError` | 200 | `type: "error"` | Caller-provided (tiếng Việt) |

### State & Flow

```text
applyFilters(offers, filters)
    │
    ▼
[1] Nếu filters.timeOfDay != null
    │  "morning"   → filter offers có departure trong 06:00–11:59
    │  "afternoon" → filter offers có departure trong 12:00–17:59
    │
    ▼
[2] Kiểm tra còn offer không
    │  0 offers → throw FilterError(contextualMessage)
    │
    ▼
[3] Lấy top MAX_RESULTS (offers đã được Flight Search sort by price)
    │  → filtered.slice(0, MAX_RESULTS)
    │
    ▼
[4] Return FlightOffer[]
```

### Business Rules

- **timeOfDay filter**:
  - `"morning"` → `departure >= "06:00"` AND `departure <= "11:59"`
  - `"afternoon"` → `departure >= "12:00"` AND `departure <= "17:59"`
  - `null` → không lọc
- **stops filter**: Không xử lý tại đây — Flight Search đã pass `nonStop=true` vào Amadeus khi `filters.stops === "direct"`
- **Top 3**: `filtered.slice(0, MAX_RESULTS)` — list đã sorted by price từ Flight Search, không sort lại
- **FilterError message** phụ thuộc vào filter đang active:
  - `timeOfDay: "morning"` → `"Không tìm thấy chuyến bay buổi sáng. Bạn có muốn thử giờ khác không?"`
  - `timeOfDay: "afternoon"` → `"Không tìm thấy chuyến bay buổi chiều. Bạn có muốn thử giờ khác không?"`
  - Input rỗng → `"Không tìm thấy chuyến bay phù hợp."`
- **`MAX_RESULTS`**: Đọc từ config, mặc định 3 (đã định nghĩa trong API Gateway spec)

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| Input rỗng | `offers: []` | `throw FilterError("Không tìm thấy chuyến bay phù hợp.")` |
| Filter lọc hết | `timeOfDay: "morning"`, không offer nào 06–12h | `throw FilterError("Không tìm thấy chuyến bay buổi sáng. Bạn có muốn thử giờ khác không?")` |
| < 3 sau filter | Chỉ còn 1–2 offers | Trả đúng số lượng có — không throw (1–2 kết quả vẫn hợp lệ) |
| `departure` format lạ | Không parse được "HH:mm" | Bỏ qua offer đó (coi như không pass filter) |
| `timeOfDay` không hợp lệ | Giá trị ngoài `"morning"/"afternoon"/null` | Coi là `null` (không lọc) — defensive fallback |

## Dependencies

**Upstream (phụ thuộc vào):**

- **Flight Search (#6)** — cung cấp `FlightOffer[]` đã sorted by price
- **Error Handler (#3)** — throw `FilterError` (cần thêm class này vào Error Handler)
- **Backend API Gateway (#1)** — cung cấp config `MAX_RESULTS`

**Downstream (phụ thuộc vào Filter Engine):**

- **Result Display (#10)** — nhận `FlightOffer[]` top 3 để hiển thị
- **Backend API Gateway** — nhận kết quả cuối cùng để trả về frontend

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `MAX_RESULTS` | int | `3` | Số kết quả tối đa trả về — từ API Gateway spec, không định nghĩa lại |

## Non-Functional Requirements

- `applyFilters()` hoàn thành trong ≤ 1ms (pure synchronous in-memory, no I/O)
- Stateless — mỗi call hoàn toàn độc lập

## Security Considerations

- Không xử lý PII hay dữ liệu nhạy cảm
- Input đến từ internal Flight Search — không có injection risk
- Pure comparison logic — không có dynamic eval hay regex từ user input

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | `timeOfDay: null` → trả top 3 không lọc | Jest |
| Unit | `timeOfDay: "morning"` → chỉ giữ offers 06:00–11:59 | Jest |
| Unit | `timeOfDay: "afternoon"` → chỉ giữ offers 12:00–17:59 | Jest |
| Unit | 0 offers sau filter → throw `FilterError` đúng message | Jest |
| Unit | Input rỗng (`[]`) → throw `FilterError` | Jest |
| Unit | < 3 offers sau filter → trả đúng số lượng có | Jest |
| Unit | Boundary: departure `"06:00"` và `"11:59"` → pass morning | Jest |
| Unit | Boundary: departure `"05:59"` → không pass morning | Jest |

## Open Questions

- **Evening filter**: Buổi tối (18:00–23:59) có cần thêm vào MVP không? NLP Parser hiện chỉ extract `"morning"/"afternoon"` — nếu thêm `"evening"` cần update cả NLP Parser spec và Gemini system prompt.
