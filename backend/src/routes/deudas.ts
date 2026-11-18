import { Router } from 'express';
import { DeudaController } from '../controllers/deudaController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new DeudaController();

// RN-26, RN-30, HU-06: Ver mis deudas
router.get('/deudas/mias', autenticar, requerirRol('cliente'), controller.obtenerMias);

// RN-28, HU-11: Empleado o admin marca deuda pagada en persona
router.post('/deudas/:id/pago', autenticar, requerirRol('empleado', 'administrador'), controller.registrarPago);

// RN-31, RN-45, HU-16: Administrador perdona deuda con motivo
router.post('/deudas/:id/perdon', autenticar, requerirRol('administrador'), controller.perdonar);

// Endpoint interno/job para vencimiento automático
router.post('/deudas/procesar-vencimientos', controller.procesarVencimientosJob);

export default router;
