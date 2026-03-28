# ✈️ QuickFly

> **Đặt vé máy bay bằng tiếng Việt tự nhiên — không cần điền form, không cần mở nhiều tab.**

QuickFly là một web chat bot giúp người dùng tìm kiếm chuyến bay thông qua hội thoại tự nhiên bằng tiếng Việt. Chỉ cần nhập một câu mô tả chuyến đi, bot sẽ hiển thị ngay top 3 chuyến bay phù hợp và redirect sang website hãng bay để thanh toán.

---

## 🎯 Demo nhanh

```
👤 Bạn: "HCM đi Hà Nội ngày 5/4, 1 người lớn, bay thẳng"

🤖 QuickFly: Tìm thấy 3 chuyến phù hợp:

┌─────────────────────────────────────────┐
│ ✈️  VietJet Air                          │
│  SGN → HAN  |  07:00 – 09:20  |  Bay thẳng │
│  💰 859,000 VNĐ          [Chọn chuyến này] │
├─────────────────────────────────────────┤
│ ✈️  Vietnam Airlines                     │
│  SGN → HAN  |  08:30 – 10:55  |  Bay thẳng │
│  💰 1,250,000 VNĐ        [Chọn chuyến này] │
├─────────────────────────────────────────┤
│ ✈️  Bamboo Airways                       │
│  SGN → HAN  |  10:00 – 12:20  |  Bay thẳng │
│  💰 1,100,000 VNĐ        [Chọn chuyến này] │
└─────────────────────────────────────────┘
```

---

## ✨ Tính năng

- 🗣️ **Giao tiếp tự nhiên** — Hiểu tiếng Việt thông thường, không cần cú pháp đặc biệt
- ⚡ **Kết quả nhanh** — Từ ý định đến top 3 chuyến bay trong dưới 5 giây
- 🔍 **Bộ lọc thông minh** — Lọc bay thẳng, giờ sáng/chiều ngay trong chat
- 🔗 **Redirect trực tiếp** — Bấm chọn → chuyển thẳng đến trang đặt vé của hãng
- 📱 **Responsive** — Dùng tốt trên cả mobile và desktop
- 🔒 **Không cần đăng ký** — Không tài khoản, không lưu lịch sử

---

## 🏗️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| AI / NLP | Gemini 2.5 Flash |
| Flight API | Amadeus for Developers |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |

---

## 🧠 Cách hoạt động

```
Người dùng nhập tiếng Việt
        ↓
Gemini 2.5 Flash parse câu lệnh
        ↓
Output JSON: { origin, destination, date, adults, filters }
        ↓
Amadeus Flight Offers Search API
        ↓
Filter Engine (bay thẳng / giờ bay)
        ↓
Top 3 kết quả hiển thị trong chat
        ↓
User chọn → Redirect sang trang hãng bay
```

---

## 🗂️ Cấu trúc Project

```
QuickFly/
├── design/
│   └── docs/
│       ├── product-concept.md     # Product concept & requirements
│       └── systems-index.md       # 11 hệ thống + dependency map
├── session-state.md               # Trạng thái dự án hiện tại
└── README.md
```

> **Lưu ý**: Dự án đang ở giai đoạn thiết kế hệ thống. Code sẽ được thêm trong các sprint tiếp theo.

---

## ⚙️ 11 Hệ thống cần xây dựng

| # | Hệ thống | Layer | Trạng thái |
|---|----------|-------|-----------|
| 1 | Backend API Gateway | Foundation | 🔲 Chưa bắt đầu |
| 2 | IATA Code Mapper | Foundation | 🔲 Chưa bắt đầu |
| 3 | Error Handler | Foundation | 🔲 Chưa bắt đầu |
| 4 | NLP Parser | Core | 🔲 Chưa bắt đầu |
| 5 | Input Validator | Core | 🔲 Chưa bắt đầu |
| 6 | Flight Search | Core | 🔲 Chưa bắt đầu |
| 7 | Filter Engine | Feature | 🔲 Chưa bắt đầu |
| 8 | Conversation State Manager | Feature | 🔲 Chưa bắt đầu |
| 9 | Redirect Handler | Feature | 🔲 Chưa bắt đầu |
| 10 | Result Display | Presentation | 🔲 Chưa bắt đầu |
| 11 | Chat UI | Presentation | 🔲 Chưa bắt đầu |

---

## 🚀 Bắt đầu phát triển

### Yêu cầu

- Node.js 20+
- API key: [Google AI Studio](https://aistudio.google.com/) (Gemini 2.5 Flash)
- API key: [Amadeus for Developers](https://developers.amadeus.com/) (sandbox miễn phí)

### Cài đặt

```bash
# Clone repo
git clone https://github.com/tranhieutt/QuickFly.git
cd QuickFly

# Backend
cd backend
npm install
cp .env.example .env     # Điền API keys vào .env
npm run dev

# Frontend (terminal mới)
cd frontend
npm install
npm run dev
```

### Biến môi trường

```env
GEMINI_API_KEY=your_gemini_api_key
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
AMADEUS_ENV=test              # test | production
```

---

## 📋 MVP Definition

> Một web chat cho phép người dùng tìm kiếm chuyến bay bằng tiếng Việt tự nhiên, xem top 3 kết quả với bộ lọc cơ bản, và redirect sang hãng bay để thanh toán — không cần đăng nhập.

### Acceptance Criteria

- [ ] Nhập 1 câu tiếng Việt → hiển thị top 3 chuyến trong vòng 5 giây
- [ ] Bot hiểu đúng: điểm đi, điểm đến, ngày, số hành khách
- [ ] Bộ lọc "bay thẳng" và "sáng/chiều" hoạt động đúng
- [ ] Bấm chọn chuyến → redirect đúng sang trang hãng bay
- [ ] Bot hỏi lại khi thiếu thông tin thay vì báo lỗi
- [ ] Hoạt động trên mobile browser (responsive)

---

## 📌 Product Pillars

| Pillar | Nguyên tắc |
|--------|-----------|
| ⚡ **Tốc độ** | Nếu chọn giữa thêm filter vs. hiện kết quả nhanh hơn → chọn nhanh hơn |
| 🎯 **Đơn giản** | Nếu chọn giữa UI đẹp hơn vs. ít click hơn → chọn ít click hơn |
| ✅ **Tin cậy** | Nếu dữ liệu không chắc chắn → không hiển thị, không đoán mò |

### Anti-features (KHÔNG xây)
- ❌ Trang profile / tài khoản
- ❌ So sánh khách sạn / tour
- ❌ Thanh toán trong app

---

## 📅 Roadmap

- [x] Product Concept Document
- [x] Systems Index (11 hệ thống)
- [ ] Thiết kế chi tiết từng hệ thống
- [ ] Sprint Plan
- [ ] Prototype
- [ ] MVP Launch

---

## 📄 License

MIT License — Free to use and modify.
