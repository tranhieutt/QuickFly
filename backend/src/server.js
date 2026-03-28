'use strict';

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { config, validateConfig } = require('./config');
const { chatHandler } = require('./routes/chat');
const { globalErrorMiddleware } = require('./middleware/errors');

// Validate env vars at startup
validateConfig();

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin: config.corsAllowedOrigin,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' }));

// Attach requestId to every request
app.use((req, _res, next) => {
  req.requestId = require('crypto').randomUUID().slice(0, 8);
  next();
});

// Rate limiting
app.use('/chat', rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitRpm,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
}));

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/chat', chatHandler);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Error handling ────────────────────────────────────────────────────────────

app.use(globalErrorMiddleware);

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = config.port;
app.listen(PORT, () => {
  console.info(JSON.stringify({
    level: 'info',
    message: `QuickFly backend running on port ${PORT}`,
    duffelSandbox: config.duffel.token?.startsWith('duffel_test'),
  }));
});

module.exports = app;
