import express from 'express';
import cors from 'cors';
import { api, otlpRouter } from './routes.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', api);
app.use(otlpRouter);

app.use(errorHandler);

export default app;
