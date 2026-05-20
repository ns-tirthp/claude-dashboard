import { Router } from 'express';
import statsRouter from './domains/stats/stats.routes.js';
import telemetryRouter from './domains/telemetry/telemetry.routes.js';
import chatRouter from './domains/chat/chat.routes.js';
import historyRouter from './domains/history/history.routes.js';
import otlpRouter from './domains/otlp/otlp.routes.js';

const api = Router();

api.use(statsRouter);
api.use('/telemetry', telemetryRouter);
api.use(chatRouter);
api.use(historyRouter);

export { api, otlpRouter };
