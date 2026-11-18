import { Request, Response } from 'express';
import { ReservaService } from '../services/reservaService';

export class ReservaController {
  private reservaService: ReservaService;

  constructor(reservaService?: ReservaService) {
    this.reservaService = reservaService || new ReservaService();
  }

  /** HU-03, RN-15: Crear reserva */
  crear = (req: Request, res: Response): void => {
    try {
      const clienteId = req.usuario?.id;
      const { libro_id } = req.body;

      if (!clienteId) {
        res.status(401).json({ error: 'No autorizado: se requiere sesión' });
        return;
      }

      if (!libro_id) {
        res.status(400).json({ error: 'Se requiere libro_id' });
        return;
      }

      const reserva = this.reservaService.crearReserva(clienteId, Number(libro_id));
      res.status(201).json(reserva);
    } catch (error: any) {
      const mensaje = error.message || 'Error al crear la reserva';
      res.status(400).json({ error: mensaje });
    }
  };

  /** HU-04, RN-23: Mis reservas con contador */
  misReservas = (req: Request, res: Response): void => {
    try {
      const clienteId = req.usuario?.id;

      if (!clienteId) {
        res.status(401).json({ error: 'No autorizado: se requiere sesión' });
        return;
      }

      const reservas = this.reservaService.obtenerMisReservas(clienteId);
      res.status(200).json(reservas);
    } catch (error: any) {
      const mensaje = error.message || 'Error al obtener las reservas';
      res.status(500).json({ error: mensaje });
    }
  };

  /** HU-05, RN-19, RN-42: Cancelar una reserva (cliente) */
  cancelar = (req: Request, res: Response): void => {
    try {
      const clienteId = req.usuario?.id;
      const reservaId = Number(req.params.id);

      if (!clienteId) {
        res.status(401).json({ error: 'No autorizado: se requiere sesión' });
        return;
      }

      this.reservaService.cancelarReserva(reservaId, clienteId);
      res.status(200).json({ ok: true, mensaje: 'Reserva cancelada exitosamente' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al cancelar la reserva';
      const lowerMensaje = mensaje.toLowerCase();
      const status = lowerMensaje.includes('no se puede cancelar') || lowerMensaje.includes('no está activa') || lowerMensaje.includes('no pertenece') || lowerMensaje.includes('límite de 5 cancelaciones')
        ? 400
        : 500;
      res.status(status).json({ error: mensaje });
    }
  };
}