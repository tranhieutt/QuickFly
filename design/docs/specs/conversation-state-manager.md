# Conversation State Manager

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Feature

## Overview

Conversation State Manager là module trong Feature layer, đọc `conversationHistory` từ mỗi request để suy ra trạng thái hội thoại hiện tại (`idle` / `awaiting_clarification` / `results_shown`), rồi quyết định cách xử lý tin nhắn tiếp theo của user. Vì Gateway stateless, CSM không lưu state — toàn bộ context được suy ra từ history. Kết quả: một `ConversationContext` object chứa state và metadata, được Gateway dùng để route xử lý đúng cách (ví dụ: nếu đang `awaiting_clarification`, NLP Parser biết user đang trả lời câu hỏi chứ không phải tìm kiếm mới).

## User Stories

**As a Backend API Gateway**, I want to call `detectState(conversationHistory)` before NLP parsing, so that I can pass the right context to NLP Parser and interpret the user's message correctly.

Acceptance Criteria:

- Given empty history, when `detectState()` is called, then returns `{ state: "idle" }`
- Given history where last bot message has `type: "clarify"`, when called, then returns `{ state: "awaiting_clarification" }`
- Given history where last bot message has `type: "results"`, when called, then returns `{ state: "results_shown" }`

**As a NLP Parser**, I want to know whether the user is answering a clarify question or starting a new search, so that Gemini can parse the message with the right context.

Acceptance Criteria:

- Given `state: "awaiting_clarification"`, when Gateway calls NLP Parser, then system prompt includes context that user is answering a clarify question (not starting new search)

## Acceptance Criteria

- [ ] `detectState(undefined)` → `{ state: "idle", lastBotType: null }`
- [ ] `detectState([])` → `{ state: "idle", lastBotType: null }`
- [ ] History cuối là bot message với `type: "clarify"` → `{ state: "awaiting_clarification", lastBotType: "clarify" }`
- [ ] History cuối là bot message với `type: "results"` → `{ state: "results_shown", lastBotType: "results" }`
- [ ] History cuối là bot message với `type: "error"` → `{ state: "idle", lastBotType: "error" }`
- [ ] History cuối là user message (chưa có bot reply) → `{ state: "idle", lastBotType: null }`
- [ ] `detectState()` hoàn thành trong ≤ 1ms

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
detectState(
  conversationHistory?: Array<{ role: "user" | "bot", content: string, type?: "clarify" | "results" | "error" }>
): ConversationContext
```

### Data Models

```ts
interface ConversationContext {
  state: "idle" | "awaiting_clarification" | "results_shown";
  lastBotType: "clarify" | "results" | "error" | null;
}

// ConversationHistory item (extended từ API Gateway spec):
interface HistoryItem {
  role: "user" | "bot";
  content: string;
  type?: "clarify" | "results" | "error"; // chỉ có ở bot messages
}
```

**Contract với Chat UI (frontend)**: Frontend phải lưu `type` field từ mỗi bot response và include nó trong `conversationHistory` khi gửi lên Gateway. Đây là requirement bắt buộc để CSM hoạt động đúng.

### State & Flow

```text
detectState(conversationHistory)
    │
    ▼
[1] Nếu history rỗng / undefined → return { state: "idle", lastBotType: null }
    │
    ▼
[2] Tìm bot message cuối cùng trong history
    │  Không có bot message → return { state: "idle", lastBotType: null }
    │
    ▼
[3] Đọc type của bot message cuối
    ├── type: "clarify" → { state: "awaiting_clarification", lastBotType: "clarify" }
    ├── type: "results" → { state: "results_shown", lastBotType: "results" }
    ├── type: "error"   → { state: "idle", lastBotType: "error" }
    └── type: undefined → { state: "idle", lastBotType: null }
```

**Gateway sử dụng ConversationContext:**

```text
ConversationContext.state
    ├── "idle"                  → NLP Parser bình thường
    ├── "awaiting_clarification" → NLP Parser với hint: "user đang trả lời câu hỏi"
    └── "results_shown"         → Check nếu user chọn chuyến (→ Redirect Handler)
                                   hoặc tìm mới (→ NLP Parser bình thường)
```

### Business Rules

- Chỉ nhìn bot message **cuối cùng** để xác định state — không scan toàn bộ history
- `type: "error"` → reset về `idle` (cho phép tìm kiếm mới sau lỗi)
- Bot message không có `type` field → treat như `idle` (defensive)
- Frontend **bắt buộc** include `type` trong bot messages khi gửi history lên — thiếu `type` → CSM coi là `idle`
- Không có business logic ngoài state detection — Gateway quyết định routing

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| History undefined | Frontend không gửi history | `{ state: "idle" }` |
| History rỗng | `conversationHistory: []` | `{ state: "idle" }` |
| Chỉ có user messages | Chưa có bot reply | `{ state: "idle" }` |
| Bot message không có `type` | Frontend cũ / bug | `{ state: "idle" }` — defensive fallback |
| History rất dài | 50+ messages | Chỉ scan từ cuối lên — O(n) worst case, vẫn ≤ 1ms |

## Dependencies

**Upstream (phụ thuộc vào):**

- **NLP Parser (#4)** — CSM cung cấp context để NLP Parser parse đúng
- **Input Validator (#5)** — pipeline qua Input Validator sau khi CSM detect state
- **Backend API Gateway (#1)** — gọi `detectState()` trước khi route request

**Downstream (phụ thuộc vào CSM):**

- **Chat UI (#11)** — frontend phải tuân thủ contract lưu `type` trong history

## Configuration & Feature Flags

Không có config riêng. CSM là pure function stateless, không có thresholds hay flags.

## Non-Functional Requirements

- `detectState()` hoàn thành trong ≤ 1ms (scan array in-memory, no I/O)
- Stateless — mỗi call hoàn toàn độc lập

## Security Considerations

- Không xử lý PII trực tiếp — chỉ đọc `type` field từ history, không đọc `content`
- `conversationHistory` đến từ frontend — `type` field phải validate là một trong các giá trị hợp lệ trước khi dùng (đã handle bằng unknown→idle fallback)

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Empty/undefined history → `"idle"` | Jest |
| Unit | Last bot message `type: "clarify"` → `"awaiting_clarification"` | Jest |
| Unit | Last bot message `type: "results"` → `"results_shown"` | Jest |
| Unit | Last bot message `type: "error"` → `"idle"` | Jest |
| Unit | No bot messages in history → `"idle"` | Jest |
| Unit | Bot message missing `type` → `"idle"` | Jest |
| Unit | Long history (20+ messages) — scan đúng message cuối | Jest |

## Open Questions

- **`results_shown` routing**: Khi user gửi tin sau khi thấy kết quả, làm sao Gateway phân biệt "chọn chuyến bay" vs "tìm mới"? Hiện tại chưa định nghĩa detection logic này — cần spec rõ hơn ở Chat UI hoặc Gateway spec. Đây có thể là NLP Parser task (detect intent: `select_flight` vs `new_search`).
