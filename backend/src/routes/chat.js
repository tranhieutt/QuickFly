'use strict';

const { parse } = require('../modules/nlp/nlp-parser');
const { validate } = require('../modules/validator/input-validator');
const { searchFlights } = require('../modules/flight/flight-search');
const { applyFilters } = require('../modules/filter/filter-engine');
const { detectState } = require('../modules/state/conversation-state');
const { ValidationError } = require('../middleware/errors');

/**
 * POST /chat
 * Body: { message: string, conversationHistory?: HistoryItem[] }
 */
async function chatHandler(req, res) {
  const { message, conversationHistory = [] } = req.body;

  // ── 1. Request body validation ──────────────────────────────────────────────
  if (!message || typeof message !== 'string') {
    throw new ValidationError('message là bắt buộc');
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('message không được để trống');
  }
  if (trimmed.length > 500) {
    throw new ValidationError('message tối đa 500 ký tự');
  }

  const start = Date.now();
  const requestId = req.requestId;

  // ── 2. Detect conversation state ────────────────────────────────────────────
  // (Used to give NLP Parser context — state info is in conversationHistory itself)
  detectState(conversationHistory); // could be used for routing in future

  // ── 3. NLP Parsing ──────────────────────────────────────────────────────────
  // May throw NLPParseError (→ clarify) or GeminiError (→ 503)
  const intent = await parse(trimmed, conversationHistory);

  // ── 4. Input Validation ─────────────────────────────────────────────────────
  // May throw ValidationError (→ 400)
  validate(intent);

  // ── 5. Flight Search ────────────────────────────────────────────────────────
  // May throw AmadeusError (→ type:"error")
  const offers = await searchFlights(intent);

  // ── 6. Filter + Top 3 ───────────────────────────────────────────────────────
  // May throw FilterError (→ type:"error")
  const results = applyFilters(offers, intent.filters);

  // ── 7. Log + Respond ────────────────────────────────────────────────────────
  const duration = Date.now() - start;
  console.info(JSON.stringify({
    level: 'info',
    requestId,
    duration,
    responseType: 'results',
    resultCount: results.length,
  }));

  return res.status(200).json({ type: 'results', payload: results });
}

module.exports = { chatHandler };
