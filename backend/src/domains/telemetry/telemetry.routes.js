import { Router } from 'express';
import * as service from './telemetry.service.js';
import logger from '../../lib/logger.js';

const router = Router();

router.get('/cost', (req, res) => {
  try {
    res.json(service.getCostData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch cost data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch cost data' });
  }
});

router.get('/time', (req, res) => {
  try {
    res.json(service.getTimeData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch time data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch time data' });
  }
});

router.get('/reliability', (req, res) => {
  try {
    res.json(service.getReliabilityData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch reliability data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch reliability data' });
  }
});

router.get('/prompts', (req, res) => {
  try {
    res.json(service.getPromptsData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch prompts data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch prompts data' });
  }
});

router.get('/prompts/:id', (req, res) => {
  try {
    res.json(service.getPromptById(req.params.id));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch prompt', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

router.get('/sessions', (req, res) => {
  try {
    res.json(service.getSessionsData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch sessions data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sessions data' });
  }
});

router.get('/productivity', (req, res) => {
  try {
    res.json(service.getProductivityData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch productivity data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch productivity data' });
  }
});

router.get('/health', (req, res) => {
  try {
    res.json(service.getHealthData());
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch health data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch health data' });
  }
});

router.get('/summary', (req, res) => {
  try {
    res.json(service.getSummaryData(req.query));
  } catch (error) {
    logger.error('telemetry', 'Failed to fetch summary data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch summary data' });
  }
});

export default router;
