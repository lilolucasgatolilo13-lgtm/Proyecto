import { Request, Response } from 'express';
import { DeudaService } from '../services/deudaService';

export class DeudaController {
  private deudaService: DeudaService;

  constructor(deudaService?: DeudaService) {
    this.deudaService = deudaService || new DeudaService();
  }

  obtenerMias = (req: Request, res: Response): void => {
    try {
      const clienteId = (req as any).usuario.id;
      const deudas = this.deudaService.obtenerDeudasCliente(clienteId);
      res.status(200).json(deudas);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al obtener deudas' });
    }
  };

  registrarPago = (req: Request, res: Response): void => {
    try {
      const deudaId = Number(req.params.id);
      const deuda = this.deudaService.registrarPago(deudaId);
      res.status(200).json(deuda);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al registrar pago de deuda' });
    }
  };

  perdonar = (req: Request, res: Response): void => {
    try {
      const deudaId = Number(req.params.id);
      const motivo = req.body.motivo;
      const adminId = (req as any).usuario.id;

      if (!motivo) {
        res.status(400).json({ error: 'El motivo es obligatorio' });
        return;
      }

      const deuda = this.deudaService.perdonar(deudaId, motivo, adminId);
      res.status(200).json(deuda);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al perdonar deuda' });
    }
  };

  procesarVencimientosJob = (req: Request, res: Response): void => {
    try {
      const procesadas = this.deudaService.procesarVencimientos();
      res.status(200).json({ procesadas });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error en job de vencimientos' });
    }
  };
}
