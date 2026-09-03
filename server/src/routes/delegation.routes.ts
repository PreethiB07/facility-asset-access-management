import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createApprovalDelegationHandler,
  listApprovalDelegationsHandler,
} from '../controllers/delegation.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const delegationRouter = Router();
delegationRouter.use(authenticate, requireRole(Role.MANAGER));
delegationRouter.get('/', listApprovalDelegationsHandler);
delegationRouter.post('/', createApprovalDelegationHandler);

export default delegationRouter;
