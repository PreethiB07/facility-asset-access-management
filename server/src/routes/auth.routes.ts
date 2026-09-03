import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  login,
  me,
  protectedAdminTest,
  protectedManagerTest,
  protectedTest,
  protectedUserTest,
  register,
} from '../controllers/auth.controller';
import { authenticate, requireRole } from '../middleware/authenticate.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/protected-test', authenticate, protectedTest);
router.get('/protected-test/user', authenticate, requireRole(Role.USER), protectedUserTest);
router.get('/protected-test/manager', authenticate, requireRole(Role.MANAGER), protectedManagerTest);
router.get('/protected-test/admin', authenticate, requireRole(Role.ADMIN), protectedAdminTest);

export default router;
