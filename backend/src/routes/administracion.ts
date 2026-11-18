import { Router, Request, Response, NextFunction } from 'express';
import { AdministracionController } from '../controllers/administracionController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new AdministracionController();

// C-01: Middleware de autenticación para jobs internos mediante secreto compartido
function validarJobSecret(req: Request, res: Response, next: NextFunction): void {
  const secretEsperado = process.env.JOB_SECRET;
  if (!secretEsperado || req.headers['x-job-secret'] !== secretEsperado) {
    res.status(403).json({ error: 'Acceso prohibido: secreto de job inválido o ausente' });
    return;
  }
  next();
}

// RN-33, RN-44, HU-17: Avisos
router.get('/avisos', controller.listarAvisos);
router.post('/avisos', autenticar, requerirRol('administrador'), controller.crearAviso);

// RN-38, HU-17: Cierre del local
router.post('/cierres', autenticar, requerirRol('administrador'), controller.cerrarLocal);

// RN-35, RN-45, HU-18: Registro de actividad
router.get('/registro-actividad', autenticar, requerirRol('administrador'), controller.listarActividad);

// Jobs internos — protegidos con secreto compartido (C-01)
router.post('/jobs/avisos-6h', validarJobSecret, controller.procesarAvisos6hJob);
router.post('/jobs/limpiar-actividad', validarJobSecret, controller.limpiarActividadJob);

export default router;
