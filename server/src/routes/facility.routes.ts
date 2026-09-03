import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createFacilityHandler,
  getFacilityHandler,
  listFacilitiesHandler,
  updateFacilityHandler,
} from '../controllers/facility.controller';
import { createAreaHandler, listFacilityAreasHandler } from '../controllers/area.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const router = Router();

router.use(authenticate);

router.get('/', listFacilitiesHandler);
router.post('/', requireRole(Role.ADMIN), createFacilityHandler);
router.get('/:facilityId/areas', listFacilityAreasHandler);
router.post('/:facilityId/areas', requireRole(Role.ADMIN), createAreaHandler);
router.get('/:id', getFacilityHandler);
router.patch('/:id', requireRole(Role.ADMIN), updateFacilityHandler);

export default router;
