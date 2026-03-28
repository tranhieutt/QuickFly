# Session State: QuickFly

## Dự án

**Tên**: QuickFly — Web chat bot đặt vé máy bay bằng tiếng Việt tự nhiên
**Thư mục**: `D:/Travel-Bot-Engine/`
**Ngày bắt đầu**: 2026-03-28

## Trạng thái hiện tại

- [x] Brainstorm concept → chọn Concept 3 (QuickFly)
- [x] Product Concept Document → `design/docs/product-concept.md`
- [x] Systems Index → `design/docs/systems-index.md`
- [x] Thiết kế hệ thống #1: Backend API Gateway → `design/docs/specs/backend-api-gateway.md`
- [x] Thiết kế hệ thống #2: IATA Code Mapper → `design/docs/specs/iata-code-mapper.md`
- [x] Thiết kế hệ thống #3: Error Handler → `design/docs/specs/error-handler.md`
- [x] Thiết kế hệ thống #4: NLP Parser → `design/docs/specs/nlp-parser.md`
- [x] Thiết kế hệ thống #5: Input Validator → `design/docs/specs/input-validator.md`
- [x] Thiết kế hệ thống #6: Flight Search → `design/docs/specs/flight-search.md`
- [x] Thiết kế hệ thống #7: Filter Engine → `design/docs/specs/filter-engine.md`
- [x] Thiết kế hệ thống #8: Conversation State Manager → `design/docs/specs/conversation-state-manager.md`
- [x] Thiết kế hệ thống #9: Redirect Handler → `design/docs/specs/redirect-handler.md`
- [x] Thiết kế hệ thống #10: Result Display → `design/docs/specs/result-display.md`
- [x] Thiết kế hệ thống #11: Chat UI → `design/docs/specs/chat-ui.md`
- [x] Design phase hoàn chỉnh — 11/11 hệ thống đã spec
- [x] Implementation — tất cả module backend + frontend đã viết code
- [x] Tests — 4 test files, 40 tests passing
- [x] Migration: Amadeus → Duffel API (flight-search.js rewrite, config update, specs update)
- [x] Full source code commit — backend + frontend + README (2026-03-28)
- [x] Repository pushed lên origin/main — working tree clean
- [ ] End-to-end test với real API keys (GEMINI_API_KEY + DUFFEL_TOKEN)

## Bước tiếp theo

**Codebase hoàn chỉnh, repo đã push.** Bước duy nhất còn lại là test với real API keys.

1. Tạo `.env` từ `.env.example` ở thư mục `backend/`, điền `GEMINI_API_KEY` và `DUFFEL_TOKEN` (duffel_test_...)
2. Chạy `npm run dev` trong `backend/` và `npm run dev` trong `frontend/`
3. Test manual: nhập "HCM đi Hà Nội ngày 10/4" → verify top 3 kết quả hiển thị đúng
4. (Optional) Deploy: Vercel cho frontend, Railway cho backend

## Quyết định đã chốt

- **AI/NLP**: Gemini 2.5 Flash
- **Flight API**: Duffel Air API (Bearer token, sandbox miễn phí) — chuyển từ Amadeus do Amadeus Self-Service bị decommission
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Deploy**: Vercel (frontend) + Railway (backend)
- **Thanh toán**: Redirect sang hãng bay (không tích hợp thanh toán trong app)
- **Auth**: Không cần đăng nhập
- **Lịch sử**: Không lưu lịch sử tìm kiếm (MVP)
- **Ngôn ngữ bot**: Tiếng Việt là chính
- **API Gateway**: 1 endpoint duy nhất `POST /chat`, stateless
- **Response format**: `{ type, payload }` — type: `"results"` | `"clarify"` | `"error"`
- **Giá vé**: Convert sang VND trước khi trả về
- **IATA Mapper**: airports.json + lowercase + strip diacritics, trả `null` nếu không tìm thấy
- **Input Validator**: Pure function, throw-on-first-error, `MAX_ADULTS=9` hardcoded (Duffel constraint)
- **Flight Search**: `max_connections: 0` khi `filters.stops="direct"` (optimize tại Duffel API level), fetch 15 offers, sort by price, convert sang VND. No retry (Bearer token không expire).
- **Filter Engine**: Pure function, chỉ lọc `timeOfDay` (stops đã xử lý ở Flight Search). morning=06:00–11:59, afternoon=12:00–17:59. FilterError nếu 0 kết quả.
- **Conversation State Manager**: Detect state từ history (idle/awaiting_clarification/results_shown). Frontend phải lưu `type` field trong bot messages.

## Files quan trọng

- `design/docs/product-concept.md` — concept đầy đủ
- `design/docs/systems-index.md` — 11 hệ thống + dependency map + thứ tự thiết kế
- `design/docs/specs/backend-api-gateway.md` — spec hệ thống #1 (Specced)
- `design/docs/specs/iata-code-mapper.md` — spec hệ thống #2 (Specced)
- `design/docs/specs/error-handler.md` — spec hệ thống #3 (Specced)
- `design/docs/specs/nlp-parser.md` — spec hệ thống #4 (Specced)
- `design/docs/specs/input-validator.md` — spec hệ thống #5 (Specced)
- `session-state.md` — file này

## Cách resume

Nói với Claude: *"Tiếp tục dự án QuickFly tại D:/Travel-Bot-Engine, đọc session-state.md để lấy context"*
