import { Request, Response } from 'express';
import { AdministracionService } from '../services/administracionService';

export class AdministracionController {
  private adminService: AdministracionService;

  constructor(adminService?: AdministracionService) {
    this.adminService = adminService || new AdministracionService();
  }

  crearAviso = (req: Request, res: Response): void => {
    try {
      const { titulo, texto } = req.body;
      const adminId = (req as any).usuario.id;
      const aviso = this.adminService.crearAviso(titulo, texto, adminId);
      res.status(201).json(aviso);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al crear aviso' });
    }
  };

  listarAvisos = (_req: Request, res: Response): void => {
    try {
      const avisos = this.adminService.listarAvisos();
      res.status(200).json(avisos);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al listar avisos' });
    }
  };

  cerrarLocal = (req: Request, res: Response): void => {
    try {
      const { fecha } = req.body;
      const adminId = (req as any).usuario.id;
      const resultado = this.adminService.cerrarLocal(fecha, adminId);
      res.status(200).json(resultado);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al registrar cierre de local' });
    }
  };

  listarActividad = (_req: Request, res: Response): void => {
    try {
      const actividad = this.adminService.listarRegistroActividad();
      res.status(200).json(actividad);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al obtener registro de actividad' });
    }
  };

  procesarAvisos6hJob = (_req: Request, res: Response): void => {
    try {
      const enviados = this.adminService.procesarAvisos6Horas();
      res.status(200).json({ enviados });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al procesar avisos de 6 horas' });
    }
  };

  limpiarActividadJob = (_req: Request, res: Response): void => {
    try {
      const eliminados = this.adminService.limpiarRegistroActividad();
      res.status(200).json({ eliminados });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al limpiar actividad antigua' });
    }
  };
}
