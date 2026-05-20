import { Router } from 'express';
import { getStatistics, getFilterOptions } from './stats.service.js';
import logger from '../../lib/logger.js';

const router = Router();

router.get('/stats', (req, res) => {
  try {
    const { project, branch } = req.query;
    res.json(getStatistics({ project, branch }));
  } catch (error) {
    logger.error('stats', 'Failed to fetch statistics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.get('/filters', (req, res) => {
  try {
    res.json(getFilterOptions());
  } catch (error) {
    logger.error('stats', 'Failed to fetch filter options', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
