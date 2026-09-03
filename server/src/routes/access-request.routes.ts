import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  approveAccessRequestHandler,
  createAccessRequestHandler,
  getAccessRequestHandler,
  getMyAccessHandler,
  listAccessRequestsHandler,
  listEmployeesHandler,
  listPendingAccessRequestsHandler,
  rejectAccessRequestHandler,
} from '../controllers/access-request.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const accessRequestRouter = Router();
const myAccessRouter = Router();
const employeeRouter = Router();

const managerRoles = requireRole(Role.MANAGER, Role.ADMIN);

accessRequestRouter.use(authenticate);
accessRequestRouter.get('/pending', managerRoles, listPendingAccessRequestsHandler);
accessRequestRouter.post('/', createAccessRequestHandler);
accessRequestRouter.get('/', listAccessRequestsHandler);
accessRequestRouter.patch('/:id/approve', managerRoles, approveAccessRequestHandler);
accessRequestRouter.patch('/:id/reject', managerRoles, rejectAccessRequestHandler);
accessRequestRouter.get('/:id', getAccessRequestHandler);

myAccessRouter.use(authenticate);
myAccessRouter.get('/', getMyAccessHandler);

employeeRouter.use(authenticate, managerRoles);
employeeRouter.get('/', listEmployeesHandler);

export { accessRequestRouter, myAccessRouter, employeeRouter };
