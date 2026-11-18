import { Router } from 'express';
import { ReservaController } from '../controllers/reservaController';
import { RetiroController } from '../controllers/retiroController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new ReservaController();
const retiroController = new RetiroController();

// HU-03, RN-15: Crear reserva (solo cliente autenticado)
router.post('/reservas', autenticar, requerirRol('cliente'), controller.crear);

// HU-04, RN-23: Mis reservas con contador (solo cliente autenticado)
router.get('/reservas/mias', autenticar, requerirRol('cliente'), controller.misReservas);

// HU-05, RN-19: Cancelar una reserva (solo cliente autenticado)
router.post('/reservas/:id/cancelar', autenticar, requerirRol('cliente'), controller.cancelar);

// HU-09, RN-17: Buscar reserva por código (solo empleado o administrador)
router.get('/reservas/buscar', autenticar, requerirRol('empleado', 'administrador'), retiroController.buscarPorCodigo);

// HU-09, RN-17: Buscar reservas por documento (solo empleado o administrador)
router.get('/reservas/buscar-por-documento', autenticar, requerirRol('empleado', 'administrador'), retiroController.buscarPorDocumento);

// HU-09, RN-17, RN-20, RN-21: Retirar una reserva (solo empleado o administrador)
router.post('/reservas/:id/retirar', autenticar, requerirRol('empleado', 'administrador'), retiroController.retirar);

// RN-01: Pago online no existe
router.post('/pagos', (_req, res) => {
  res.status(404).json({ error: 'Pago online no disponible. El pago se hace en efectivo en el local.' });
});

export default router;