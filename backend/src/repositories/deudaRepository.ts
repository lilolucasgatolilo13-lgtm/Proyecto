import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface DeudaEntidad {
  id: number;
  cliente_id: number;
  reserva_id: number;
  monto: number;
  estado: 'pendiente' | 'pagada' | 'perdonada';
  fecha: string;
}

export interface DeudaConDetalle extends DeudaEntidad {
  libro_titulo: string;
  precio_fijado: number;
  codigo_reserva: string;
}

export class DeudaRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  crear(datos: { cliente_id: number; reserva_id: number; monto: number; fecha: string }): DeudaEntidad {
    const stmt = this.getDb().prepare(`
      INSERT INTO deudas (cliente_id, reserva_id, monto, estado, fecha)
      VALUES (?, ?, ?, 'pendiente', ?)
    `);
    const info = stmt.run(datos.cliente_id, datos.reserva_id, datos.monto, datos.fecha);
    return this.buscarPorId(Number(info.lastInsertRowid))!;
  }

  buscarPorId(id: number): DeudaEntidad | undefined {
    return this.getDb().prepare('SELECT * FROM deudas WHERE id = ?').get(id) as DeudaEntidad | undefined;
  }

  buscarPorReservaId(reservaId: number): DeudaEntidad | undefined {
    return this.getDb().prepare('SELECT * FROM deudas WHERE reserva_id = ?').get(reservaId) as DeudaEntidad | undefined;
  }

  contarPendientesPorCliente(clienteId: number): number {
    const res = this.getDb()
      .prepare("SELECT COUNT(*) as total FROM deudas WHERE cliente_id = ? AND estado = 'pendiente'")
      .get(clienteId) as { total: number };
    return res.total;
  }

  listarPorCliente(clienteId: number): DeudaConDetalle[] {
    const query = `
      SELECT d.*, l.titulo AS libro_titulo, r.precio_fijado, r.codigo AS codigo_reserva
      FROM deudas d
      JOIN reservas r ON d.reserva_id = r.id
      JOIN libros l ON r.libro_id = l.id
      WHERE d.cliente_id = ?
      ORDER BY d.fecha DESC
    `;
    return this.getDb().prepare(query).all(clienteId) as DeudaConDetalle[];
  }

  actualizarEstado(id: number, estado: 'pagada' | 'perdonada'): void {
    this.getDb().prepare('UPDATE deudas SET estado = ? WHERE id = ?').run(estado, id);
  }

  registrarHistorial(datos: {
    usuario_id: number;
    tipo: 'baneo' | 'reversion_baneo' | 'perdon_deuda';
    motivo: string;
    fecha: string;
    administrador_id: number;
  }): void {
    this.getDb().prepare(`
      INSERT INTO historial_cuenta (usuario_id, tipo, motivo, fecha, administrador_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(datos.usuario_id, datos.tipo, datos.motivo, datos.fecha, datos.administrador_id);
  }
}
