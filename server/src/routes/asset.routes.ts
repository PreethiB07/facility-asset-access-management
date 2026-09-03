import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createAssetHandler,
  getAssetHandler,
  listAssetsHandler,
  updateAssetHandler,
} from '../controllers/asset.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const router = Router();

router.use(authenticate);

router.get('/', listAssetsHandler);
router.post('/', requireRole(Role.ADMIN), createAssetHandler);
router.get('/:id', getAssetHandler);
router.patch('/:id', requireRole(Role.ADMIN), updateAssetHandler);

export default router;
