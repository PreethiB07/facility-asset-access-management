import { Router } from 'express';
import {
  createAccessRequestHandler,
  getAccessRequestHandler,
  getMyAccessHandler,
  listAccessRequestsHandler,
} from '../controllers/access-request.controller';
import { authenticate } from '../middleware/authenticate.middleware';

const accessRequestRouter = Router();
const myAccessRouter = Router();

accessRequestRouter.use(authenticate);
accessRequestRouter.post('/', createAccessRequestHandler);
accessRequestRouter.get('/', listAccessRequestsHandler);
accessRequestRouter.get('/:id', getAccessRequestHandler);

myAccessRouter.use(authenticate);
myAccessRouter.get('/', getMyAccessHandler);

export { accessRequestRouter, myAccessRouter };
