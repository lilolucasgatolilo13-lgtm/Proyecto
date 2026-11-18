import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { crearBaseDatos } from './conexion';

describe('T-02: Base de datos y tablas (RN-05)', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Usamos base de datos en memoria para aislar cada prueba
    db = crearBaseDatos(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('con la base vacía, al iniciar existen las 12 tablas del plan', () => {
    const tablasEsperadas = [
      'usuarios',
      'sesiones',
      'series',
      'libros',
      'reservas',
      'deudas',
      'descuentos',
      'avisos',
      'cierres_local',
      'historial_cuenta',
      'registro_actividad',
      'correos'
    ].sort();

    const filas = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    const tablasExistentes = filas.map((f) => f.name).sort();

    expect(tablasExistentes).toEqual(tablasEsperadas);
    expect(tablasExistentes.length).toBe(12);
  });

  it('insertar 2 usuarios con documento 40111222 falla por índice único (RN-05)', () => {
    const insertarUsuario = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertarUsuario.run(
      'cliente',
      'Ana',
      'Pérez',
      '40111222',
      'ana@mail.com',
      '11223344',
      'hash123',
      '2000-05-10'
    );

    expect(() => {
      insertarUsuario.run(
        'cliente',
        'Ana Duplicada',
        'Pérez',
        '40111222',
        'otra_ana@mail.com',
        '11223344',
        'hash123',
        '2000-05-10'
      );
    }).toThrowError(/UNIQUE constraint failed: usuarios\.documento/);
  });

  it('insertar 2 usuarios con correo repetido falla por índice único (RN-05)', () => {
    const insertarUsuario = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertarUsuario.run(
      'cliente',
      'Ana',
      'Pérez',
      '40111222',
      'ana@mail.com',
      '11223344',
      'hash123',
      '2000-05-10'
    );

    expect(() => {
      insertarUsuario.run(
        'cliente',
        'Ana Duplicada',
        'Pérez',
        '40999888',
        'ana@mail.com',
        '11223344',
        'hash123',
        '2000-05-10'
      );
    }).toThrowError(/UNIQUE constraint failed: usuarios\.correo/);
  });
});
