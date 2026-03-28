'use strict';

/**
 * Detect the current conversation state from history.
 *
 * @param {Array<{role: string, content: string, type?: string}>} [conversationHistory]
 * @returns {{ state: 'idle'|'awaiting_clarification'|'results_shown', lastBotType: string|null }}
 */
function detectState(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return { state: 'idle', lastBotType: null };
  }

  // Find the last bot message
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const item = conversationHistory[i];
    if (item.role !== 'bot') continue;

    const type = item.type || null;

    if (type === 'clarify') {
      return { state: 'awaiting_clarification', lastBotType: 'clarify' };
    }
    if (type === 'results') {
      return { state: 'results_shown', lastBotType: 'results' };
    }
    // 'error' or unknown → reset to idle
    return { state: 'idle', lastBotType: type };
  }

  return { state: 'idle', lastBotType: null };
}

module.exports = { detectState };
