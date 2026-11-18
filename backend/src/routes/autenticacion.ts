import { Router } from 'express';
import { AutenticacionController } from '../controllers/autenticacionController';

const router = Router();
const controller = new AutenticacionController();

router.post('/login', controller.login);
router.post('/logout', controller.logout);

export default router;
