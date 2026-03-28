import React, { useState, useRef, useEffect } from 'react';
import FlightResultList from './components/FlightResultList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CLIENT_TIMEOUT_MS = 10_000;

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  if (msg.type === 'results') {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-sm w-full">
          <p className="text-xs text-gray-400 mb-2 ml-1">
            Tìm thấy {msg.offers.length} chuyến bay:
          </p>
          <FlightResultList offers={msg.offers} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={
          'max-w-xs px-4 py-2.5 rounded-2xl text-sm ' +
          (isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : msg.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm')
        }
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      type: null,
      content: 'Xin chào! Tôi là QuickFly ✈️ Bạn muốn bay đi đâu hôm nay?',
    },
  ]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      type: null,
      content: text,
    };

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: text },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setConversationHistory(newHistory);
    setInputValue('');
    setIsLoading(true);

    let botMsg;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationHistory: newHistory }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        botMsg = {
          id: Date.now().toString(),
          role: 'bot',
          type: 'error',
          content: body.error || 'Có lỗi xảy ra, vui lòng thử lại.',
        };
      } else {
        const data = await res.json();

        if (data.type === 'results') {
          botMsg = {
            id: Date.now().toString(),
            role: 'bot',
            type: 'results',
            offers: data.payload,
            content: `[Kết quả: ${data.payload.length} chuyến bay]`,
          };
        } else if (data.type === 'clarify') {
          botMsg = {
            id: Date.now().toString(),
            role: 'bot',
            type: 'clarify',
            content: data.payload.question,
          };
        } else {
          botMsg = {
            id: Date.now().toString(),
            role: 'bot',
            type: 'error',
            content:
              data.payload?.message || 'Không tìm thấy chuyến bay phù hợp.',
          };
        }
      }
    } catch (err) {
      botMsg = {
        id: Date.now().toString(),
        role: 'bot',
        type: 'error',
        content:
          err.name === 'AbortError'
            ? 'Kết nối bị gián đoạn, vui lòng thử lại.'
            : 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau.',
      };
    }

    setMessages((prev) => [...prev, botMsg]);
    setConversationHistory((prev) => [
      ...prev,
      { role: 'bot', content: botMsg.content, type: botMsg.type },
    ]);
    setIsLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-2 shadow-sm shrink-0">
        <span className="text-xl">✈️</span>
        <div>
          <p className="font-semibold text-sm leading-tight">QuickFly</p>
          <p className="text-blue-100 text-xs">Tìm vé máy bay bằng tiếng Việt</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Nhập tin nhắn..."
            maxLength={500}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
