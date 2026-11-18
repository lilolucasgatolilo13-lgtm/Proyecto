import { Request, Response } from 'express';
import { ReservaService } from '../services/reservaService';

export class RetiroController {
  private reservaService: ReservaService;

  constructor(reservaService?: ReservaService) {
    this.reservaService = reservaService || new ReservaService();
  }

  /** HU-09, RN-17: Buscar reserva activa por código (empleado) */
  buscarPorCodigo = (req: Request, res: Response): void => {
    try {
      const { codigo } = req.query;
      if (!codigo || typeof codigo !== 'string') {
        res.status(400).json({ error: 'Se requiere el código de reserva' });
        return;
      }

      const reserva = this.reservaService.buscarReservaPorCodigo(codigo);
      if (!reserva) {
        res.status(404).json({ error: 'Reserva no encontrada o no está activa' });
        return;
      }

      res.status(200).json(reserva);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al buscar la reserva' });
    }
  };

  /** HU-09, RN-17: Buscar reservas activas por documento (empleado) */
  buscarPorDocumento = (req: Request, res: Response): void => {
    try {
      const { documento } = req.query;
      if (!documento || typeof documento !== 'string') {
        res.status(400).json({ error: 'Se requiere el documento del cliente' });
        return;
      }

      const reservas = this.reservaService.buscarReservasPorDocumento(documento);
      res.status(200).json(reservas);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al buscar reservas' });
    }
  };

  /** HU-09, RN-17, RN-20, RN-21: Retirar una reserva (empleado) */
  retirar = (req: Request, res: Response): void => {
    try {
      const reservaId = Number(req.params.id);
      const usuarioId = req.usuario?.id;

      if (!usuarioId) {
        res.status(401).json({ error: 'No autorizado: se requiere sesión' });
        return;
      }

      const resultado = this.reservaService.retirarReserva(reservaId, usuarioId);
      res.status(200).json({
        ok: true,
        mensaje: 'Retiro exitoso',
        reserva_id: resultado.reservaId,
        libro: resultado.titulo,
        precio_fijado: resultado.precioFijado,
        precio_vigente: resultado.precioVigente,
        recargo_5: resultado.recargo5,
        total: resultado.total
      });
    } catch (error: any) {
      const mensaje = error.message || 'Error al retirar la reserva';
      const status = mensaje.includes('ya venció') || mensaje.includes('no está activa') || mensaje.includes('no encontrada')
        ? 400
        : 500;
      res.status(status).json({ error: mensaje });
    }
  };
}