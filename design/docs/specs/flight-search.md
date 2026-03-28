# Flight Search

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28 (updated: Amadeus → Duffel)
> **Priority**: MVP
> **Layer**: Core

## Overview

Flight Search là module Core trong backend, chịu trách nhiệm gọi Duffel Air API với `ParsedIntent` đã được validate, nhận danh sách chuyến bay thô, chuẩn hóa về `FlightOffer` schema thống nhất, convert giá sang VND, và trả về danh sách đã sắp xếp theo giá tăng dần. Auth dùng Bearer token đơn giản (không cần OAuth2 flow). Không áp dụng filter — đó là việc của Filter Engine. Nếu Duffel lỗi hoặc trả về 0 kết quả → throw `AmadeusError` (error class giữ nguyên để không ảnh hưởng phần còn lại của pipeline).

> **Note**: Ban đầu thiết kế dùng Amadeus. Amadeus Self-Service đã bị decommission — chuyển sang Duffel API.

## User Stories

**As a Backend API Gateway**, I want to call `searchFlights(intent)` and receive a normalized `FlightOffer[]` sorted by price, so that I can pass the list to Filter Engine without knowing anything about Duffel API.

Acceptance Criteria:

- Given valid `ParsedIntent`, when `searchFlights()` is called, then returns `FlightOffer[]` sorted by price ascending, price in VND
- Given valid intent, when called, then result contains ≥ 1 offer (or throws `AmadeusError` if 0)

**As a Filter Engine**, I want to receive a raw list of ≥ 10 offers sorted by price, so that I have enough candidates to apply timeOfDay filters and still return top 3.

Acceptance Criteria:

- Given `ParsedIntent` with `filters.stops: "any"`, when `searchFlights()` returns, then list contains up to 15 offers before filtering
- Given `ParsedIntent` with `filters.stops: "direct"`, when `searchFlights()` returns, then list contains only direct flights (fetched with `max_connections: 0` from Duffel — optimized at API level)

**As a Redirect Handler**, I want each `FlightOffer` to have a `bookingUrl`, so that I can redirect the user to the airline booking page.

## Acceptance Criteria

**Tìm kiếm thành công:**

- [ ] `searchFlights({ origin:"SGN", destination:"HAN", departureDate:"2026-04-10", adults:1, filters:{stops:"any"} })` → trả về `FlightOffer[]`, ≥ 1 phần tử, giá theo VND
- [ ] `filters.stops: "direct"` → Duffel gọi với `max_connections: 0`, kết quả chỉ có chuyến bay thẳng
- [ ] `filters.stops: "any"` → Duffel gọi không có `max_connections`, kết quả có cả trực tiếp và có điểm dừng
- [ ] Kết quả sắp xếp theo `price` tăng dần
- [ ] Giá là VND: `price = Math.round(usdPrice * VND_EXCHANGE_RATE)`

**Trả về 0 kết quả:**

- [ ] Duffel trả `offers: []` → throw `AmadeusError("Không tìm thấy chuyến bay phù hợp.")`

**Lỗi Duffel:**

- [ ] Duffel trả 4xx/5xx → throw `AmadeusError`
- [ ] Duffel timeout (> `API_TIMEOUT_MS`) → throw `AmadeusError`

**Performance:**

- [ ] `searchFlights()` hoàn thành trong ≤ 6s tại p95 (trong ngân sách 8s của Gateway)

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
async searchFlights(intent: ParsedIntent): Promise<FlightOffer[]>
// Throws:
//   AmadeusError — API error, timeout, hoặc 0 kết quả
```

Duffel endpoint được gọi nội bộ:

- **Auth**: Bearer token — `Authorization: Bearer DUFFEL_TOKEN` (không cần OAuth2 flow)
- **Search**: `POST /air/offer_requests?return_offers=true`

**Request body gửi vào Duffel:**

| Field | Source |
| --- | --- |
| `slices[0].origin` | `intent.origin` |
| `slices[0].destination` | `intent.destination` |
| `slices[0].departure_date` | `intent.departureDate` |
| `passengers` | array of `{ type: "adult" }` × `intent.adults` |
| `cabin_class` | `"economy"` |
| `max_connections` | `0` nếu `intent.filters.stops === "direct"` (bỏ qua nếu `"any"`) |

### Data Models

```ts
interface FlightOffer {
  id: string;        // Duffel offer ID
  airline: string;   // Tên hãng bay đầy đủ (map từ IATA carrier code)
  price: number;     // VND (rounded integer)
  currency: "VND";
  departure: string; // "HH:mm" — giờ khởi hành
  arrival: string;   // "HH:mm" — giờ đến
  duration: string;  // "XhYm" — tổng thời gian bay
  stops: number;     // 0 = bay thẳng, 1+ = có điểm dừng
  bookingUrl: string; // URL hãng bay (tĩnh theo carrier trong MVP sandbox)
}
```

### State & Flow

```text
searchFlights(ParsedIntent)
    │
    ▼
[1] Build Duffel request body từ ParsedIntent
    (origin, destination, date, passengers[], cabin_class, max_connections nếu direct)
    │
    ▼
[2] POST /air/offer_requests?return_offers=true (timeout: API_TIMEOUT_MS)
    │  Timeout / 4xx / 5xx → throw AmadeusError
    │
    ▼
[3] Kiểm tra kết quả
    │  offers.length === 0 → throw AmadeusError("Không tìm thấy chuyến bay phù hợp.")
    │
    ▼
[4] Normalize mỗi offer → FlightOffer (lấy tối đa DUFFEL_MAX_RESULTS)
    ├── Carrier code → map sang tên hãng (airlines.json)
    ├── Price: total_amount × VND_EXCHANGE_RATE → Math.round()
    ├── Parse departing_at/arriving_at → "HH:mm"
    ├── Parse slice.duration ISO 8601 → "XhYm"
    ├── stops = segments.length - 1
    └── bookingUrl = airlines.json[carrierCode].url (URL tĩnh theo hãng)
    │
    ▼
[5] Sort by price ascending
    │
    ▼
[6] Return FlightOffer[]
```

### Business Rules

- **nonStop optimization**: Nếu `filters.stops === "direct"` → pass `nonStop=true` vào Amadeus (filter tại nguồn, không lấy về rồi lọc). Filter Engine chỉ cần xử lý `timeOfDay`.
- **Số lượng fetch**: `AMADEUS_MAX_RESULTS = 15` để Filter Engine có đủ candidates
- **VND conversion**: `price = Math.round(usdPrice * VND_EXCHANGE_RATE)` — dùng giá trị `total` của Amadeus offer (bao gồm tax)
- **Airline name mapping**: Dùng `airlines.json` file tĩnh (map IATA carrier code → tên đầy đủ). Carrier không có trong map → dùng IATA code làm fallback
- **bookingUrl**: URL tĩnh theo hãng từ `airlines.json` — MVP sandbox không có deep link thực. Redirect Handler sẽ dùng field này trực tiếp
- **Không retry**: Duffel fail → throw `AmadeusError` ngay, không retry (Duffel dùng Bearer token — không có token expiry issue)

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| 0 kết quả | Duffel trả `offers: []` | `throw AmadeusError("Không tìm thấy chuyến bay phù hợp.")` |
| Duffel 400 | Params không hợp lệ | `throw AmadeusError` + log chi tiết |
| Duffel 401 | Token sai hoặc hết hạn | `throw AmadeusError` |
| Duffel 429 | Rate limit | `throw AmadeusError` + log cảnh báo |
| Duffel 500 | Duffel server error | `throw AmadeusError` |
| Timeout | Duffel không phản hồi sau `API_TIMEOUT_MS` | `throw AmadeusError` |
| Carrier không trong map | IATA carrier code lạ | Dùng carrier code làm `airline` fallback, `bookingUrl: null` |
| Duration parse lỗi | Duffel trả duration không hợp lệ | Dùng `"N/A"` fallback, không throw |
| Price = 0 hoặc NaN | Duffel data bất thường | Bỏ qua offer đó trước khi sort và return |

## Dependencies

**Upstream (phụ thuộc vào):**

- **Input Validator (#5)** — cung cấp `ParsedIntent` đã validated làm input
- **Backend API Gateway (#1)** — cung cấp config: `DUFFEL_TOKEN`, `API_TIMEOUT_MS`, `VND_EXCHANGE_RATE`
- **Error Handler (#3)** — throw `AmadeusError`
- **Duffel API** (external, `api.duffel.com`) — nguồn dữ liệu chuyến bay
- **`src/data/airlines.json`** — map IATA carrier code → tên hãng bay + bookingUrl

**Downstream (phụ thuộc vào Flight Search):**

- **Filter Engine (#7)** — nhận `FlightOffer[]` để áp dụng filter `timeOfDay`
- **Redirect Handler (#9)** — dùng `bookingUrl` từ `FlightOffer`

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `DUFFEL_TOKEN` | string | — | Duffel API token — `duffel_test_...` cho sandbox (bắt buộc) |
| `API_TIMEOUT_MS` | int | `8000` | Timeout cho Duffel call (từ API Gateway spec) |
| `VND_EXCHANGE_RATE` | float | `25000` | Tỉ giá USD→VND (từ API Gateway spec) |
| `DUFFEL_MAX_RESULTS` | int | `15` | Số offer tối đa lấy từ Duffel trước khi Filter Engine lọc |

## Non-Functional Requirements

- `searchFlights()` hoàn thành trong ≤ 6s tại p95 (Duffel round-trip, trong ngân sách 8s của Gateway)
- Stateless hoàn toàn theo request — không có shared state (Bearer token không cần cache)

## Security Considerations

- `DUFFEL_TOKEN` chỉ tồn tại trong Railway env vars — không log, không expose
- Duffel error detail (HTTP body) chỉ log server-side — không trả về client
- `airlines.json` là file tĩnh, không có user input → không có injection risk

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Normalize Duffel raw offer → `FlightOffer` đúng fields | Jest (mock Duffel response) |
| Unit | Price conversion: USD × `VND_EXCHANGE_RATE` → VND rounded | Jest |
| Unit | Sort by price ascending | Jest |
| Unit | 0 kết quả → throw `AmadeusError` | Jest |
| Unit | Duffel 4xx → throw `AmadeusError` | Jest |
| Unit | Carrier không trong `airlines.json` → dùng code làm fallback | Jest |
| Manual | Duffel sandbox: real call SGN→HAN → verify response shape | Manual |

## Open Questions

- **`airlines.json` coverage**: Duffel có thể trả carrier codes từ các hãng quốc tế ít phổ biến. Cần bao nhiêu hãng trong file để cover đủ các route Việt Nam phổ biến?
