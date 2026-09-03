import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
