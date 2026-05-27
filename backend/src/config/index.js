import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');

const config = Object.freeze({
  port: Number(process.env.PORT) || 3001,

  claudeProjectsPath: process.env.CLAUDE_PROJECTS_PATH ||
    path.join(os.homedir(), '.claude', 'projects'),

  telemetryDbPath: process.env.TELEMETRY_DB_PATH ||
    path.join(backendRoot, 'data', 'telemetry.db'),

  chatDbPath: process.env.CHAT_DB_PATH ||
    path.join(backendRoot, 'data', 'chat.db'),

  dashboardDbPath: process.env.DASHBOARD_DB_PATH ||
    path.join(backendRoot, 'data', 'dashboard.db'),

  analyticsDbPath: process.env.ANALYTICS_DB_PATH ||
    path.join(backendRoot, 'data', 'analytics.db'),

  ai: {
    provider: process.env.AI_PROVIDER || 'claude',
    model: process.env.AI_MODEL || null,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    localAiUrl: process.env.LOCAL_AI_URL || 'http://localhost:11434',
  },

  chatRowLimit: parseInt(process.env.CHAT_ROW_LIMIT || '500', 10),

  otlpDebug: Boolean(process.env.OTLP_DEBUG),

  // Ingestor configuration
  enableIngestor: process.env.ENABLE_INGESTOR !== 'false', // Enabled by default
});

export default config;
