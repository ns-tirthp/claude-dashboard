import app from './app.js';
import config from './config/index.js';
import logger from './lib/logger.js';
import { startWatcher, stopWatcher } from './ingestor/watcher.js';

if (config.enableIngestor) {
  logger.info('server', 'Starting JSONL ingestor...');
  startWatcher();
} else {
  logger.info('server', 'JSONL ingestor disabled (set ENABLE_INGESTOR=true to enable)');
}

// Start HTTP server
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info('server', `Claude Dashboard API running on http://localhost:${config.port}`);
  logger.info('server', `JSONL source: ${config.claudeProjectsPath}`);
  logger.info('server', `OTLP receiver: POST /v1/metrics, /v1/logs, /v1/traces`);
  logger.info('server', `Telemetry API: GET /api/telemetry/{cost,time,reliability,prompts,sessions,health,summary}`);
  logger.info('server', `Chat API: POST /api/chat, GET /api/chat/sessions`);
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info('server', `${signal} received, shutting down gracefully...`);
  await stopWatcher();
  server.close(() => {
    logger.info('server', 'Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
