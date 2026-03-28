'use strict';

const { detectState } = require('../src/modules/state/conversation-state');

describe('Conversation State Manager', () => {
  test('undefined history → idle', () => {
    expect(detectState(undefined)).toEqual({ state: 'idle', lastBotType: null });
  });

  test('empty history → idle', () => {
    expect(detectState([])).toEqual({ state: 'idle', lastBotType: null });
  });

  test('only user messages → idle', () => {
    const h = [{ role: 'user', content: 'hello' }];
    expect(detectState(h)).toEqual({ state: 'idle', lastBotType: null });
  });

  test('last bot type "clarify" → awaiting_clarification', () => {
    const h = [
      { role: 'user', content: 'book flight' },
      { role: 'bot', content: 'Bạn muốn bay ngày nào?', type: 'clarify' },
    ];
    expect(detectState(h)).toEqual({ state: 'awaiting_clarification', lastBotType: 'clarify' });
  });

  test('last bot type "results" → results_shown', () => {
    const h = [
      { role: 'user', content: 'HCM đi HN ngày 5/4' },
      { role: 'bot', content: '[Kết quả]', type: 'results' },
    ];
    expect(detectState(h)).toEqual({ state: 'results_shown', lastBotType: 'results' });
  });

  test('last bot type "error" → idle', () => {
    const h = [
      { role: 'bot', content: 'Lỗi rồi', type: 'error' },
    ];
    expect(detectState(h)).toEqual({ state: 'idle', lastBotType: 'error' });
  });

  test('bot message without type → idle', () => {
    const h = [{ role: 'bot', content: 'Xin chào!' }];
    expect(detectState(h)).toEqual({ state: 'idle', lastBotType: null });
  });

  test('user message after clarify → still awaiting_clarification (last bot is clarify)', () => {
    const h = [
      { role: 'bot', content: 'Bạn muốn bay ngày nào?', type: 'clarify' },
      { role: 'user', content: 'ngày mai' },
    ];
    // Last bot message is still 'clarify'
    expect(detectState(h)).toEqual({ state: 'awaiting_clarification', lastBotType: 'clarify' });
  });

  test('long history — reads last bot message correctly', () => {
    const h = [
      { role: 'bot', content: 'Q1', type: 'clarify' },
      { role: 'user', content: 'A1' },
      { role: 'bot', content: 'Q2', type: 'clarify' },
      { role: 'user', content: 'A2' },
      { role: 'bot', content: '[results]', type: 'results' },
      { role: 'user', content: 'cái đầu tiên' },
    ];
    expect(detectState(h)).toEqual({ state: 'results_shown', lastBotType: 'results' });
  });
});
