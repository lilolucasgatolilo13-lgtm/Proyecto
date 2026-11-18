import { Router, Request, Response, NextFunction } from 'express';
import { DeudaController } from '../controllers/deudaController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new DeudaController();

// C-01: Middleware de autenticación para jobs internos mediante secreto compartido
function validarJobSecret(req: Request, res: Response, next: NextFunction): void {
  const secretEsperado = process.env.JOB_SECRET;
  if (!secretEsperado || req.headers['x-job-secret'] !== secretEsperado) {
    res.status(403).json({ error: 'Acceso prohibido: secreto de job inválido o ausente' });
    return;
  }
  next();
}

// RN-26, RN-30, HU-06: Ver mis deudas
router.get('/deudas/mias', autenticar, requerirRol('cliente'), controller.obtenerMias);

// RN-28, HU-11: Empleado o admin marca deuda pagada en persona
router.post('/deudas/:id/pago', autenticar, requerirRol('empleado', 'administrador'), controller.registrarPago);

// RN-31, RN-45, HU-16: Administrador perdona deuda con motivo
router.post('/deudas/:id/perdon', autenticar, requerirRol('administrador'), controller.perdonar);

// Endpoint interno/job para vencimiento automático — protegido con secreto
router.post('/deudas/procesar-vencimientos', validarJobSecret, controller.procesarVencimientosJob);

export default router;
