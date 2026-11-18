import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface SesionConUsuario {
  token: string;
  usuario_id: number;
  ultima_actividad: string;
  rol: 'cliente' | 'empleado' | 'administrador';
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  baneado: number;
}

export class SesionRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  crear(token: string, usuarioId: number, ultimaActividad: string): void {
    this.getDb().prepare(`
      INSERT INTO sesiones (token, usuario_id, ultima_actividad)
      VALUES (?, ?, ?)
    `).run(token, usuarioId, ultimaActividad);
  }

  buscarPorToken(token: string): SesionConUsuario | undefined {
    const query = `
      SELECT s.token, s.usuario_id, s.ultima_actividad,
             u.rol, u.nombre, u.apellido, u.documento, u.correo, u.baneado
      FROM sesiones s
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.token = ?
    `;
    return this.getDb().prepare(query).get(token) as SesionConUsuario | undefined;
  }

  actualizarActividad(token: string, nuevaActividad: string): void {
    this.getDb().prepare(`
      UPDATE sesiones SET ultima_actividad = ? WHERE token = ?
    `).run(nuevaActividad, token);
  }

  eliminar(token: string): void {
    this.getDb().prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  }

  eliminarPorUsuario(usuarioId: number): void {
    this.getDb().prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId);
  }
}
