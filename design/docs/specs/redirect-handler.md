# Redirect Handler

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Feature

## Overview

Redirect Handler là một utility module trong Feature layer, chịu trách nhiệm build và validate `bookingUrl` cuối cùng cho một `FlightOffer` được chọn. Trong MVP, module này được gọi bởi Flight Search trong quá trình normalization để set `bookingUrl` tĩnh từ `airlines.json`. Khi user chọn chuyến bay, **Chat UI tự thực hiện redirect** (`window.open(offer.bookingUrl, '_blank')`) mà không cần thêm backend call — phù hợp với kiến trúc stateless. Redirect Handler được tách thành module riêng để isolate logic build URL, dễ upgrade sau này (ví dụ: Amadeus deep link API).

## User Stories

**As a Chat UI (frontend)**, I want each FlightOffer to have a valid `bookingUrl`, so that I can open the airline booking page when the user selects a flight.

Acceptance Criteria:

- Given a `FlightOffer` with carrier code `"VN"`, when user selects it, then Chat UI opens `"https://www.vietnamairlines.com"` in a new tab
- Given a `FlightOffer` with unknown carrier, then `bookingUrl` is `null` and Chat UI shows "Không có link đặt vé trực tiếp" fallback

**As a Flight Search module**, I want to call `buildBookingUrl(carrierCode)` during offer normalization, so that every FlightOffer has a bookingUrl without knowing about airlines.json structure.

## Acceptance Criteria

- [ ] `buildBookingUrl("VN")` → `"https://www.vietnamairlines.com"`
- [ ] `buildBookingUrl("VJ")` → `"https://www.vietjetair.com"`
- [ ] `buildBookingUrl("QH")` → `"https://www.bambooairways.com"`
- [ ] `buildBookingUrl("BL")` → `"https://www.pacificairlines.vn"`
- [ ] `buildBookingUrl("unknown")` → `null`
- [ ] `buildBookingUrl()` hoàn thành trong ≤ 1ms (in-memory lookup)

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
buildBookingUrl(carrierCode: string): string | null
// Returns URL string nếu carrier có trong airlines.json
// Returns null nếu carrier không tìm thấy
```

### Data Models

`airlines.json` — file tĩnh tại `src/data/airlines.json`, load lúc startup:

```json
{
  "VN": { "name": "Vietnam Airlines", "url": "https://www.vietnamairlines.com" },
  "VJ": { "name": "VietJet Air", "url": "https://www.vietjetair.com" },
  "QH": { "name": "Bamboo Airways", "url": "https://www.bambooairways.com" },
  "BL": { "name": "Pacific Airlines", "url": "https://www.pacificairlines.vn" },
  "VU": { "name": "Vietravel Airlines", "url": "https://www.vietravelairlines.vn" }
}
```

*Note: Cùng file với airline name mapping trong Flight Search.*

### State & Flow

```text
buildBookingUrl(carrierCode)
    │
    ▼
[1] Lookup airlines.json[carrierCode]
    ├── Tìm thấy → return entry.url
    └── Không tìm thấy → return null
```

**Chat UI flow khi user chọn chuyến:**

```text
User click "Chọn chuyến này" (button trong Result Display)
    │
    ▼
Chat UI: window.open(offer.bookingUrl, '_blank')
    ├── bookingUrl != null → mở tab mới với URL hãng bay
    └── bookingUrl = null  → hiển thị "Không có link đặt vé trực tiếp"
```

### Business Rules

- `bookingUrl` được set **tại Flight Search** khi normalize offer, gọi `buildBookingUrl(carrierCode)`
- Frontend **không cần** gọi backend để lấy URL — `bookingUrl` đã có trong `FlightOffer[]` từ `type: "results"` response
- Redirect mở **tab mới** (`_blank`) — không navigate away khỏi chat
- `bookingUrl: null` → Chat UI hiển thị fallback message (không crash)
- Không có server-side redirect endpoint trong MVP

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| Carrier không trong map | Carrier code lạ | `buildBookingUrl()` returns `null` |
| `bookingUrl: null` | Offer có carrier không map được | Chat UI hiển thị fallback: "Không có link đặt vé trực tiếp, vui lòng tìm kiếm hãng bay trên Google." |
| URL bị block popup | Browser block `window.open` | Chat UI fallback: hiển thị URL dạng text để user copy |
| User không click | User tìm kiếm mới thay vì chọn | CSM detect `results_shown` → tìm kiếm mới bình thường |

## Dependencies

**Upstream (phụ thuộc vào):**

- **Flight Search (#6)** — gọi `buildBookingUrl()` trong quá trình normalize offer
- **`src/data/airlines.json`** — nguồn URL mapping (shared với Flight Search airline name lookup)

**Downstream (phụ thuộc vào Redirect Handler):**

- **Chat UI (#11)** — nhận `bookingUrl` trong `FlightOffer`, tự thực hiện redirect

## Configuration & Feature Flags

Không có config riêng. `airlines.json` là data file tĩnh — update khi cần thêm hãng bay mới.

## Non-Functional Requirements

- `buildBookingUrl()` hoàn thành trong ≤ 1ms (in-memory Map lookup)
- Stateless — pure function

## Security Considerations

- `bookingUrl` chỉ chứa URL từ `airlines.json` — whitelist cứng, không có URL injection từ user
- Không redirect server-side → không có open redirect vulnerability ở backend
- Frontend `window.open()` với URL từ whitelist — không có XSS risk từ dynamic URL

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Carrier có trong map → trả đúng URL | Jest |
| Unit | Carrier không có trong map → trả `null` | Jest |
| Unit | Case sensitivity: `"vn"` vs `"VN"` (carriers từ Flight Search đã uppercase) | Jest |
| Manual | Chat UI: click chọn chuyến → tab mới mở đúng URL | Manual |
| Manual | Chat UI: `bookingUrl: null` → hiển thị fallback message | Manual |

## Open Questions

- **Production deep links**: Trong tương lai, Amadeus có thể cung cấp deep link chứa pre-filled booking data. Khi đó `buildBookingUrl()` cần nhận thêm `FlightOffer` để build URL. Hiện tại MVP chỉ cần carrier code.
- **airlines.json maintenance**: Ai update khi có hãng mới hoặc URL thay đổi? Cần process rõ ràng hơn khi production.
