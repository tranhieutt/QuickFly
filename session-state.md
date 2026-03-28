# Session State: QuickFly

## Dự án
**Tên**: QuickFly — Web chat bot đặt vé máy bay bằng tiếng Việt tự nhiên
**Thư mục**: `D:/Travel-Bot-Engine/`
**Ngày bắt đầu**: 2026-03-28

## Trạng thái hiện tại
- [x] Brainstorm concept → chọn Concept 3 (QuickFly)
- [x] Product Concept Document → `design/docs/product-concept.md`
- [x] Systems Index → `design/docs/systems-index.md`
- [ ] Thiết kế chi tiết từng hệ thống (`/design-system`)
- [ ] Prototype
- [ ] Sprint Plan

## Bước tiếp theo
Chạy `/design-system` để thiết kế hệ thống đầu tiên: **Backend API Gateway**
(Thứ tự: 1/11 — Foundation layer, bottleneck của toàn bộ stack)

## Quyết định đã chốt
- **AI/NLP**: Gemini 2.5 Flash
- **Flight API**: Amadeus for Developers (sandbox miễn phí)
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Deploy**: Vercel (frontend) + Railway (backend)
- **Thanh toán**: Redirect sang hãng bay (không tích hợp thanh toán trong app)
- **Auth**: Không cần đăng nhập
- **Lịch sử**: Không lưu lịch sử tìm kiếm (MVP)
- **Ngôn ngữ bot**: Tiếng Việt là chính

## Files quan trọng
- `design/docs/product-concept.md` — concept đầy đủ
- `design/docs/systems-index.md` — 11 hệ thống + dependency map + thứ tự thiết kế
- `session-state.md` — file này

## Cách resume
Nói với Claude: *"Tiếp tục dự án QuickFly tại D:/Travel-Bot-Engine, đọc session-state.md để lấy context"*
