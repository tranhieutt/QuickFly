# Risk Analysis: Amadeus API — QuickFly

**Ngày tạo**: 2026-03-28  
**Tác giả**: QuickFly Team  
**Phiên bản**: 1.0  

---

## 1. Tổng quan

Amadeus for Developers là API chính QuickFly sử dụng để tìm kiếm chuyến bay. Tài liệu này phân tích các rủi ro liên quan đến việc sử dụng API này trong bối cảnh thị trường hàng không Việt Nam.

---

## 2. Mức độ hỗ trợ các hãng bay Việt Nam

| Hãng bay | Trạng thái | Mức độ tích hợp | Ghi chú |
|----------|-----------|----------------|---------|
| **Vietnam Airlines** | ✅ Đầy đủ | Amadeus Altéa PSS | Tích hợp sâu nhất — inventory, reservation, ticketing đều qua Amadeus |
| **Bamboo Airways** | ✅ Đầy đủ | Amadeus Altéa PSS | Chọn Amadeus làm đối tác công nghệ chính thức |
| **VietJet Air** | ⚠️ Một phần | Amadeus GDS | LCC — bán vé chủ yếu trực tiếp, inventory trên GDS không đầy đủ |
| **Pacific Airlines** | ⚠️ Chưa xác nhận | Thuộc VN Airlines Group | Cần test thực tế để xác nhận |
| **Vietravel Airlines** | ❓ Không rõ | Chưa có thông tin | Hãng nhỏ, ít khả năng có trên GDS |

---

## 3. Rủi ro chi tiết

### 🔴 Rủi ro 1 — Sandbox không phản ánh thực tế

**Mức độ**: Cao  
**Xác suất**: Chắc chắn xảy ra  

**Mô tả**:  
Amadeus sandbox sử dụng dữ liệu mock từ năm 2019, không phải dữ liệu thật. Điều này có nghĩa:
- Giá vé trong sandbox **không chính xác** so với thị trường hiện tại
- Một số hãng bay (đặc biệt VietJet) có thể **không xuất hiện** trong kết quả sandbox
- Các chuyến bay, lịch trình trong sandbox **không tồn tại thực tế**

**Hệ quả**: Dev team có thể build xong và test ổn trên sandbox nhưng **fail khi chuyển production**.

**Giải pháp**:
- Không dùng giá/chuyến bay sandbox để trình bày với stakeholder
- Cần apply production access sớm để test với dữ liệu thật
- Ghi rõ trong UI khi demo: *"Đây là dữ liệu demo"*

---

### 🔴 Rủi ro 2 — VietJet Air thiếu inventory

**Mức độ**: Cao  
**Xác suất**: Cao  

**Mô tả**:  
VietJet Air là LCC (Low Cost Carrier) — mô hình kinh doanh ưu tiên bán vé trực tiếp qua app/web của hãng thay vì qua GDS như Amadeus. Hậu quả:

- Amadeus **chỉ có một phần** inventory của VietJet, không phải tất cả
- Các chuyến bay giờ thấp điểm, khuyến mãi flash sale của VietJet **sẽ không xuất hiện**
- Giá VietJet trên Amadeus có thể **cao hơn** giá mua trực tiếp tại vietjetair.com
- Người dùng so sánh → mất niềm tin vào QuickFly

**Hệ quả**: QuickFly sẽ không thể hiển thị đầy đủ các lựa chọn VietJet, ảnh hưởng đến trải nghiệm người dùng.

**Giải pháp ngắn hạn (MVP)**:
- Accept giới hạn này, ghi vào disclaimer UI
- Ưu tiên hiển thị Vietnam Airlines + Bamboo Airways (đầy đủ hơn)

**Giải pháp dài hạn (Post-MVP)**:
- Liên hệ VietJet Air để xin truy cập API trực tiếp của hãng
- Hoặc tích hợp thêm nguồn dữ liệu như AviationStack

---

### 🟡 Rủi ro 3 — Production access bị từ chối hoặc chậm

**Mức độ**: Trung bình  
**Xác suất**: Trung bình  

**Mô tả**:  
Amadeus Production Access yêu cầu doanh nghiệp phải có:
- Booking engine hoàn chỉnh (không chỉ search)
- Giấy phép kinh doanh du lịch hợp lệ tại một số quốc gia
- Quy trình review có thể mất **2–4 tuần**

QuickFly hiện tại chỉ **search + redirect**, không có booking engine riêng → có thể không đủ điều kiện.

**Hệ quả**: Ứng dụng bị giới hạn ở sandbox data, không thể launch production.

**Giải pháp**:
- Apply production access **sớm** (không đợi code xong)
- Chuẩn bị use case rõ ràng: "travel search aggregator with redirect"
- Nếu bị từ chối → cân nhắc chuyển sang Skyscanner API hoặc Kiwi.com API

---

### 🟡 Rủi ro 4 — Rate Limiting & Quota

**Mức độ**: Trung bình  
**Xác suất**: Trung bình  

**Mô tả**:  
Amadeus Self-Service API có giới hạn:

| Plan | Request/tháng | Chi phí |
|------|--------------|---------|
| Free (test) | 2,000 | Miễn phí |
| Production | Theo thỏa thuận | Trả phí |

Nếu QuickFly có lượng user tăng đột ngột → vượt quota → API trả lỗi `429 Too Many Requests`.

**Giải pháp**:
- Implement **caching** kết quả tìm kiếm (cache 5–10 phút cho cùng route + ngày)
- Monitor quota usage hàng ngày
- Thiết lập alert khi đạt 80% quota

---

### 🟢 Rủi ro 5 — API Timeout / Downtime

**Mức độ**: Thấp–Trung bình  
**Xác suất**: Thấp  

**Mô tả**:  
Amadeus API có SLA tốt nhưng không đảm bảo 100% uptime. Nếu API timeout hoặc down:
- QuickFly sẽ không trả được kết quả
- Người dùng nhận thông báo lỗi → mất trải nghiệm

**Giải pháp**:  
- Đã xử lý trong `Error Handler` system (system #3)
- Timeout mặc định: 8,000ms (config `API_TIMEOUT_MS`)
- Fallback message tiếng Việt thân thiện thay vì crash

---

## 4. Ma trận rủi ro

```
Xác suất
  Cao  │  [R2 VietJet]  [R1 Sandbox]        
       │                                     
 Trung │  [R4 Quota]    [R3 Production]      
       │                                     
  Thấp │                [R5 Timeout]         
       └──────────────────────────────────
          Thấp          Trung         Cao
                          Mức độ ảnh hưởng
```

---

## 5. Phương án thay thế nếu Amadeus không đáp ứng

| API | Ưu điểm | Nhược điểm | Chi phí |
|-----|---------|-----------|---------|
| **Skyscanner API** | Coverage rộng, có VietJet | Cần partnership, khó xin access | Theo thỏa thuận |
| **Kiwi.com (Tequila API)** | Dễ đăng ký, flexible | Coverage Việt Nam chưa rõ | Free tier có |
| **AviationStack** | Real-time flight data | Chỉ có flight status, không có giá | Free 500 calls/tháng |
| **Scraping trực tiếp** | Đầy đủ nhất | Không bền vững, vi phạm ToS | Miễn phí nhưng rủi ro legal |

**Khuyến nghị**: Giữ Amadeus cho MVP. Nếu bị block production → chuyển Kiwi.com (Tequila).

---

## 6. Action Items

| # | Hành động | Ưu tiên | Thời điểm |
|---|----------|---------|----------|
| 1 | Apply Amadeus Production Access ngay khi có prototype | 🔴 Cao | Trước khi code xong |
| 2 | Test sandbox với các route SGN→HAN, SGN→DAD xem VietJet có xuất hiện không | 🔴 Cao | Sprint 1 |
| 3 | Implement response caching để giảm quota consumption | 🟡 Trung bình | Sprint 2 |
| 4 | Chuẩn bị fallback API (Kiwi.com) nếu production bị từ chối | 🟡 Trung bình | Song song với Sprint 2 |
| 5 | Thêm disclaimer trong UI về phạm vi coverage của bot | 🟢 Thấp | Sprint 3 (UI) |

---

## 7. Kết luận

**Amadeus là lựa chọn phù hợp cho MVP của QuickFly** với các điều kiện:

✅ Vietnam Airlines và Bamboo Airways được hỗ trợ đầy đủ  
✅ API tài liệu tốt, SDK có sẵn cho Node.js  
✅ Sandbox miễn phí để phát triển  

⚠️ Cần chấp nhận các giới hạn:  
- VietJet Air sẽ **không đầy đủ** (đặc biệt giá rẻ và flash sale)  
- Sandbox data **không phải giá thật**  
- Production access có thể mất thêm thời gian  

> **Quyết định**: Tiếp tục với Amadeus cho MVP. Review lại sau khi test thực tế trên sandbox ở Sprint 1.
