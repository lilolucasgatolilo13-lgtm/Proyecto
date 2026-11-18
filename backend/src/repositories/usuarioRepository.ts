import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface Usuario {
  id: number;
  rol: 'cliente' | 'empleado' | 'administrador';
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  telefono: string;
  contrasena_hash: string;
  fecha_nacimiento: string;
  baneado: number;
}

export interface NuevoUsuario {
  rol: 'cliente' | 'empleado' | 'administrador';
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  telefono: string;
  contrasena_hash: string;
  fecha_nacimiento: string;
  baneado?: number;
}

export class UsuarioRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  crear(datos: NuevoUsuario): Usuario {
    const stmt = this.getDb().prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      datos.rol,
      datos.nombre,
      datos.apellido,
      datos.documento,
      datos.correo,
      datos.telefono,
      datos.contrasena_hash,
      datos.fecha_nacimiento,
      datos.baneado ?? 0
    );

    return this.buscarPorId(Number(info.lastInsertRowid))!;
  }

  buscarPorId(id: number): Usuario | undefined {
    return this.getDb().prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as Usuario | undefined;
  }

  buscarPorDocumento(documento: string): Usuario | undefined {
    return this.getDb().prepare('SELECT * FROM usuarios WHERE documento = ?').get(documento) as Usuario | undefined;
  }

  buscarPorCorreo(correo: string): Usuario | undefined {
    return this.getDb().prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo) as Usuario | undefined;
  }

  actualizarContrasena(id: number, contrasenaHash: string): void {
    this.getDb().prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(contrasenaHash, id);
  }

  actualizarBaneo(id: number, baneado: number): void {
    this.getDb().prepare('UPDATE usuarios SET baneado = ? WHERE id = ?').run(baneado, id);
  }

  contarPorRol(rol: string): number {
    const resultado = this.getDb().prepare('SELECT COUNT(*) as total FROM usuarios WHERE rol = ?').get(rol) as { total: number };
    return resultado.total;
  }

  // A-04: Método tipado para registrar actividad, evita (repo as any).getDb()
  registrarActividad(usuarioId: number, accion: string, detalle: string, fecha: string): void {
    this.getDb().prepare(
      `INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha) VALUES (?, ?, ?, ?)`
    ).run(usuarioId, accion, detalle, fecha);
  }
}
