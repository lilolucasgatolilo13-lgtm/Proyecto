import { Router } from 'express';
import { DescuentoController } from '../controllers/descuentoController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new DescuentoController();

// HU-15, RN-32: Solo administrador puede gestionar descuentos y aumentos
router.post('/descuentos', autenticar, requerirRol('administrador'), controller.crear);

export default router;
