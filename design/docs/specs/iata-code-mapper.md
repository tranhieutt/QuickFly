# IATA Code Mapper

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Foundation

## Overview

IATA Code Mapper là một utility module chạy trong Node.js backend, có nhiệm vụ chuyển đổi tên thành phố/sân bay tiếng Việt (ở nhiều dạng viết khác nhau) sang IATA airport code chuẩn (ví dụ: `"hcm"`, `"sài gòn"`, `"tp hcm"` → `"SGN"`). Module load dữ liệu mapping từ file `airports.json` một lần lúc server khởi động, sau đó phục vụ mọi lookup request hoàn toàn in-memory (không I/O, không external call). Nó là dependency trực tiếp của NLP Parser — sau khi Gemini trích xuất tên địa điểm từ câu người dùng, NLP Parser gọi IATA Code Mapper để chuẩn hóa về code trước khi gọi Amadeus. Nếu module này map sai hoặc thiếu một tên phổ biến, toàn bộ pipeline tìm kiếm chuyến bay sẽ thất bại.

## User Stories

**As a NLP Parser**, I want to pass a raw location string extracted from user input and receive a valid IATA code, so that I can build a correct Amadeus search query.

Acceptance Criteria:

- Given `"hcm"`, when `mapToIATA("hcm")` is called, then returns `"SGN"`
- Given `"hà nội"`, when `mapToIATA("hà nội")` is called, then returns `"HAN"`
- Given an unrecognized string `"xyz123"`, when `mapToIATA("xyz123")` is called, then returns `null`

**As a NLP Parser**, I want the mapper to be case-insensitive and diacritic-tolerant, so that variations in user input don't cause lookup failures.

Acceptance Criteria:

- Given `"Sài Gòn"`, `"sài gòn"`, `"sai gon"` — all map to `"SGN"`
- Given `"Ha Noi"`, `"ha noi"`, `"hà nội"` — all map to `"HAN"`

**As a Developer**, I want to easily add new city aliases to the mapping data, so that I can expand coverage without touching application logic.

Acceptance Criteria:

- Given a new alias added to `airports.json`, when server restarts, then the new alias resolves correctly
- No code change required to add/modify aliases

## Acceptance Criteria

- [ ] `mapToIATA("sgn")` → `"SGN"`
- [ ] `mapToIATA("HCM")` → `"SGN"` (case-insensitive)
- [ ] `mapToIATA("sài gòn")` → `"SGN"` (diacritics)
- [ ] `mapToIATA("sai gon")` → `"SGN"` (diacritics stripped)
- [ ] `mapToIATA("tp hcm")` → `"SGN"`
- [ ] `mapToIATA("hà nội")` → `"HAN"`
- [ ] `mapToIATA("ha noi")` → `"HAN"`
- [ ] `mapToIATA("hn")` → `"HAN"`
- [ ] `mapToIATA("đà nẵng")` → `"DAD"`
- [ ] `mapToIATA("da nang")` → `"DAD"`
- [ ] `mapToIATA("dn")` → `"DAD"`
- [ ] `mapToIATA("xyz_unknown")` → `null` (không throw, trả null)
- [ ] `mapToIATA("")` → `null`
- [ ] `mapToIATA(null)` → `null` (không crash)
- [ ] Module load xong trong ≤ 100ms lúc server startup
- [ ] `mapToIATA()` phản hồi trong ≤ 1ms (pure in-memory lookup)
- [ ] `airports.json` có đủ aliases cho ít nhất 10 sân bay nội địa phổ biến nhất VN

## Technical Design

### API Contracts

Module này không expose HTTP endpoint. Đây là internal function được import trực tiếp:

```js
// Signature
mapToIATA(input: string | null | undefined): string | null

// Ví dụ
mapToIATA("sài gòn")   // → "SGN"
mapToIATA("hn")         // → "HAN"
mapToIATA("xyz")        // → null
mapToIATA(null)         // → null
```

### Data Models

**`src/data/airports.json`** — cấu trúc: IATA code → mảng aliases (đã normalized: lowercase, không dấu):

```json
{
  "SGN": ["sgn", "hcm", "ho chi minh", "sai gon", "tp hcm", "tphcm", "saigon"],
  "HAN": ["han", "hn", "ha noi", "hanoi", "noi bai"],
  "DAD": ["dad", "dn", "da nang", "danang"],
  "CXR": ["cxr", "nha trang", "cam ranh"],
  "HPH": ["hph", "hai phong", "haiphong"],
  "VII": ["vii", "vinh"],
  "HUI": ["hui", "hue"],
  "PQC": ["pqc", "phu quoc"],
  "VCA": ["vca", "can tho"],
  "DIN": ["din", "dien bien", "dien bien phu"]
}
```

In-memory lookup map được build lúc startup từ file trên (đảo ngược):
`Map<alias, IATA_code>` — ví dụ: `"sgn" → "SGN"`, `"hcm" → "SGN"`, `"sai gon" → "SGN"`.

### State & Flow

```text
[Startup]
  airports.json → đọc vào memory → build Map<alias → IATA>

[Runtime — mỗi lần NLP Parser gọi]
  input
    → toLowerCase().trim()
    → stripDiacritics()   (ví dụ: "sài" → "sai")
    → lookup trong Map
    → return IATA code | null
```

### Business Rules

- Input normalize: `toLowerCase()` + `trim()` + strip diacritics trước khi lookup
- Nếu không tìm thấy → trả `null`, KHÔNG throw error, KHÔNG fallback
- IATA code luôn trả về dạng **UPPERCASE** 3 ký tự (ví dụ: `"SGN"`, không phải `"sgn"`)
- `airports.json` là source of truth — logic không hardcode thêm mapping nào khác
- Map được build 1 lần lúc module load, không rebuild trong runtime

## Edge Cases & Error Handling

| Scenario | Input Condition | Expected Behavior |
| --- | --- | --- |
| Input null/undefined | `mapToIATA(null)` | Trả `null`, không throw |
| Input rỗng | `mapToIATA("")` | Trả `null` |
| Input chỉ có khoảng trắng | `mapToIATA("   ")` | Trả `null` sau khi trim |
| Tên không tồn tại trong map | `mapToIATA("xyz")` | Trả `null` |
| Tên có dấu | `mapToIATA("Sài Gòn")` | Normalize → `"sai gon"` → `"SGN"` |
| Tên hỗn hợp chữ hoa/thường | `mapToIATA("Ha NOI")` | Normalize → `"ha noi"` → `"HAN"` |
| airports.json bị thiếu lúc startup | File không tồn tại | Server fail to start với error rõ ràng (không silent) |
| airports.json bị corrupt/invalid JSON | Parse error | Server fail to start với error rõ ràng |
| Input là số | `mapToIATA("123")` | Trả `null` (không crash) |
| Input đã là IATA code đúng | `mapToIATA("SGN")` | Normalize → `"sgn"` → `"SGN"` (vì `"sgn"` có trong alias list) |

## Dependencies

**Upstream (module phụ thuộc vào):**

- **`src/data/airports.json`** — data file, load lúc startup. Hard dependency: không có file này thì module không hoạt động.
- **Diacritic-stripping library** — ví dụ `diacritics` (npm) hoặc dùng `String.normalize('NFD')` built-in. Cần để normalize input tiếng Việt.

**Downstream (module phụ thuộc vào IATA Code Mapper):**

- **NLP Parser (#4)** — gọi `mapToIATA()` sau khi Gemini trích xuất tên địa điểm. Nhận `string | null` và dùng `null` để trigger clarify flow.

**Không có external API dependency** — toàn bộ logic là in-memory, không gọi network.

## Configuration & Feature Flags

| Config Key | Type | Default | Mô tả |
| --- | --- | --- | --- |
| `AIRPORTS_DATA_PATH` | string | `"src/data/airports.json"` | Đường dẫn tới file data. Hữu ích khi chạy test với fixture khác. |

> Không có feature flag — module này luôn active và không thể tắt (Foundation dependency).

## Non-Functional Requirements

- `mapToIATA()` phản hồi trong ≤ 1ms (in-memory Map lookup — O(1))
- Module load lúc startup trong ≤ 100ms
- Memory footprint: < 1MB (airports.json của 10 sân bay VN rất nhỏ)
- Không có availability target riêng — sống/chết cùng Express server

## Security Considerations

- Không xử lý user data nhạy cảm (PII, auth, payment)
- Input từ NLP Parser (internal) — không cần sanitize thêm, chỉ cần null-safe
- `airports.json` là static data, không thể inject qua user input
- Không có network call → không có attack surface từ external

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Happy path: 10 sân bay × nhiều aliases | Jest |
| Unit | Null/empty/whitespace input → `null` | Jest |
| Unit | Case-insensitive + diacritics (có/không dấu) | Jest |
| Unit | `airports.json` missing → throw error at load time | Jest |
| Unit | `airports.json` invalid JSON → throw error at load time | Jest |

> Không cần integration hay E2E test — pure function với no external dependencies.

## Open Questions

- **Bao nhiêu sân bay cần cover?** MVP = 10 sân bay nội địa phổ biến nhất. Có cần thêm sân bay quốc tế (BKK, SIN, ICN...) không?
