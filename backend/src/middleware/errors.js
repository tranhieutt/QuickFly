'use strict';

// ─── Base error class ────────────────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode, userMessage, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Typed error classes ─────────────────────────────────────────────────────

class GeminiError extends AppError {
  constructor(detail) {
    super(
      detail || 'Gemini API error',
      503,
      'Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.'
    );
  }
}

class AmadeusError extends AppError {
  constructor(detail) {
    super(
      detail || 'Amadeus API error',
      200,
      'Không thể tìm vé lúc này, vui lòng thử lại sau.'
    );
    this.responseType = 'error';
  }
}

class ValidationError extends AppError {
  constructor(userMessage) {
    super(userMessage, 400, userMessage);
  }
}

class NLPParseError extends AppError {
  constructor(clarifyQuestion) {
    super(clarifyQuestion || 'NLP parse error', 200, clarifyQuestion);
    this.clarifyQuestion = clarifyQuestion;
    this.responseType = 'clarify';
  }
}

class FilterError extends AppError {
  constructor(userMessage) {
    super(userMessage, 200, userMessage);
    this.responseType = 'error';
  }
}

// ─── Express global error middleware ─────────────────────────────────────────

function globalErrorMiddleware(err, req, res, next) {
  const requestId = req.requestId || 'unknown';

  if (err instanceof AppError && err.isOperational) {
    // Log operational errors at warn level
    console.warn(JSON.stringify({
      level: 'warn',
      requestId,
      errorType: err.name,
      message: err.message,
      statusCode: err.statusCode,
    }));

    if (err instanceof NLPParseError) {
      return res.status(200).json({
        type: 'clarify',
        payload: { question: err.clarifyQuestion },
      });
    }

    if (err instanceof AmadeusError || err instanceof FilterError) {
      return res.status(200).json({
        type: 'error',
        payload: { message: err.userMessage },
      });
    }

    // ValidationError → 400, GeminiError → 503
    return res.status(err.statusCode).json({ error: err.userMessage });
  }

  // Unknown / non-operational error — bug
  console.error(JSON.stringify({
    level: 'error',
    requestId,
    errorType: err.name || 'UnknownError',
    message: err.message,
    stack: err.stack,
  }));

  return res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' });
}

module.exports = {
  AppError,
  GeminiError,
  AmadeusError,
  ValidationError,
  NLPParseError,
  FilterError,
  globalErrorMiddleware,
};
