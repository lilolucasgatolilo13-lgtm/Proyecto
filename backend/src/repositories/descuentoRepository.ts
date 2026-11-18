import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';

export interface DescuentoEntidad {
  id: number;
  alcance: 'libro' | 'serie' | 'editorial' | 'catalogo';
  referencia_id: string | null;
  tipo: 'descuento' | 'aumento';
  porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export class DescuentoRepository {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  private getDb(): Database.Database {
    return this.db || obtenerBaseDatos();
  }

  crear(datos: Omit<DescuentoEntidad, 'id'>): DescuentoEntidad {
    const stmt = this.getDb().prepare(`
      INSERT INTO descuentos (alcance, referencia_id, tipo, porcentaje, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      datos.alcance,
      datos.referencia_id ?? null,
      datos.tipo,
      datos.porcentaje,
      datos.fecha_inicio,
      datos.fecha_fin
    );

    return this.buscarPorId(Number(info.lastInsertRowid))!;
  }

  buscarPorId(id: number): DescuentoEntidad | undefined {
    return this.getDb().prepare('SELECT * FROM descuentos WHERE id = ?').get(id) as DescuentoEntidad | undefined;
  }

  listarVigentes(fechaIso: string): DescuentoEntidad[] {
    const query = `
      SELECT * FROM descuentos
      WHERE fecha_inicio <= ? AND fecha_fin >= ?
      ORDER BY id DESC
    `;
    return this.getDb().prepare(query).all(fechaIso, fechaIso) as DescuentoEntidad[];
  }

  listarTodos(): DescuentoEntidad[] {
    return this.getDb().prepare('SELECT * FROM descuentos ORDER BY id DESC').all() as DescuentoEntidad[];
  }
}
