import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';
import { ahora } from '../config/reloj';

export interface Reserva {
  id: number;
  codigo: string;
  cliente_id: number;
  libro_id: number;
  precio_fijado: number;
  fecha_reserva: string;
  fecha_vencimiento: string;
  estado: 'activa' | 'retirada' | 'cancelada' | 'vencida';
  fecha_cancelacion: string | null;
  aviso_6h_para: string | null;
}

export interface ReservaConLibro extends Reserva {
  titulo: string;
  clasificacion_edad: string;
}

export class ReservaRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  /** RN-15, RN-20, RN-24: Crear una reserva */
  crear(datos: {
    codigo: string;
    cliente_id: number;
    libro_id: number;
    precio_fijado: number;
    fecha_reserva: string;
    fecha_vencimiento: string;
  }): Reserva {
    const stmt = this.getDb().prepare(`
      INSERT INTO reservas (codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'activa')
    `);
    const info = stmt.run(
      datos.codigo,
      datos.cliente_id,
      datos.libro_id,
      datos.precio_fijado,
      datos.fecha_reserva,
      datos.fecha_vencimiento
    );
    return this.buscarPorId(Number(info.lastInsertRowid))!;
  }

  /** Buscar reserva por ID */
  buscarPorId(id: number): Reserva | undefined {
    return this.getDb().prepare('SELECT * FROM reservas WHERE id = ?').get(id) as Reserva | undefined;
  }

  /** Buscar reserva por código */
  buscarPorCodigo(codigo: string): Reserva | undefined {
    return this.getDb().prepare('SELECT * FROM reservas WHERE codigo = ?').get(codigo) as Reserva | undefined;
  }

  /** RN-10: Contar reservas activas de un cliente */
  contarReservasActivasPorCliente(clienteId: number): number {
    const res = this.getDb().prepare(
      "SELECT COUNT(*) as total FROM reservas WHERE cliente_id = ? AND estado = 'activa'"
    ).get(clienteId) as { total: number };
    return res.total;
  }

  /** RN-14: Verificar si el cliente ya tiene una reserva activa de este libro */
  existeReservaActivaDeLibroPorCliente(clienteId: number, libroId: number): boolean {
    const res = this.getDb().prepare(
      "SELECT COUNT(*) as total FROM reservas WHERE cliente_id = ? AND libro_id = ? AND estado = 'activa'"
    ).get(clienteId, libroId) as { total: number };
    return res.total > 0;
  }

  /** RN-23: Obtener reservas activas de un cliente (para mostrar contador) */
  obtenerReservasActivasPorCliente(clienteId: number): Reserva[] {
    return this.getDb().prepare(
      "SELECT * FROM reservas WHERE cliente_id = ? AND estado = 'activa' ORDER BY fecha_vencimiento ASC"
    ).all(clienteId) as Reserva[];
  }

  /** RN-23, RN-18: Marcar como vencida una reserva por ID */
  marcarVencida(reservaId: number): void {
    this.getDb().prepare(
      "UPDATE reservas SET estado = 'vencida' WHERE id = ? AND estado = 'activa'"
    ).run(reservaId);
  }

  /** Actualizar estado genérico de reserva */
  actualizarEstado(reservaId: number, estado: string): void {
    this.getDb().prepare(
      'UPDATE reservas SET estado = ? WHERE id = ?'
    ).run(estado, reservaId);
  }

  /** RN-13, RN-19: Cancelar una reserva por ID */
  cancelar(reservaId: number): void {
    const fechaAhora = ahora().toISOString();
    this.getDb().prepare(
      "UPDATE reservas SET estado = 'cancelada', fecha_cancelacion = ? WHERE id = ? AND estado = 'activa'"
    ).run(fechaAhora, reservaId);
  }

  /** Obtener reservas activas de un cliente con datos del libro */
  obtenerReservasActivasConLibro(clienteId: number): (Reserva & { titulo: string; clasificacion_edad: string })[] {
    return this.getDb().prepare(`
      SELECT r.*, l.titulo, l.clasificacion_edad
      FROM reservas r
      JOIN libros l ON r.libro_id = l.id
      WHERE r.cliente_id = ? AND r.estado = 'activa'
      ORDER BY r.fecha_vencimiento ASC
    `).all(clienteId) as (Reserva & { titulo: string; clasificacion_edad: string })[];
  }

  /** Contar reservas activas de un libro (para cantidad disponible) */
  contarReservasActivasDeLibro(libroId: number): number {
    const res = this.getDb().prepare(
      "SELECT COUNT(*) as total FROM reservas WHERE libro_id = ? AND estado = 'activa'"
    ).get(libroId) as { total: number };
    return res.total;
  }

  /** RN-17: Buscar reservas activas por documento de cliente */
  buscarReservasActivasPorDocumento(documento: string): (Reserva & { nombre: string; apellido: string; documento: string })[] {
    return this.getDb().prepare(`
      SELECT r.*, u.nombre, u.apellido, u.documento
      FROM reservas r
      JOIN usuarios u ON r.cliente_id = u.id
      WHERE u.documento = ? AND r.estado = 'activa'
      ORDER BY r.fecha_vencimiento ASC
    `).all(documento) as (Reserva & { nombre: string; apellido: string; documento: string })[];
  }

  /** RN-17: Buscar reserva activa por código */
  buscarReservaActivaPorCodigo(codigo: string): (Reserva & { nombre: string; apellido: string; documento: string; titulo: string }) | undefined {
    return this.getDb().prepare(`
      SELECT r.*, u.nombre, u.apellido, u.documento, l.titulo
      FROM reservas r
      JOIN usuarios u ON r.cliente_id = u.id
      JOIN libros l ON r.libro_id = l.id
      WHERE r.codigo = ? AND r.estado = 'activa'
    `).get(codigo) as (Reserva & { nombre: string; apellido: string; documento: string; titulo: string }) | undefined;
  }

  /** RN-17: Marcar reserva como retirada */
  retirar(reservaId: number): void {
    this.getDb().prepare(
      "UPDATE reservas SET estado = 'retirada' WHERE id = ? AND estado = 'activa'"
    ).run(reservaId);
  }

  /** RN-42: Contar cancelaciones del mes calendario */
  contarCancelacionesDelMes(clienteId: string, anioMes: string): number {
    const res = this.getDb().prepare(
      `SELECT COUNT(*) as total FROM reservas
       WHERE cliente_id = ? AND estado = 'cancelada'
       AND strftime('%Y-%m', fecha_cancelacion) = ?`
    ).get(clienteId, anioMes) as { total: number };
    return res.total;
  }

  /** RN-39: Cancelar todas las reservas activas de un cliente (baneo) */
  cancelarTodasDeCliente(clienteId: number): number {
    const fechaAhora = ahora().toISOString();
    const info = this.getDb().prepare(
      "UPDATE reservas SET estado = 'cancelada', fecha_cancelacion = ? WHERE cliente_id = ? AND estado = 'activa'"
    ).run(fechaAhora, clienteId);
    return info.changes;
  }

  /** RN-38: Extender fecha de vencimiento por cierre de local */
  actualizarVencimiento(reservaId: number, nuevaFechaVencimiento: string): void {
    this.getDb().prepare(
      'UPDATE reservas SET fecha_vencimiento = ? WHERE id = ?'
    ).run(nuevaFechaVencimiento, reservaId);
  }

  /** RN-34: Registrar que se envió aviso de 6 horas para un vencimiento */
  actualizarAviso6h(reservaId: number, fechaAvisoPara: string): void {
    this.getDb().prepare(
      'UPDATE reservas SET aviso_6h_para = ? WHERE id = ?'
    ).run(fechaAvisoPara, reservaId);
  }

  /** Obtener todas las reservas activas con datos de cliente y libro */
  obtenerTodasActivasConDetalle(): (Reserva & { cliente_correo: string; cliente_nombre: string; titulo: string })[] {
    return this.getDb().prepare(`
      SELECT r.*, u.correo AS cliente_correo, u.nombre AS cliente_nombre, l.titulo
      FROM reservas r
      JOIN usuarios u ON r.cliente_id = u.id
      JOIN libros l ON r.libro_id = l.id
      WHERE r.estado = 'activa'
    `).all() as (Reserva & { cliente_correo: string; cliente_nombre: string; titulo: string })[];
  }
}
