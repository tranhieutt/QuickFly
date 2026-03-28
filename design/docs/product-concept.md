# Product Concept: QuickFly

## Overview

QuickFly là một web chat bot giúp người dùng cá nhân tìm kiếm và chọn vé máy bay thông qua hội thoại tự nhiên bằng tiếng Việt. Thay vì điều hướng qua các giao diện đặt vé phức tạp, người dùng chỉ cần nhập một câu mô tả chuyến đi và bot sẽ hiển thị ngay top 3 chuyến bay phù hợp, sau đó redirect sang website hãng bay để thanh toán.

---

## User Value

Người dùng không cần mở nhiều tab, không cần điền form dài, không cần tự lọc kết quả. Chỉ cần nói như nhắn tin cho bạn bè — bot lo phần còn lại. Trải nghiệm đặt vé từ ý định đến kết quả dưới 2 phút.

---

## Detailed Requirements

1. Giao diện web chat — không có trang nào khác ngoài ô chat
2. Bot nhận câu lệnh tiếng Việt tự nhiên (ví dụ: "HCM đi Hà Nội ngày 5/4, 1 người lớn")
3. Gemini 2.5 Flash parse câu lệnh → trích xuất: điểm đi, điểm đến, ngày bay, số hành khách
4. Amadeus API tìm kiếm chuyến bay phù hợp
5. Bot hiển thị top 3 kết quả (giá, giờ bay, hãng, số điểm dừng)
6. Hỗ trợ bộ lọc cơ bản qua chat: sáng/chiều, bay thẳng/có điểm dừng
7. Người dùng chọn chuyến → bot redirect sang trang đặt vé của hãng bay
8. Không yêu cầu đăng nhập, không lưu lịch sử tìm kiếm

---

## Formulas / Algorithms

### NLP Parsing Pipeline

```
Input: chuỗi văn bản tiếng Việt từ người dùng
  ↓
Gemini 2.5 Flash (prompt engineering)
  ↓
Output JSON: {
  origin: "SGN",         // IATA code
  destination: "HAN",   // IATA code
  departureDate: "2026-04-05",
  adults: 1,
  tripType: "one-way" | "round-trip",
  filters: {
    timeOfDay: "morning" | "afternoon" | null,
    stops: "direct" | "any"
  }
}
  ↓
Amadeus Flight Offers Search API
  ↓
Sort by price ASC → top 3 results
```

### Ranking Logic
- Mặc định: sắp xếp theo giá thấp nhất
- Nếu filter "bay thẳng": loại bỏ chuyến có điểm dừng trước khi lấy top 3
- Nếu filter "sáng": chỉ lấy chuyến khởi hành 06:00–12:00
- Nếu filter "chiều": chỉ lấy chuyến khởi hành 12:00–18:00

---

## Edge Cases

| Tình huống | Xử lý |
|-----------|-------|
| Câu lệnh thiếu thông tin (không có ngày) | Bot hỏi lại: "Bạn muốn bay ngày nào?" |
| Không tìm thấy chuyến bay | Bot thông báo và gợi ý thay đổi ngày |
| Amadeus API lỗi / timeout | Hiển thị thông báo lỗi thân thiện, không crash |
| Tên thành phố viết tắt hoặc không chuẩn ("hcm", "hn", "đn") | Gemini map sang IATA code |
| Câu lệnh không liên quan đến đặt vé | Bot từ chối nhẹ nhàng và hướng dẫn lại |

---

## Dependencies

- **Gemini 2.5 Flash API** — Google AI Studio, parse NLP tiếng Việt
- **Amadeus for Developers API** — tìm kiếm chuyến bay (Flight Offers Search)
- **React + Tailwind CSS** — frontend web chat UI
- **Node.js + Express** — backend API server
- **Vercel** — deploy frontend
- **Railway** — deploy backend

---

## Configuration Parameters

| Parameter | Giá trị mặc định | Ghi chú |
|-----------|-----------------|---------|
| `MAX_RESULTS` | 3 | Số chuyến hiển thị tối đa |
| `AMADEUS_ENV` | `test` | `test` cho sandbox, `production` cho thật |
| `DEFAULT_LANGUAGE` | `vi` | Ngôn ngữ giao tiếp của bot |
| `API_TIMEOUT_MS` | 8000 | Timeout Amadeus API (ms) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model NLP |

---

## Product Pillars

### 1. Tốc độ
Từ ý định đến kết quả trong ít bước nhất có thể.
> Design test: Nếu chọn giữa thêm filter vs. hiện kết quả nhanh hơn → chọn nhanh hơn.

### 2. Đơn giản
Không có giao diện nào ngoài ô chat.
> Design test: Nếu chọn giữa UI đẹp hơn vs. ít click hơn → chọn ít click hơn.

### 3. Tin cậy
Thông tin vé chính xác, redirect đúng chỗ.
> Design test: Nếu dữ liệu không chắc chắn → không hiển thị, không đoán mò.

### Anti-pillars (KHÔNG xây)
- Không xây trang profile / tài khoản
- Không xây so sánh khách sạn / tour
- Không xây thanh toán trong app

---

## Acceptance Criteria

- [ ] Người dùng nhập 1 câu tiếng Việt → bot hiển thị top 3 chuyến trong vòng 5 giây
- [ ] Bot hiểu đúng: điểm đi, điểm đến, ngày, số hành khách từ câu tự nhiên
- [ ] Bộ lọc "bay thẳng" và "sáng/chiều" hoạt động đúng
- [ ] Bấm chọn chuyến → redirect đúng sang trang hãng bay
- [ ] Bot hỏi lại khi thiếu thông tin thay vì báo lỗi
- [ ] Hoạt động trên mobile browser (responsive)

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| AI/NLP | Gemini 2.5 Flash |
| Flight API | Amadeus for Developers |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |

---

## MVP Definition

> Một web chat cho phép người dùng tìm kiếm chuyến bay bằng tiếng Việt tự nhiên, xem top 3 kết quả với bộ lọc cơ bản, và redirect sang hãng bay để thanh toán — không cần đăng nhập.

## Biggest Risk

> Amadeus sandbox chỉ có dữ liệu mock, không phản ánh giá/chuyến bay thật. Cần test kỹ luồng parse NLP → Amadeus trước khi chuyển production.
