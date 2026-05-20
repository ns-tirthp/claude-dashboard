import { Router } from 'express';
import { ingestMetrics, ingestLogs, ingestTraces } from './otlp.receiver.js';
import config from '../../config/index.js';
import logger from '../../lib/logger.js';

const router = Router();

router.post('/v1/metrics', (req, res) => {
  try {
    const count = ingestMetrics(req.body || {});
    res.set('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ partialSuccess: {} }));
    if (config.otlpDebug) logger.debug('otlp', `metrics: ${count} points`);
  } catch (err) {
    logger.error('otlp', `metrics error: ${err.message}`);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/v1/logs', (req, res) => {
  try {
    const count = ingestLogs(req.body || {});
    res.set('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ partialSuccess: {} }));
    if (config.otlpDebug) logger.debug('otlp', `logs: ${count} records`);
  } catch (err) {
    logger.error('otlp', `logs error: ${err.message}`);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/v1/traces', (req, res) => {
  try {
    const count = ingestTraces(req.body || {});
    res.set('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ partialSuccess: {} }));
    if (config.otlpDebug) logger.debug('otlp', `traces: ${count} spans`);
  } catch (err) {
    logger.error('otlp', `traces error: ${err.message}`);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/v1/metrics/protobuf', rejectProtobuf);
router.post('/v1/logs/protobuf', rejectProtobuf);
router.post('/v1/traces/protobuf', rejectProtobuf);

function rejectProtobuf(req, res) {
  res.status(415).json({
    error: 'protobuf not supported by this OTLP receiver',
    hint: 'set OTEL_EXPORTER_OTLP_PROTOCOL=http/json',
  });
}

export default router;
