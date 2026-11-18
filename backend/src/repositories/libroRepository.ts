import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface LibroEntidad {
  id: number;
  titulo: string;
  serie_id: number;
  numero_tomo: number;
  autor: string;
  editorial: string;
  idioma: string;
  genero: string;
  clasificacion_edad: string;
  portada_url: string;
  sinopsis: string;
  precio: number;
  cantidad_total: number;
  oculto: number;
  fecha_ingreso: string;
}

export interface LibroConDetalle extends LibroEntidad {
  serie: string;
  cantidad_disponible: number;
  agotado: boolean;
}

export interface FiltrosLibro {
  q?: string;
  genero?: string;
  editorial?: string;
  idioma?: string;
  disponible?: boolean;
  precio_min?: number;
  precio_max?: number;
}

export class LibroRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  listarPublicos(filtros?: FiltrosLibro): LibroConDetalle[] {
    let query = `
      SELECT l.*, s.nombre AS serie,
             COALESCE((
               SELECT COUNT(*)
               FROM reservas r
               WHERE r.libro_id = l.id AND r.estado = 'activa'
             ), 0) AS reservas_activas
      FROM libros l
      JOIN series s ON l.serie_id = s.id
      WHERE l.oculto = 0
    `;

    const params: any[] = [];

    if (filtros?.q) {
      const termino = `%${filtros.q.trim().toLowerCase()}%`;
      query += ` AND (LOWER(l.titulo) LIKE ? OR LOWER(l.autor) LIKE ? OR LOWER(s.nombre) LIKE ?)`;
      params.push(termino, termino, termino);
    }

    if (filtros?.genero) {
      query += ` AND LOWER(l.genero) = ?`;
      params.push(filtros.genero.trim().toLowerCase());
    }

    if (filtros?.editorial) {
      query += ` AND LOWER(l.editorial) = ?`;
      params.push(filtros.editorial.trim().toLowerCase());
    }

    if (filtros?.idioma) {
      query += ` AND LOWER(l.idioma) = ?`;
      params.push(filtros.idioma.trim().toLowerCase());
    }

    if (filtros?.precio_min !== undefined) {
      query += ` AND l.precio >= ?`;
      params.push(filtros.precio_min);
    }

    if (filtros?.precio_max !== undefined) {
      query += ` AND l.precio <= ?`;
      params.push(filtros.precio_max);
    }

    query += ` ORDER BY l.id ASC`;

    const filas = this.getDb().prepare(query).all(...params) as (LibroEntidad & { serie: string; reservas_activas: number })[];

    let resultados = filas.map((fila) => {
      const cantidad_disponible = Math.max(0, fila.cantidad_total - fila.reservas_activas);
      return {
        ...fila,
        cantidad_disponible,
        agotado: cantidad_disponible === 0
      };
    });

    if (filtros?.disponible !== undefined) {
      if (filtros.disponible) {
        resultados = resultados.filter((l) => l.cantidad_disponible > 0);
      } else {
        resultados = resultados.filter((l) => l.cantidad_disponible === 0);
      }
    }

    return resultados;
  }

  obtenerNovedades(fechaLimiteIso: string): LibroConDetalle[] {
    const query = `
      SELECT l.*, s.nombre AS serie,
             COALESCE((
               SELECT COUNT(*)
               FROM reservas r
               WHERE r.libro_id = l.id AND r.estado = 'activa'
             ), 0) AS reservas_activas
      FROM libros l
      JOIN series s ON l.serie_id = s.id
      WHERE l.oculto = 0 AND l.fecha_ingreso >= ?
      ORDER BY l.fecha_ingreso DESC, l.id DESC
    `;

    const filas = this.getDb().prepare(query).all(fechaLimiteIso) as (LibroEntidad & { serie: string; reservas_activas: number })[];

    return filas.map((fila) => {
      const cantidad_disponible = Math.max(0, fila.cantidad_total - fila.reservas_activas);
      return {
        ...fila,
        cantidad_disponible,
        agotado: cantidad_disponible === 0
      };
    });
  }

  obtenerSeriePorId(serieId: number): { id: number; nombre: string; libros: LibroConDetalle[] } | undefined {
    const serie = this.getDb().prepare('SELECT * FROM series WHERE id = ?').get(serieId) as { id: number; nombre: string } | undefined;
    if (!serie) {
      return undefined;
    }

    const query = `
      SELECT l.*, s.nombre AS serie,
             COALESCE((
               SELECT COUNT(*)
               FROM reservas r
               WHERE r.libro_id = l.id AND r.estado = 'activa'
             ), 0) AS reservas_activas
      FROM libros l
      JOIN series s ON l.serie_id = s.id
      WHERE l.serie_id = ? AND l.oculto = 0
      ORDER BY l.numero_tomo ASC
    `;

    const filas = this.getDb().prepare(query).all(serieId) as (LibroEntidad & { serie: string; reservas_activas: number })[];

    const libros = filas.map((fila) => {
      const cantidad_disponible = Math.max(0, fila.cantidad_total - fila.reservas_activas);
      return {
        ...fila,
        cantidad_disponible,
        agotado: cantidad_disponible === 0
      };
    });

    return {
      id: serie.id,
      nombre: serie.nombre,
      libros
    };
  }

  obtenerSeriePorNombre(nombre: string): { id: number; nombre: string } | undefined {
    return this.getDb().prepare('SELECT * FROM series WHERE LOWER(nombre) = LOWER(?)').get(nombre) as { id: number; nombre: string } | undefined;
  }

  crearSerie(nombre: string): { id: number; nombre: string } {
    const res = this.getDb().prepare('INSERT INTO series (nombre) VALUES (?)').run(nombre);
    return { id: Number(res.lastInsertRowid), nombre };
  }

  listarSeries(): { id: number; nombre: string }[] {
    return this.getDb().prepare('SELECT * FROM series ORDER BY nombre ASC').all() as { id: number; nombre: string }[];
  }

  buscarPorId(id: number, incluirOcultos: boolean = false): LibroConDetalle | undefined {
    let query = `
      SELECT l.*, s.nombre AS serie,
             COALESCE((
               SELECT COUNT(*)
               FROM reservas r
               WHERE r.libro_id = l.id AND r.estado = 'activa'
             ), 0) AS reservas_activas
      FROM libros l
      JOIN series s ON l.serie_id = s.id
      WHERE l.id = ?
    `;

    if (!incluirOcultos) {
      query += ' AND l.oculto = 0';
    }

    const fila = this.getDb().prepare(query).get(id) as (LibroEntidad & { serie: string; reservas_activas: number }) | undefined;

    if (!fila) {
      return undefined;
    }

    const cantidad_disponible = Math.max(0, fila.cantidad_total - fila.reservas_activas);
    return {
      ...fila,
      cantidad_disponible,
      agotado: cantidad_disponible === 0
    };
  }

  contarReservas(libroId: number): number {
    const res = this.getDb().prepare('SELECT COUNT(*) as total FROM reservas WHERE libro_id = ?').get(libroId) as { total: number };
    return res.total;
  }

  contarReservasActivas(libroId: number): number {
    const res = this.getDb().prepare("SELECT COUNT(*) as total FROM reservas WHERE libro_id = ? AND estado = 'activa'").get(libroId) as { total: number };
    return res.total;
  }

  crearLibro(datos: {
    titulo: string;
    serie_id: number;
    numero_tomo: number;
    autor: string;
    editorial: string;
    idioma: string;
    genero: string;
    clasificacion_edad: string;
    portada_url: string;
    sinopsis: string;
    precio: number;
    cantidad_total: number;
    fecha_ingreso: string;
  }): LibroConDetalle {
    const stmt = this.getDb().prepare(`
      INSERT INTO libros (titulo, serie_id, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, portada_url, sinopsis, precio, cantidad_total, oculto, fecha_ingreso)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    const info = stmt.run(
      datos.titulo,
      datos.serie_id,
      datos.numero_tomo,
      datos.autor,
      datos.editorial,
      datos.idioma,
      datos.genero,
      datos.clasificacion_edad,
      datos.portada_url,
      datos.sinopsis,
      datos.precio,
      datos.cantidad_total,
      datos.fecha_ingreso
    );

    return this.buscarPorId(Number(info.lastInsertRowid), true)!;
  }

  actualizarLibro(id: number, cambios: Partial<LibroEntidad>): void {
    const camposPermitidos = ['titulo', 'serie_id', 'numero_tomo', 'autor', 'editorial', 'idioma', 'genero', 'clasificacion_edad', 'portada_url', 'sinopsis', 'precio', 'cantidad_total', 'oculto'];
    const sets: string[] = [];
    const params: any[] = [];

    for (const [clave, valor] of Object.entries(cambios)) {
      if (camposPermitidos.includes(clave) && valor !== undefined) {
        sets.push(`${clave} = ?`);
        params.push(valor);
      }
    }

    if (sets.length === 0) return;

    params.push(id);
    this.getDb().prepare(`UPDATE libros SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  ocultarLibro(id: number, oculto: boolean): void {
    this.getDb().prepare('UPDATE libros SET oculto = ? WHERE id = ?').run(oculto ? 1 : 0, id);
  }

  eliminarLibro(id: number): void {
    this.getDb().prepare('DELETE FROM libros WHERE id = ?').run(id);
  }
}
