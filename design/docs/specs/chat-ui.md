# Chat UI

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Presentation

## Overview

Chat UI là React application là entry point duy nhất của người dùng, deploy trên Vercel. Giao diện web chat gồm: luồng bong bóng hội thoại (user bên phải, bot bên trái), ô nhập tin nhắn với nút gửi, loading indicator khi chờ API, và tích hợp `FlightResultList` để hiển thị kết quả ngay trong luồng chat. Frontend tự quản lý `conversationHistory` (thêm vào sau mỗi tin nhắn), gửi lên Gateway theo mỗi request. Bot messages được lưu với `type` field để Conversation State Manager có thể detect state. Không có auth, không có lịch sử lưu trên server — mỗi phiên browser là một session mới.

## User Stories

**As a user**, I want to type a natural Vietnamese message and see results in the chat, so that I can find flights without navigating to a separate search page.

Acceptance Criteria:

- Given I type "HCM đi Hà Nội ngày 5/4" and press Send, then the bot responds with flight results or a clarify question within 8s

**As a user**, I want to see a loading indicator while the bot is searching, so that I know the app is working.

Acceptance Criteria:

- Given I press Send, then a loading indicator appears immediately and disappears when the response arrives

**As a user**, I want to see a follow-up question when my search is incomplete, so that I can provide missing information naturally.

Acceptance Criteria:

- Given the bot asks "Bạn muốn bay ngày nào?", when I type a date and send, then the bot continues the conversation with the same context

**As a user on mobile**, I want the chat to work on my phone, so that I can search flights on the go.

Acceptance Criteria:

- Given viewport 375px, when I use the chat, then all elements are usable without horizontal scroll

## Acceptance Criteria

- [ ] Gõ tin nhắn + Enter hoặc click nút Gửi → request đến `POST /chat` với `message` và `conversationHistory`
- [ ] Loading indicator hiển thị ngay sau khi gửi, biến mất khi nhận response
- [ ] `type: "results"` → render `<FlightResultList>` trong luồng chat (bot bubble)
- [ ] `type: "clarify"` → render bot text bubble với câu hỏi
- [ ] `type: "error"` → render bot text bubble với thông báo lỗi
- [ ] HTTP 4xx/5xx → render "Có lỗi xảy ra, vui lòng thử lại." trong bot bubble
- [ ] `conversationHistory` được cập nhật sau mỗi tin nhắn (user và bot), gửi lên mỗi request
- [ ] Bot messages được lưu với `type` field trong history
- [ ] Input bị disable khi đang loading, enable lại sau khi nhận response
- [ ] Scroll tự động xuống message mới nhất sau mỗi tin
- [ ] Responsive: hoạt động đúng trên 375px viewport

## Technical Design

### API Contracts

Frontend gọi:

```http
POST {VITE_API_URL}/chat
Content-Type: application/json

{
  "message": "string",
  "conversationHistory": HistoryItem[]
}
```

Responses theo API Gateway spec: `{ type, payload }` hoặc `{ error }`.

### Data Models

```ts
// App state
interface ChatState {
  messages: ChatMessage[];
  conversationHistory: HistoryItem[];
  isLoading: boolean;
  inputValue: string;
}

// UI message (hiển thị)
interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string | FlightOffer[];  // string cho text, FlightOffer[] cho results
  type?: "clarify" | "results" | "error";
  timestamp: Date;
}

// History item (gửi lên API — bao gồm type để CSM detect state)
interface HistoryItem {
  role: "user" | "bot";
  content: string;       // text representation
  type?: "clarify" | "results" | "error";
}
```

### State & Flow

```text
User gõ tin nhắn → click Gửi / Enter
    │
    ▼
[1] Add user message vào messages[] và conversationHistory[]
[2] Set isLoading = true, disable input
    │
    ▼
[3] POST /chat { message, conversationHistory }
    │  (timeout 10s ở client để bắt khi backend 8s + network latency)
    │
    ▼
[4] Nhận response:
    ├── type: "results" → add bot message { content: payload, type: "results" }
    ├── type: "clarify" → add bot message { content: payload.question, type: "clarify" }
    ├── type: "error"   → add bot message { content: payload.message, type: "error" }
    └── HTTP error      → add bot message { content: "Có lỗi xảy ra, vui lòng thử lại." }
    │
    ▼
[5] Add bot message vào conversationHistory[] (với type field)
[6] Set isLoading = false, enable input
[7] Scroll to bottom
```

### Business Rules

- **conversationHistory**: lưu tất cả messages, không giới hạn độ dài trong MVP
- **type trong history**: bot messages phải có `type` field — bắt buộc cho CSM
- **history content**: bot `type: "results"` → lưu content là text `"[Kết quả: N chuyến bay]"` (không lưu full FlightOffer array trong history để giảm size)
- **Input validation**: không gửi nếu input rỗng hoặc chỉ chứa whitespace
- **Không lưu lịch sử**: reload browser → history mất — thiết kế theo MVP spec

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| Input rỗng | User nhấn gửi không có text | Không gửi, input shake animation |
| Network timeout | API không phản hồi sau 10s | Bot bubble: "Kết nối bị gián đoạn, vui lòng thử lại." |
| API 429 | Rate limit hit | Bot bubble: hiển thị `error` message từ API |
| API 503 | Backend down | Bot bubble: "Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau." |
| Rapid sending | User gửi nhiều tin liên tiếp | Input disabled khi loading — chặn double-send |
| Rất nhiều tin | 50+ messages | Render tất cả, scroll performance chấp nhận được |
| Mobile keyboard | Keyboard che input | Input sticky to bottom, scroll viewport lên |

## Dependencies

**Upstream (phụ thuộc vào):**

- **Backend API Gateway (#1)** — `POST /chat` endpoint, response format
- **Conversation State Manager (#8)** — contract: frontend phải lưu `type` trong history
- **Result Display (#10)** — `<FlightResultList>` component embed trong chat
- **Redirect Handler (#9)** — `bookingUrl` trong FlightOffer cho Result Display

**Downstream:** Không có — Chat UI là leaf node.

**Tech:**

- **React** — UI framework
- **Tailwind CSS** — styling
- **Vercel** — deployment

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `VITE_API_URL` | string | `"http://localhost:3000"` | Backend URL — Vercel env var trong production |

## Non-Functional Requirements

- First Contentful Paint ≤ 1.5s (Vercel CDN, minimal bundle)
- Input → response hiển thị trong ≤ 8s (bị giới hạn bởi API timeout)
- Bundle size ≤ 200KB gzipped (React + Tailwind, không có heavy dependencies)
- Responsive: 375px → 1280px

## Security Considerations

- `VITE_API_URL` là URL backend — public (không phải secret). Chỉ trỏ đến backend Railway của mình.
- Không lưu API keys ở frontend — tất cả keys ở backend
- User input được send as-is đến backend — backend có validation và rate limiting
- Không có `dangerouslySetInnerHTML` — bot messages render as plain text (không có XSS risk từ response)
- CORS: backend chỉ cho phép Vercel domain (đã cấu hình trong API Gateway)

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Gửi message → conversationHistory cập nhật đúng | Jest + React Testing Library |
| Unit | `type: "results"` response → render FlightResultList | Jest |
| Unit | `type: "clarify"` → render text bubble | Jest |
| Unit | Loading state: disable input khi isLoading | Jest |
| Unit | Empty input → không gửi | Jest |
| Manual/E2E | Happy path: nhập câu tiếng Việt → kết quả thật từ Amadeus sandbox | Manual / Playwright |
| Manual | Mobile: 375px viewport — usable | Manual |
| Manual | API timeout simulation → error bubble hiển thị | Manual |

## Open Questions

- **Welcome message**: Bot có tự chào khi mở app không? ("Xin chào! Bạn muốn tìm chuyến bay đi đâu?") hay chờ user gõ trước?
- **History size limit**: MVP pass toàn bộ history — nếu session dài (30+ tin) Gemini token cost tăng. Khi nào cần trim?
