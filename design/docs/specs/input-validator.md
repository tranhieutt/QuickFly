# Input Validator

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-03-28
> **Priority**: MVP
> **Layer**: Core

## Overview

Input Validator là một pure function module trong Core layer, chịu trách nhiệm kiểm tra tính hợp lệ về mặt nghiệp vụ của `ParsedIntent` nhận từ NLP Parser. Trong khi NLP Parser xử lý các lỗi syntactic (thiếu field, không nhận ra địa danh), Input Validator xử lý các lỗi semantic — route vô lý (origin = destination), ngày trong quá khứ, số hành khách ngoài range hợp lệ, và format ngày sai. Nếu `ParsedIntent` hợp lệ → pass thẳng xuống Flight Search. Nếu không → throw `ValidationError` với thông báo tiếng Việt rõ ràng. Module này không có external call, không lưu state.

## User Stories

**As a Flight Search**, I want to only receive validated `ParsedIntent` objects, so that I never call Amadeus API with logically impossible parameters.

**As a Chat UI (frontend)**, I want validation errors to be clear Vietnamese messages, so that users understand what to fix without needing technical knowledge.

## Acceptance Criteria

**Valid — không throw:**

- [ ] `{ origin:"SGN", destination:"HAN", departureDate:"2026-04-10", adults:1 }` → pass
- [ ] `adults:9` → pass (Amadeus hỗ trợ đến 9)
- [ ] `departureDate` = ngày hôm nay → pass

**Invalid — throws `ValidationError`:**

- [ ] `origin === destination` (`"SGN"` → `"SGN"`) → `"Nơi đi và nơi đến không được giống nhau."`
- [ ] `departureDate` là ngày hôm qua → `"Ngày khởi hành phải là ngày hôm nay hoặc trong tương lai."`
- [ ] `adults < 1` → `"Số hành khách phải ít nhất là 1."`
- [ ] `adults > 9` → `"Amadeus hỗ trợ tối đa 9 hành khách."`
- [ ] `departureDate` format sai (không phải `YYYY-MM-DD`) → `"Định dạng ngày không hợp lệ."`
- [ ] `origin` hoặc `destination` không phải IATA 3 chữ cái uppercase → `"Mã sân bay không hợp lệ."`

**Performance:**

- [ ] `validate()` hoàn thành trong ≤ 1ms (pure in-memory, no I/O)

## Technical Design

### API Contracts

Internal function, không expose HTTP endpoint:

```js
validate(intent: ParsedIntent): void
// Không trả gì nếu hợp lệ
// Throws ValidationError nếu không hợp lệ
```

### Data Models

Không lưu dữ liệu. Chỉ nhận và kiểm tra `ParsedIntent` (định nghĩa trong NLP Parser spec).

### State & Flow

```text
validate(ParsedIntent)
    ├── origin !== destination?       → không: throw ValidationError
    ├── departureDate format YYYY-MM-DD? → không: throw ValidationError
    ├── departureDate >= today (UTC)?  → không: throw ValidationError
    ├── origin match /^[A-Z]{3}$/?    → không: throw ValidationError
    ├── destination match /^[A-Z]{3}$/? → không: throw ValidationError
    ├── adults >= 1?                   → không: throw ValidationError
    ├── adults <= 9?                   → không: throw ValidationError
    └── return void (hợp lệ)
```

### Business Rules

- **Origin ≠ destination**: so sánh exact IATA code
- **Ngày bay**: phải ≥ ngày hôm nay tính theo UTC. Ngày hôm nay được phép.
- **IATA format**: regex `/^[A-Z]{3}$/` — 3 chữ cái uppercase
- **Adults**: `1 ≤ adults ≤ 9` (giới hạn Amadeus API)
- **Throw thứ tự**: kiểm tra từ trên xuống, throw lỗi **đầu tiên** gặp phải — không accumulate
- `departureDate` format phải check trước khi so sánh với today

## Edge Cases & Error Handling

| Scenario | Condition | Expected Behavior |
| --- | --- | --- |
| departureDate = hôm nay | Đúng ngày hôm nay | Hợp lệ — cho phép |
| adults = 0 | 0 người | `ValidationError("Số hành khách phải ít nhất là 1.")` |
| adults = 10 | 10 người | `ValidationError("Amadeus hỗ trợ tối đa 9 hành khách.")` |
| origin = destination | `"HAN"` → `"HAN"` | `ValidationError("Nơi đi và nơi đến không được giống nhau.")` |
| IATA lowercase | `"sgn"` | `ValidationError` — NLP Parser đã normalize, nhưng guard thêm |
| IATA 2 chữ | `"SG"` | `ValidationError("Mã sân bay không hợp lệ.")` |
| ParsedIntent null/undefined | Caller bug | Throw JS TypeError — không phải ValidationError |

## Dependencies

**Upstream (phụ thuộc vào):**

- **NLP Parser (#4)** — cung cấp `ParsedIntent` input
- **Error Handler (#3)** — throw `ValidationError`

**Downstream (phụ thuộc vào Input Validator):**

- **Flight Search (#6)** — nhận `ParsedIntent` đã validated
- **Conversation State Manager (#8)** — pipeline qua Input Validator trước khi search

## Configuration & Feature Flags

Không có config riêng. `MAX_ADULTS = 9` là constraint cứng theo giới hạn Amadeus API — không nên expose ra config vì đây là external service constraint.

## Non-Functional Requirements

- `validate()` hoàn thành trong ≤ 1ms (pure synchronous, no I/O)
- Stateless — mỗi call hoàn toàn độc lập

## Security Considerations

- Không xử lý PII hay dữ liệu nhạy cảm
- Input đến từ internal NLP Parser — không có injection risk
- Pure comparison logic — không có dynamic eval hay regex từ user input

## Testing Strategy

| Test Type | Cần cover | Tool |
| --- | --- | --- |
| Unit | Valid intent đầy đủ → không throw | Jest |
| Unit | Mỗi validation rule: 1 case pass + 1 case fail cụ thể | Jest |
| Unit | Throw thứ tự đúng khi nhiều field sai cùng lúc | Jest |
| Unit | Edge: `departureDate` = today → pass | Jest |
| Unit | Edge: `adults = 1` và `adults = 9` → pass (boundary) | Jest |

## Open Questions

- Nếu Amadeus nâng giới hạn lên > 9 hành khách trong tương lai, có cần update `MAX_ADULTS` không? Hiện tại hardcode = 9.
