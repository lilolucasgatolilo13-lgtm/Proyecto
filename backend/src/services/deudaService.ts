import { DeudaRepository, DeudaConDetalle, DeudaEntidad } from '../repositories/deudaRepository';
import { ReservaRepository } from '../repositories/reservaRepository';
import { CorreoService } from './correoService';
import { ahora } from '../config/reloj';

export class DeudaService {
  private deudaRepo: DeudaRepository;
  private reservaRepo: ReservaRepository;
  private correoService: CorreoService;

  constructor(
    deudaRepo?: DeudaRepository,
    reservaRepo?: ReservaRepository,
    correoService?: CorreoService
  ) {
    this.deudaRepo = deudaRepo || new DeudaRepository();
    this.reservaRepo = reservaRepo || new ReservaRepository();
    this.correoService = correoService || new CorreoService();
  }

  /**
   * RN-18, RN-23, RN-26: Vencimiento automático de reservas pasadas de hora y creación de deuda del 5%.
   */
  procesarVencimientos(): number {
    const ahoraIso = ahora().toISOString();
    const base = (this.reservaRepo as any).getDb ? (this.reservaRepo as any).getDb() : null;

    // Consultamos todas las reservas activas que hayan cumplido su plazo
    const query = `
      SELECT r.*, u.correo AS cliente_correo, l.titulo AS libro_titulo
      FROM reservas r
      JOIN usuarios u ON r.cliente_id = u.id
      JOIN libros l ON r.libro_id = l.id
      WHERE r.estado = 'activa' AND r.fecha_vencimiento <= ?
    `;

    const reservasVencidas = (this.reservaRepo as any)
      .getDb()
      .prepare(query)
      .all(ahoraIso) as any[];

    let procesadas = 0;

    for (const r of reservasVencidas) {
      // 1. Pasar reserva a vencida (libera el libro automáticamente)
      this.reservaRepo.actualizarEstado(r.id, 'vencida');

      // 2. Crear deuda del 5% calculada sobre precio_fijado (idempotente)
      const deudaExistente = this.deudaRepo.buscarPorReservaId(r.id);
      if (!deudaExistente) {
        const montoDeuda = Math.round(r.precio_fijado * 0.05);
        this.deudaRepo.crear({
          cliente_id: r.cliente_id,
          reserva_id: r.id,
          monto: montoDeuda,
          fecha: ahoraIso
        });
      }

      // 3. Notificar vencimiento por correo (RN-34)
      try {
        this.correoService.enviar(
          r.cliente_correo,
          'Reserva vencida',
          `Tu reserva del libro "${r.libro_titulo}" ha vencido. Se ha generado una deuda de $${Math.round(r.precio_fijado * 0.05)}.`
        );
      } catch {
        // Correos no frenan operaciones
      }

      procesadas++;
    }

    return procesadas;
  }

  obtenerDeudasCliente(clienteId: number): DeudaConDetalle[] {
    return this.deudaRepo.listarPorCliente(clienteId);
  }

  tieneDeudaPendiente(clienteId: number): boolean {
    return this.deudaRepo.contarPendientesPorCliente(clienteId) > 0;
  }

  /**
   * RN-28, HU-11: El empleado marca la deuda como pagada en persona y en efectivo.
   */
  registrarPago(deudaId: number): DeudaEntidad {
    const deuda = this.deudaRepo.buscarPorId(deudaId);
    if (!deuda) {
      throw new Error('Deuda no encontrada');
    }
    if (deuda.estado !== 'pendiente') {
      throw new Error(`La deuda ya se encuentra ${deuda.estado}`);
    }

    this.deudaRepo.actualizarEstado(deudaId, 'pagada');

    // Registrar en actividad
    const ahoraIso = ahora().toISOString();
    (this.deudaRepo as any).getDb().prepare(`
      INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
      VALUES (NULL, 'pago_deuda', ?, ?)
    `).run(`Pago de deuda #${deuda.id} por $${deuda.monto}`, ahoraIso);

    return this.deudaRepo.buscarPorId(deudaId)!;
  }

  /**
   * RN-31, RN-45, HU-16: El administrador perdona una deuda dejando el motivo escrito.
   */
  perdonar(deudaId: number, motivo: string, administradorId: number): DeudaEntidad {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo del perdón de deuda es obligatorio');
    }

    const deuda = this.deudaRepo.buscarPorId(deudaId);
    if (!deuda) {
      throw new Error('Deuda no encontrada');
    }
    if (deuda.estado !== 'pendiente') {
      throw new Error(`La deuda ya se encuentra ${deuda.estado}`);
    }

    const ahoraIso = ahora().toISOString();

    // Actualizar estado a perdonada
    this.deudaRepo.actualizarEstado(deudaId, 'perdonada');

    // Guardar en historial_cuenta con fecha y motivo (RN-45)
    this.deudaRepo.registrarHistorial({
      usuario_id: deuda.cliente_id,
      tipo: 'perdon_deuda',
      motivo: motivo.trim(),
      fecha: ahoraIso,
      administrador_id: administradorId
    });

    // Registrar en registro_actividad
    (this.deudaRepo as any).getDb().prepare(`
      INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
      VALUES (?, 'perdon_deuda', ?, ?)
    `).run(administradorId, `Deuda #${deuda.id} perdonada. Motivo: ${motivo.trim()}`, ahoraIso);

    return this.deudaRepo.buscarPorId(deudaId)!;
  }
}
