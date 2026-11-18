import { Router } from 'express';
import { AdministracionController } from '../controllers/administracionController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new AdministracionController();

// RN-33, RN-44, HU-17: Avisos
router.get('/avisos', controller.listarAvisos);
router.post('/avisos', autenticar, requerirRol('administrador'), controller.crearAviso);

// RN-38, HU-17: Cierre del local
router.post('/cierres', autenticar, requerirRol('administrador'), controller.cerrarLocal);

// RN-35, RN-45, HU-18: Registro de actividad
router.get('/registro-actividad', autenticar, requerirRol('administrador'), controller.listarActividad);

// Jobs internos
router.post('/jobs/avisos-6h', controller.procesarAvisos6hJob);
router.post('/jobs/limpiar-actividad', controller.limpiarActividadJob);

export default router;
