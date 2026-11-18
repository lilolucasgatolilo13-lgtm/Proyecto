import { Router } from 'express';
import { LibroController } from '../controllers/libroController';
import { DescuentoController } from '../controllers/descuentoController';
import { autenticar, requerirRol } from '../middlewares/autenticacion';

const router = Router();
const controller = new LibroController();
const descuentoController = new DescuentoController();

// HU-01, RN-08: Catálogo público visible sin sesión
router.get('/libros', controller.listar);

// HU-02, RN-41: Sección de novedades (antes de /libros/:id)
router.get('/libros/novedades', controller.obtenerNovedades);

// HU-02, RN-09: Sección de ofertas (antes de /libros/:id)
router.get('/libros/ofertas', descuentoController.obtenerOfertas);

// HU-01: Detalle de libro por ID
router.get('/libros/:id', controller.obtenerPorId);

// HU-02, RN-09, HU-14: Series y tomos en orden
router.get('/series', controller.listarSeries);
router.get('/series/:id', controller.obtenerSerie);

// HU-12, RN-13: Actualizar cantidad de copias (empleado o administrador)
router.patch('/libros/:id/cantidad', autenticar, requerirRol('empleado', 'administrador'), controller.actualizarCantidad);

// HU-14, RN-08, RN-12, RN-41: Administración exclusiva por Administrador
router.post('/libros', autenticar, requerirRol('administrador'), controller.crear);
router.patch('/libros/:id', autenticar, requerirRol('administrador'), controller.actualizar);
router.put('/libros/:id', autenticar, requerirRol('administrador'), controller.actualizar);
router.patch('/libros/:id/ocultar', autenticar, requerirRol('administrador'), controller.ocultar);
router.delete('/libros/:id', autenticar, requerirRol('administrador'), controller.eliminar);

export default router;
