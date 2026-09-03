import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getAreaHandler,
  listAreaAssetsHandler,
  updateAreaHandler,
} from '../controllers/area.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const router = Router();

router.use(authenticate);

router.get('/:areaId/assets', listAreaAssetsHandler);
router.get('/:id', getAreaHandler);
router.patch('/:id', requireRole(Role.ADMIN), updateAreaHandler);

export default router;
