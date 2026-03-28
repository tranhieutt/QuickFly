# Systems Index: QuickFly

## Tổng quan

- **Tổng số hệ thống**: 11
- **MVP**: 11 / 11 ✓ Tất cả đã thiết kế
- **Đã thiết kế**: 11
- **Chưa bắt đầu**: 0

---

## Danh sách hệ thống

| # | Tên | Layer | Priority | Trạng thái | GDD |
| --- | --- | --- | --- | --- | --- |
| 1 | Backend API Gateway | Foundation | MVP | Specced | [backend-api-gateway.md](specs/backend-api-gateway.md) |
| 2 | IATA Code Mapper | Foundation | MVP | Specced | [iata-code-mapper.md](specs/iata-code-mapper.md) |
| 3 | Error Handler | Foundation | MVP | Specced | [error-handler.md](specs/error-handler.md) |
| 4 | NLP Parser | Core | MVP | Specced | [nlp-parser.md](specs/nlp-parser.md) |
| 5 | Input Validator | Core | MVP | Specced | [input-validator.md](specs/input-validator.md) |
| 6 | Flight Search | Core | MVP | Specced | [flight-search.md](specs/flight-search.md) |
| 7 | Filter Engine | Feature | MVP | Specced | [filter-engine.md](specs/filter-engine.md) |
| 8 | Conversation State Manager | Feature | MVP | Specced | [conversation-state-manager.md](specs/conversation-state-manager.md) |
| 9 | Redirect Handler | Feature | MVP | Specced | [redirect-handler.md](specs/redirect-handler.md) |
| 10 | Result Display | Presentation | MVP | Specced | [result-display.md](specs/result-display.md) |
| 11 | Chat UI | Presentation | MVP | Specced | [chat-ui.md](specs/chat-ui.md) |

---

## Dependency Map

```text
FOUNDATION
├── Backend API Gateway     (không phụ thuộc ai — bottleneck, thiết kế trước)
├── IATA Code Mapper        (không phụ thuộc ai)
└── Error Handler           (không phụ thuộc ai)

CORE
├── NLP Parser              → Backend API Gateway, IATA Code Mapper
├── Input Validator         → NLP Parser
└── Flight Search           → Backend API Gateway, Input Validator

FEATURE
├── Filter Engine           → Flight Search
├── Conversation State Mgr  → NLP Parser, Input Validator
└── Redirect Handler        → Flight Search

PRESENTATION
├── Result Display          → Flight Search, Filter Engine
└── Chat UI                 → tất cả hệ thống trên
```

### Bottleneck Systems (rủi ro cao)

- **Backend API Gateway** — 4 hệ thống phụ thuộc trực tiếp. Thiết kế sai sẽ ảnh hưởng toàn bộ stack.

### Leaf Systems (rủi ro thấp)

- **Chat UI** — không có hệ thống nào phụ thuộc vào nó, thiết kế sau cùng.

### Circular Dependencies

- Không có.

---

## Thứ tự thiết kế (Design Order)

| Thứ tự | Hệ thống | Lý do |
| --- | --- | --- |
| 1 | Backend API Gateway | Foundation, bottleneck — thiết kế trước để unblock tất cả |
| 2 | IATA Code Mapper | Foundation, NLP Parser phụ thuộc vào đây |
| 3 | Error Handler | Foundation, cần xong trước khi thiết kế các Core systems |
| 4 | NLP Parser | Core đầu tiên — trái tim của pipeline |
| 5 | Input Validator | Core — cần NLP Parser xong trước |
| 6 | Flight Search | Core — cần Input Validator + API Gateway |
| 7 | Filter Engine | Feature — cần Flight Search |
| 8 | Conversation State Manager | Feature — cần NLP Parser + Input Validator |
| 9 | Redirect Handler | Feature — cần Flight Search |
| 10 | Result Display | Presentation — cần Flight Search + Filter Engine |
| 11 | Chat UI | Presentation — thiết kế sau cùng, bao bọc tất cả |

---

## Mô tả ngắn các hệ thống

### Foundation

**1. Backend API Gateway**
Express server làm trung gian giữa frontend và các API bên ngoài (Gemini, Amadeus). Giữ API keys không bị lộ ở frontend. Định nghĩa các route nội bộ mà Chat UI gọi tới.

**2. IATA Code Mapper**
Map tên thành phố tiếng Việt (chuẩn và không chuẩn) sang IATA airport code. Ví dụ: "hcm", "sài gòn", "tp hcm" → "SGN"; "hn", "hà nội" → "HAN".

**3. Error Handler**
Xử lý và chuẩn hóa lỗi từ Gemini API, Amadeus API, và lỗi nội bộ. Trả về thông báo thân thiện bằng tiếng Việt thay vì crash hoặc lỗi kỹ thuật.

### Core

**4. NLP Parser**
Gọi Gemini 2.5 Flash để parse câu tiếng Việt tự nhiên → JSON có cấu trúc (origin, destination, date, adults, filters). Xử lý các cách diễn đạt khác nhau của cùng một ý định.

**5. Input Validator**
Validate JSON output từ NLP Parser: kiểm tra field bắt buộc, kiểm tra định dạng ngày, kiểm tra IATA code hợp lệ. Phát hiện thiếu thông tin và tạo câu hỏi hỏi lại phù hợp.

**6. Flight Search**
Gọi Amadeus Flight Offers Search API với params đã validate. Nhận danh sách chuyến bay, chuẩn hóa dữ liệu, sắp xếp theo giá tăng dần.

### Feature

**7. Filter Engine**
Áp dụng bộ lọc lên kết quả Flight Search: lọc theo giờ bay (sáng 06:00–12:00 / chiều 12:00–18:00), lọc theo số điểm dừng (bay thẳng / có điểm dừng). Trả về top 3 sau khi lọc.

**8. Conversation State Manager**
Quản lý trạng thái hội thoại: đang chờ input mới / đang hỏi lại thiếu thông tin / đang hiển thị kết quả / đang chờ user chọn. Đảm bảo NLP Parser hiểu đúng ngữ cảnh của từng tin nhắn.

**9. Redirect Handler**
Nhận thông tin chuyến bay user chọn, tạo deep link hoặc URL booking của hãng bay tương ứng, thực hiện redirect.

### Presentation

**10. Result Display**
Format và hiển thị top 3 chuyến bay trong giao diện chat: tên hãng, giờ khởi hành/đến, số điểm dừng, giá, nút chọn. Responsive cho mobile.

**11. Chat UI**
Giao diện web chat hoàn chỉnh: ô nhập tin nhắn, luồng bong bóng hội thoại, trạng thái loading, hiển thị kết quả từ Result Display. Entry point duy nhất của người dùng.

---

## Cập nhật tiến độ

| Ngày | Sự kiện |
| --- | --- |
| 2026-03-28 | Systems index tạo lần đầu — 11 hệ thống, 0 đã thiết kế |
| 2026-03-28 | Backend API Gateway specced — 1/11 hoàn thành |
| 2026-03-28 | IATA Code Mapper specced — 2/11 hoàn thành |
| 2026-03-28 | Error Handler specced — 3/11 hoàn thành |
| 2026-03-28 | NLP Parser specced — 4/11 hoàn thành |
| 2026-03-28 | Input Validator specced — 5/11 hoàn thành |
| 2026-03-28 | Flight Search specced — 6/11 hoàn thành |
| 2026-03-28 | Filter Engine specced — 7/11 hoàn thành |
| 2026-03-28 | Conversation State Manager specced — 8/11 hoàn thành |
| 2026-03-28 | Redirect Handler specced — 9/11 hoàn thành |
| 2026-03-28 | Result Display specced — 10/11 hoàn thành |
| 2026-03-28 | Chat UI specced — 11/11 hoàn thành — Design phase COMPLETE |
