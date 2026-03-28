# Result Display

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Presentation

## Overview

Result Display là React component trong Presentation layer, nhận `FlightOffer[]` từ `type: "results"` response của Gateway và render tối đa 3 thẻ chuyến bay trong luồng chat. Mỗi thẻ hiển thị: tên hãng bay, giờ khởi hành/đến, tổng thời gian bay, số điểm dừng, giá VND, và nút "Chọn chuyến này". Khi user click nút, component mở `offer.bookingUrl` trong tab mới. Responsive cho cả desktop và mobile. Không có logic business — chỉ format và render dữ liệu nhận được.

## User Stories

**As a user**, I want to see flight results as clear cards in the chat, so that I can compare and choose without leaving the interface.

Acceptance Criteria:

- Given 3 offers, when results are rendered, then 3 cards appear in the chat with all required fields visible
- Given 1–2 offers, when rendered, then correct number of cards shown (no empty placeholders)

**As a user on mobile**, I want flight cards to be readable on a small screen, so that I can use the bot on my phone.

Acceptance Criteria:

- Given viewport 375px, when results are rendered, then all card content is readable without horizontal scroll

## Acceptance Criteria

- [ ] `FlightResultList` với 3 offers → render 3 `FlightCard`
- [ ] `FlightResultList` với 1–2 offers → render đúng số lượng có
- [ ] Mỗi card hiển thị: tên hãng, `departure → arrival`, `duration`, stops label, giá VND, nút chọn
- [ ] Stops = 0 → hiển thị `"Bay thẳng"`, stops = 1 → `"1 điểm dừng"`, stops > 1 → `"N điểm dừng"`
- [ ] Giá format: `850.000 ₫` (dùng `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`)
- [ ] Click nút "Chọn chuyến này" → `window.open(offer.bookingUrl, '_blank')`
- [ ] `bookingUrl: null` → nút disabled, tooltip "Không có link đặt vé trực tiếp"
- [ ] Responsive: hiển thị đúng trên viewport 375px (iPhone SE)

## Technical Design

### API Contracts

React components, không expose HTTP endpoint:

```tsx
// Container component
<FlightResultList offers={FlightOffer[]} />

// Card component
<FlightCard
  offer={FlightOffer}
  onSelect={(bookingUrl: string | null) => void}
/>
```

### Data Models

Nhận `FlightOffer` từ Flight Search spec (không định nghĩa lại):

```ts
interface FlightOffer {
  id: string;
  airline: string;
  price: number;        // VND integer
  currency: "VND";
  departure: string;    // "HH:mm"
  arrival: string;      // "HH:mm"
  duration: string;     // "XhYm"
  stops: number;
  bookingUrl: string | null;
}
```

### State & Flow

```text
Gateway trả { type: "results", payload: FlightOffer[] }
    │
    ▼
Chat UI nhận payload → pass vào <FlightResultList offers={payload} />
    │
    ▼
FlightResultList render mỗi offer thành <FlightCard>
    │
    ▼
User click "Chọn chuyến này"
    ├── bookingUrl != null → window.open(bookingUrl, '_blank')
    └── bookingUrl = null  → nút disabled (không có action)
```

### Business Rules

- **Format stops**: `0 → "Bay thẳng"`, `1 → "1 điểm dừng"`, `n → "n điểm dừng"`
- **Format giá**: `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)` → `"850.000 ₫"`
- **Thứ tự card**: Giữ nguyên thứ tự từ `FlightOffer[]` (đã sorted by price từ Filter Engine)
- **Không có "chọn" state**: Sau khi click, card không thay đổi UI — tab mới mở, chat vẫn giữ nguyên
- **Không re-render**: Component là pure display — không có internal state quản lý selection

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| `offers: []` | Empty array | Không render gì — Chat UI xử lý (không nên xảy ra, Gateway throw error trước) |
| `bookingUrl: null` | Carrier không trong map | Nút disabled với tooltip "Không có link đặt vé trực tiếp" |
| Tên hãng dài | Airline name quá dài | Truncate với ellipsis, không vỡ layout |
| Popup bị block | Browser block `window.open` | Hiển thị URL dạng text link để user copy |
| Price = 0 | Data bất thường | Hiển thị "0 ₫" — không crash |

## Dependencies

**Upstream (phụ thuộc vào):**

- **Flight Search (#6)** — cung cấp `FlightOffer` data model
- **Filter Engine (#7)** — cung cấp sorted `FlightOffer[]` (top 3)
- **Redirect Handler (#9)** — `bookingUrl` trong `FlightOffer` (built bởi Redirect Handler)

**Downstream (phụ thuộc vào Result Display):**

- **Chat UI (#11)** — embed `FlightResultList` trong luồng chat

**Tech:**

- **React** — component framework
- **Tailwind CSS** — styling

## Configuration & Feature Flags

Không có config riêng. Component thuần presentational.

## Non-Functional Requirements

- Render ≤ 16ms (một frame ở 60fps) — không có I/O, thuần React render
- Responsive: mobile-first, hoạt động từ 375px viewport trở lên
- Không có dependency ngoài React và Tailwind (đã có trong project)

## Security Considerations

- `bookingUrl` từ `airlines.json` whitelist (set bởi backend) — không có URL injection từ user
- Không render HTML từ server response (airline name là plain text) — không có XSS risk
- `window.open` với URL từ backend whitelist — an toàn

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | `FlightCard` render đúng fields với mock offer | Jest + React Testing Library |
| Unit | stops = 0 → "Bay thẳng", stops = 2 → "2 điểm dừng" | Jest |
| Unit | Price format VND đúng | Jest |
| Unit | `bookingUrl: null` → nút disabled | Jest |
| Unit | `FlightResultList` render đúng số card | Jest |
| Visual/Manual | Responsive: 375px, 768px, 1280px | Manual / Storybook |
| Manual | Click nút → tab mới mở đúng URL | Manual |

## Open Questions

- **Airline logo**: Có cần hiển thị logo hãng bay không? Nếu có, cần host static images hoặc dùng CDN. Hiện tại spec chỉ dùng text tên hãng.
