import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createApprovalDelegationHandler,
  listApprovalDelegationsHandler,
} from '../controllers/delegation.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const delegationRouter = Router();
const managerRoles = requireRole(Role.MANAGER, Role.ADMIN);

delegationRouter.use(authenticate, managerRoles);
delegationRouter.get('/', listApprovalDelegationsHandler);
delegationRouter.post('/', createApprovalDelegationHandler);

export default delegationRouter;
