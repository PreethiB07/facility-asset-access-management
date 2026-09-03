import express from 'express';
import cors from 'cors';
import areaRoutes from './routes/area.routes';
import assetRoutes from './routes/asset.routes';
import authRoutes from './routes/auth.routes';
import facilityRoutes from './routes/facility.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/assets', assetRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
