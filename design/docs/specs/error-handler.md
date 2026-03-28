# Error Handler

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Foundation

## Overview

Error Handler là một tầng middleware và class library trong Express backend, có hai vai trò: (1) định nghĩa các custom error class (`AppError`, `GeminiError`, `AmadeusError`, `ValidationError`) để các hệ thống phía trên có thể throw lỗi có cấu trúc; (2) một Express global error middleware đặt cuối pipeline, bắt mọi lỗi được throw hoặc pass qua `next(err)`, chuẩn hóa chúng thành response shape đã định nghĩa trong Backend API Gateway, và trả về thông báo tiếng Việt thân thiện — không bao giờ expose stack trace hay chi tiết kỹ thuật ra client.

## User Stories

**As a NLP Parser / Flight Search / any Core system**, I want to throw a typed error (`new GeminiError(...)`) and have it automatically formatted and returned to the client, so that I don't need to handle HTTP response formatting in business logic.

**As a Developer**, I want all unhandled exceptions to be caught by a single middleware, so that the server never crashes and always returns a structured response.

**As a Chat UI (frontend)**, I want error messages to be in friendly Vietnamese, so that I can display them directly to the user without translation.

## Acceptance Criteria

- [ ] `throw new GeminiError()` → response 503, `{ type: "error", payload: { message: "Dịch vụ AI tạm thời không khả dụng..." } }`
- [ ] `throw new AmadeusError()` → response 200, `{ type: "error", payload: { message: "Không thể tìm vé lúc này..." } }`
- [ ] `throw new ValidationError("...")` → response 400, `{ error: "..." }`
- [ ] `throw new Error("unhandled")` → response 500, `{ error: "Lỗi hệ thống, vui lòng thử lại" }` — không expose message gốc
- [ ] Mọi error response không chứa stack trace, file path, hoặc tên internal module
- [ ] Server KHÔNG crash khi có unhandled error — tiếp tục nhận request mới
- [ ] Mọi lỗi được log với: requestId, errorType, message, stack (server-side only)

## Technical Design

### API Contracts

Module này không expose HTTP endpoint. Cung cấp:

1. **Error classes** — import trực tiếp vào các modules khác
2. **Express error middleware** — mount vào Express app

```js
// Signature của các error classes
new GeminiError(detail?: string)
new AmadeusError(detail?: string)
new ValidationError(userMessage: string)
new NLPParseError()

// Mount middleware
app.use(globalErrorMiddleware);
```

### Data Models

Không lưu dữ liệu. Internal error type:

```js
class AppError extends Error {
  statusCode: number;    // HTTP status code
  type: string;          // "error" | "clarify" | "validation"
  userMessage: string;   // Tiếng Việt, trả về client
  isOperational: boolean; // true = lỗi có thể xử lý; false = bug thật
}
```

### State & Flow

```text
Bất kỳ system nào throw / next(err)
    → Express global error middleware
    → Kiểm tra instanceof AppError
      → isOperational + statusCode 200:
          res.status(200).json({ type, payload: { message: userMessage } })
      → isOperational + statusCode 4xx/5xx:
          res.status(statusCode).json({ error: userMessage })
      → Unknown error (bug thật):
          log full stack
          res.status(500).json({ error: "Lỗi hệ thống, vui lòng thử lại." })
```

### Business Rules

- `isOperational = true` → lỗi có thể xử lý, trả `userMessage` tiếng Việt ra client
- `isOperational = false` hoặc không phải AppError → bug thật, chỉ trả generic message
- `AmadeusError` dùng HTTP 200 vì đây là application flow, không phải HTTP error
- Log **luôn** ở server, kể cả operational errors (để debug)
- Không log nội dung `message` của user trong error context
- `userMessage` là string cứng từ class definition — không interpolate user input

**Error class reference:**

| Class | HTTP Status | Response type | userMessage |
| --- | --- | --- | --- |
| `GeminiError` | 503 | HTTP error | "Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau." |
| `AmadeusError` | 200 | `type: "error"` | "Không thể tìm vé lúc này, vui lòng thử lại sau." |
| `ValidationError` | 400 | HTTP error | Caller-provided (tiếng Việt) |
| `NLPParseError` | 200 | `type: "clarify"` | Caller-provided question |
| Unknown `Error` | 500 | HTTP error | "Lỗi hệ thống, vui lòng thử lại." |

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| Error không phải AppError | `throw new Error("...")` | Generic 500, không expose message |
| AppError với `userMessage` null | `NLPParseError` không set message | Caller phải set userMessage trước khi throw |
| Async error không catch | Unhandled Promise rejection | `express-async-errors` wrapper tự `next(err)` |
| Lỗi trong chính error middleware | Bug trong handler | Express default behavior, server không crash |

## Dependencies

**Upstream:** Không có.

**Downstream** (các hệ thống import và dùng error classes):

- NLP Parser (#4)
- Input Validator (#5)
- Flight Search (#6)
- Filter Engine (#7)
- Redirect Handler (#9)

**Library dependency:**

- `express-async-errors` (npm) — wrap async route handlers để unhandled promise rejections tự `next(err)` thay vì hang request

## Configuration & Feature Flags

Không có config riêng. Error Handler dùng logger từ app-level config (`LOG_LEVEL` đã định nghĩa trong API Gateway spec).

## Non-Functional Requirements

- Error middleware xử lý trong ≤ 5ms (chỉ format + log, không có I/O)
- Server không crash dù có lỗi bất kỳ — uptime không bị ảnh hưởng bởi individual request errors

## Security Considerations

- Không bao giờ trả stack trace, file path, tên module, SQL error, hoặc API error detail ra client
- Log chi tiết ở server-side; client chỉ nhận generic/friendly message
- `userMessage` là string cứng từ class definition — không interpolate user input vào message
- Không log nội dung message của user khi log error context

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | `GeminiError` → đúng statusCode 503, userMessage, type | Jest |
| Unit | `AmadeusError` → HTTP 200, `type: "error"` | Jest |
| Unit | `ValidationError` → HTTP 400 | Jest |
| Unit | Unknown error → 500, generic message, không expose detail | Jest |
| Integration | Express app: throw `GeminiError` → response shape đúng | Supertest |
| Integration | Async route throw → middleware bắt được (không hang) | Supertest |

## Open Questions

- Có cần thêm `RateLimitError` class không? Hiện tại rate limiting do middleware Express trả 429 trực tiếp, không qua Error Handler.
