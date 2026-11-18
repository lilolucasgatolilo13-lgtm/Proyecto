import Database from 'better-sqlite3';
import path from 'path';
import { ESQUEMA_SQL } from './esquema';

let dbInstancia: Database.Database | null = null;

export function crearBaseDatos(ruta?: string): Database.Database {
  const rutaDb = ruta || process.env.DB_PATH || path.join(__dirname, '../../comiqueria.db');
  const db = new Database(rutaDb);
  db.pragma('journal_mode = WAL');
  db.exec(ESQUEMA_SQL);
  return db;
}

export function obtenerBaseDatos(): Database.Database {
  if (!dbInstancia) {
    dbInstancia = crearBaseDatos();
  }
  return dbInstancia;
}

export function establecerBaseDatos(db: Database.Database): void {
  dbInstancia = db;
}

export function cerrarBaseDatos(): void {
  if (dbInstancia) {
    dbInstancia.close();
    dbInstancia = null;
  }
}
