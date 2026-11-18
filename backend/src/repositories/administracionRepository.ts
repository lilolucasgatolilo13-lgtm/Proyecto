import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface AvisoEntidad {
  id: number;
  titulo: string;
  texto: string;
  fecha_publicacion: string;
  administrador_id: number;
}

export interface CierreLocalEntidad {
  id: number;
  fecha: string;
  administrador_id: number;
}

export interface RegistroActividadEntidad {
  id: number;
  usuario_id: number | null;
  accion: string;
  detalle: string;
  fecha: string;
  usuario_nombre?: string;
  usuario_rol?: string;
}

export class AdministracionRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  // Avisos (T-29)
  crearAviso(datos: { titulo: string; texto: string; fecha_publicacion: string; administrador_id: number }): AvisoEntidad {
    const stmt = this.getDb().prepare(`
      INSERT INTO avisos (titulo, texto, fecha_publicacion, administrador_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(datos.titulo, datos.texto, datos.fecha_publicacion, datos.administrador_id);
    return this.buscarAvisoPorId(Number(info.lastInsertRowid))!;
  }

  buscarAvisoPorId(id: number): AvisoEntidad | undefined {
    return this.getDb().prepare('SELECT * FROM avisos WHERE id = ?').get(id) as AvisoEntidad | undefined;
  }

  /**
   * RN-33, RN-44: Avisos visibles durante 7 días (168 horas) desde su publicación
   */
  listarAvisosActivos(fechaReferenciaIso: string): AvisoEntidad[] {
    const query = `
      SELECT * FROM avisos
      WHERE datetime(fecha_publicacion, '+7 days') >= datetime(?)
        AND fecha_publicacion <= ?
      ORDER BY fecha_publicacion DESC
    `;
    return this.getDb().prepare(query).all(fechaReferenciaIso, fechaReferenciaIso) as AvisoEntidad[];
  }

  // Cierres de local (T-30)
  registrarCierre(fecha: string, administradorId: number): CierreLocalEntidad {
    const stmt = this.getDb().prepare(`
      INSERT INTO cierres_local (fecha, administrador_id)
      VALUES (?, ?)
    `);
    const info = stmt.run(fecha, administradorId);
    return {
      id: Number(info.lastInsertRowid),
      fecha,
      administrador_id: administradorId
    };
  }

  esDiaCerrado(fechaStr: string): boolean {
    const res = this.getDb().prepare('SELECT COUNT(*) as total FROM cierres_local WHERE fecha = ?').get(fechaStr) as { total: number };
    return res.total > 0;
  }

  // Registro de actividad (T-33)
  registrarActividad(usuarioId: number | null, accion: string, detalle: string, fecha: string): void {
    this.getDb().prepare(`
      INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
      VALUES (?, ?, ?, ?)
    `).run(usuarioId, accion, detalle, fecha);
  }

  listarActividad(limite: number = 100): RegistroActividadEntidad[] {
    const query = `
      SELECT r.*, u.nombre || ' ' || u.apellido AS usuario_nombre, u.rol AS usuario_rol
      FROM registro_actividad r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.fecha DESC
      LIMIT ?
    `;
    return this.getDb().prepare(query).all(limite) as RegistroActividadEntidad[];
  }

  /**
   * RN-35: Eliminar registros de actividad con más de 30 días de antigüedad
   */
  purgarActividadAntigua(fechaLimiteIso: string): number {
    const info = this.getDb().prepare(`
      DELETE FROM registro_actividad
      WHERE fecha < ?
    `).run(fechaLimiteIso);
    return info.changes;
  }
}
