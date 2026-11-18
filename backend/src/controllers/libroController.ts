import { Request, Response } from 'express';
import { LibroService } from '../services/libroService';

export class LibroController {
  private libroService: LibroService;

  constructor(libroService?: LibroService) {
    this.libroService = libroService || new LibroService();
  }

  listar = (req: Request, res: Response): void => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const genero = typeof req.query.genero === 'string' ? req.query.genero : undefined;
      const editorial = typeof req.query.editorial === 'string' ? req.query.editorial : undefined;
      const idioma = typeof req.query.idioma === 'string' ? req.query.idioma : undefined;
      const precio_min = req.query.precio_min !== undefined ? Number(req.query.precio_min) : undefined;
      const precio_max = req.query.precio_max !== undefined ? Number(req.query.precio_max) : undefined;
      let disponible: boolean | undefined = undefined;
      if (req.query.disponible === 'true' || req.query.disponible === '1') disponible = true;
      if (req.query.disponible === 'false' || req.query.disponible === '0') disponible = false;

      const libros = this.libroService.obtenerCatalogo({
        q,
        genero,
        editorial,
        idioma,
        precio_min,
        precio_max,
        disponible
      });
      res.status(200).json(libros);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener el catálogo' });
    }
  };

  obtenerNovedades = (_req: Request, res: Response): void => {
    try {
      const novedades = this.libroService.obtenerNovedades();
      res.status(200).json(novedades);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener novedades' });
    }
  };

  obtenerSerie = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const serie = this.libroService.obtenerSerie(id);
      res.status(200).json(serie);
    } catch (error: any) {
      const mensaje = error.message || 'Error al obtener la serie';
      if (mensaje.includes('no encontrada')) {
        res.status(404).json({ error: mensaje });
        return;
      }
      res.status(500).json({ error: mensaje });
    }
  };

  listarSeries = (_req: Request, res: Response): void => {
    try {
      const series = this.libroService.listarSeries();
      res.status(200).json(series);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al listar series' });
    }
  };

  crear = (req: Request, res: Response): void => {
    try {
      const libro = this.libroService.crearLibro(req.body);
      res.status(201).json(libro);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al crear el libro' });
    }
  };

  actualizarCantidad = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const cantidad = req.body?.cantidad !== undefined ? Number(req.body.cantidad) : Number(req.body.cantidad_total);
      const libro = this.libroService.actualizarCantidad(id, cantidad);
      res.status(200).json(libro);
    } catch (error: any) {
      const mensaje = error.message || 'Error al actualizar cantidad';
      const status = mensaje.includes('no encontrado') ? 404 : 400;
      res.status(status).json({ error: mensaje });
    }
  };

  actualizar = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const usuarioId = (req as any).usuario?.id;
      const libro = this.libroService.actualizarLibro(id, req.body, usuarioId);
      res.status(200).json(libro);
    } catch (error: any) {
      const mensaje = error.message || 'Error al actualizar libro';
      const status = mensaje.includes('no encontrado') ? 404 : 400;
      res.status(status).json({ error: mensaje });
    }
  };

  ocultar = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const ocultar = req.body?.ocultar !== undefined ? Boolean(req.body.ocultar) : true;
      this.libroService.ocultarLibro(id, ocultar);
      res.status(200).json({ ok: true, mensaje: ocultar ? 'Libro ocultado' : 'Libro visible' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al ocultar libro';
      const status = mensaje.includes('no encontrado') ? 404 : 400;
      res.status(status).json({ error: mensaje });
    }
  };

  eliminar = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      this.libroService.eliminarLibro(id);
      res.status(200).json({ ok: true, mensaje: 'Libro eliminado' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al eliminar libro';
      const status = mensaje.includes('no encontrado') ? 404 : 400;
      res.status(status).json({ error: mensaje });
    }
  };

  obtenerPorId = (req: Request, res: Response): void => {
    try {
      const id = Number(req.params.id);
      const libro = this.libroService.obtenerPorId(id);
      res.status(200).json(libro);
    } catch (error: any) {
      const mensaje = error.message || 'Error al obtener el libro';
      if (mensaje.includes('no encontrado')) {
        res.status(404).json({ error: mensaje });
        return;
      }
      res.status(500).json({ error: mensaje });
    }
  };
}
