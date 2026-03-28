'use strict';

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { config } = require('../../config');
const { mapToIATA } = require('../iata/iata-mapper');
const { GeminiError, NLPParseError } = require('../../middleware/errors');

// Load system prompt once at startup
const promptPath = path.resolve(config.gemini.promptPath);
let systemPrompt;
try {
  systemPrompt = fs.readFileSync(promptPath, 'utf-8');
} catch {
  throw new Error(`Cannot load NLP system prompt from: ${promptPath}`);
}

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Parse a Vietnamese natural language message into a ParsedIntent.
 *
 * @param {string} message
 * @param {Array<{role: string, content: string}>} [conversationHistory]
 * @returns {Promise<ParsedIntent>}
 * @throws {GeminiError} on Gemini timeout or API failure
 * @throws {NLPParseError} on missing required fields or unmappable locations
 */
async function parse(message, conversationHistory = []) {
  const model = genAI.getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: systemPrompt,
  });

  // Build history for Gemini (convert our format to Gemini format)
  const geminiHistory = conversationHistory.map((item) => ({
    role: item.role === 'bot' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });

  // Prefix today's date so Gemini can resolve relative dates ("ngày mai", "thứ 6 tới")
  const today = new Date().toISOString().slice(0, 10);
  const messageWithDate = `[Hôm nay: ${today}]\n${message}`;

  // Call Gemini with timeout
  let raw;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), config.gemini.timeoutMs)
    );
    const result = await Promise.race([
      chat.sendMessage(messageWithDate),
      timeoutPromise,
    ]);
    raw = result.response.text();
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      throw new GeminiError('Gemini request timed out');
    }
    throw new GeminiError(err.message);
  }

  // Parse JSON response
  let parsed;
  try {
    // Strip potential markdown code fences
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new NLPParseError('Bạn có thể nói rõ hơn không?');
  }

  // Check missingFields declared by Gemini
  const missing = parsed.missingFields || [];
  if (missing.includes('origin') || missing.includes('destination')) {
    throw new NLPParseError('Bạn muốn bay từ đâu đến đâu?');
  }
  if (missing.includes('returnDate')) {
    throw new NLPParseError('QuickFly hiện chỉ hỗ trợ vé một chiều. Bạn muốn tìm chuyến đi thôi không?');
  }
  if (missing.includes('departureDate')) {
    throw new NLPParseError('Bạn muốn bay ngày nào?');
  }

  // Map raw location strings to IATA codes
  const origin = mapToIATA(parsed.origin_raw);
  if (!origin) {
    throw new NLPParseError('Bạn có thể nói rõ hơn bạn muốn đi từ sân bay nào không?');
  }

  const destination = mapToIATA(parsed.destination_raw);
  if (!destination) {
    throw new NLPParseError('Bạn có thể nói rõ hơn bạn muốn đến sân bay nào không?');
  }

  return {
    origin,
    destination,
    departureDate: parsed.departureDate,
    adults: parsed.adults || 1,
    tripType: parsed.tripType || 'one-way',
    filters: {
      timeOfDay: parsed.filters?.timeOfDay || null,
      stops: parsed.filters?.stops || 'any',
    },
  };
}

module.exports = { parse };
