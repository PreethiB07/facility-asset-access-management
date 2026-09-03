import { Router } from 'express';
import { getCompanyByIdHandler, getMyCompanyHandler } from '../controllers/company.controller';
import { authenticate } from '../middleware/authenticate.middleware';

const companyRouter = Router();

companyRouter.use(authenticate);
companyRouter.get('/', getMyCompanyHandler);
companyRouter.get('/:id', getCompanyByIdHandler);

export default companyRouter;
