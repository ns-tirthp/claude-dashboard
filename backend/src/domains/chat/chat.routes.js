import { Router } from 'express';
import { processChat, getChatSessions, getChatSessionById, deleteChatSession } from './chat.service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import logger from '../../lib/logger.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const result = await processChat(message, sessionId);
    res.json(result);
  } catch (err) {
    if (err.message === 'message is required') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('chat', 'Chat processing failed', { error: err.message });
    res.status(500).json({ error: `Something went wrong: ${err.message}` });
  }
});

router.get('/chat/sessions', (req, res) => {
  try {
    const sessions = getChatSessions();
    res.json(sessions);
  } catch (err) {
    logger.error('chat', 'Failed to list sessions', { error: err.message });
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.get('/chat/sessions/:id', (req, res) => {
  try {
    const session = getChatSessionById(req.params.id);
    res.json(session);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('chat', 'Failed to fetch session', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.delete('/chat/sessions/:id', (req, res) => {
  try {
    const result = deleteChatSession(req.params.id);
    res.json(result);
  } catch (err) {
    logger.error('chat', 'Failed to delete session', { error: err.message });
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
