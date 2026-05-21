import { Router } from 'express';
import { listHistorySessions, getHistorySession } from './history.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { getWatcher } from '../../ingestor/watcher.js';
import logger from '../../lib/logger.js';

const router = Router();

router.get('/history/sessions', (req, res) => {
  try {
    res.json(listHistorySessions());
  } catch (error) {
    logger.error('history', 'Failed to list sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.get('/history/sessions/:projectDir/:sessionId', (req, res) => {
  try {
    const { projectDir, sessionId } = req.params;
    res.json(getHistorySession(projectDir, sessionId));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error('history', 'Failed to fetch conversation', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/history/refresh', async (req, res) => {
  try {
    const watcher = getWatcher();
    if (!watcher) {
      return res.status(503).json({ error: 'Ingestor not running' });
    }
    await watcher.rescanAll();
    res.json({ success: true, stats: watcher.getStats() });
  } catch (error) {
    logger.error('history', 'Failed to refresh', { error: error.message });
    res.status(500).json({ error: 'Failed to refresh history' });
  }
});

export default router;
