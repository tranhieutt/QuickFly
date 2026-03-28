require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT) || 3000,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS) || parseInt(process.env.API_TIMEOUT_MS) || 15000,
    promptPath: process.env.NLP_PROMPT_PATH || 'src/prompts/nlp-system-prompt.txt',
  },
  duffel: {
    token: process.env.DUFFEL_TOKEN,
    maxResults: parseInt(process.env.DUFFEL_MAX_RESULTS) || 15,
    timeoutMs: parseInt(process.env.API_TIMEOUT_MS) || 8000,
  },
  vndExchangeRate: parseFloat(process.env.VND_EXCHANGE_RATE) || 25000,
  maxResults: parseInt(process.env.MAX_RESULTS) || 3,
  rateLimitRpm: parseInt(process.env.RATE_LIMIT_RPM) || 20,
  corsAllowedOrigin: process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
};

function validateConfig() {
  const required = [
    ['GEMINI_API_KEY', config.gemini.apiKey],
    ['DUFFEL_TOKEN', config.duffel.token],
  ];
  const missing = required.filter(([, val]) => !val).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
