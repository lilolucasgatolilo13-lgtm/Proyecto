import { Router } from 'express';
import { UsuarioController } from '../controllers/usuarioController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new UsuarioController();

// RN-03, RN-04, HU-08: Solo empleado o administrador pueden crear cuentas de cliente en el local
router.post('/usuarios', autenticar, requerirRol('empleado', 'administrador'), controller.crear);

// RN-07, HU-07: El empleado restablece la contraseña del cliente en persona
router.post('/usuarios/:id/contrasena', autenticar, requerirRol('empleado', 'administrador'), controller.restablecerContrasena);

// RN-39, HU-13: El administrador banea la cuenta y puede revertir el baneo
router.post('/usuarios/:id/baneo', autenticar, requerirRol('administrador'), controller.banear);
router.delete('/usuarios/:id/baneo', autenticar, requerirRol('administrador'), controller.revertirBaneo);

// RN-39, HU-19: El empleado informa documento ajeno
router.post('/usuarios/:id/informe-documento', autenticar, requerirRol('empleado', 'administrador'), controller.informarDocumento);

// RN-40, HU-18: El administrador crea empleados y administradores con topes
router.post('/empleados', autenticar, requerirRol('administrador'), controller.crearPersonal);
router.post('/usuarios/personal', autenticar, requerirRol('administrador'), controller.crearPersonal);

export default router;
