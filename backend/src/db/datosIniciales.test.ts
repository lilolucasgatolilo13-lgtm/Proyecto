import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { crearBaseDatos } from './conexion';
import { cargarDatosIniciales } from './datosIniciales';

describe('T-08: Datos iniciales (Base)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = crearBaseDatos(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('tras el script hay 1 administrador, 1 empleado, 3 clientes y 8 libros con sus precios y copias', () => {
    cargarDatosIniciales(db);

    // Verificación de usuarios
    const admins = db.prepare("SELECT * FROM usuarios WHERE rol = 'administrador'").all();
    const empleados = db.prepare("SELECT * FROM usuarios WHERE rol = 'empleado'").all();
    const clientes = db.prepare("SELECT * FROM usuarios WHERE rol = 'cliente'").all();

    expect(admins.length).toBe(1);
    expect(empleados.length).toBe(1);
    expect(clientes.length).toBe(3);

    // Verificación de libros
    const libros = db.prepare('SELECT * FROM libros ORDER BY id ASC').all() as any[];
    expect(libros.length).toBe(8);

    // Verificamos precios y copias según los datos de prueba comunes
    const naruto1 = libros.find((l) => l.titulo === 'Naruto 1');
    expect(naruto1).toBeDefined();
    expect(naruto1.precio).toBe(10000);
    expect(naruto1.cantidad_total).toBe(3);

    const naruto2 = libros.find((l) => l.titulo === 'Naruto 2');
    expect(naruto2.precio).toBe(10000);
    expect(naruto2.cantidad_total).toBe(1);

    const naruto3 = libros.find((l) => l.titulo === 'Naruto 3');
    expect(naruto3.precio).toBe(10000);
    expect(naruto3.cantidad_total).toBe(0);

    const berserk1 = libros.find((l) => l.titulo === 'Berserk 1');
    expect(berserk1.precio).toBe(12000);
    expect(berserk1.cantidad_total).toBe(2);
    expect(berserk1.clasificacion_edad).toBe('+18');

    const onePiece1 = libros.find((l) => l.titulo === 'One Piece 1');
    expect(onePiece1.precio).toBe(9000);
    expect(onePiece1.cantidad_total).toBe(5);

    const sailorMoon1 = libros.find((l) => l.titulo === 'Sailor Moon 1');
    expect(sailorMoon1.precio).toBe(8000);
    expect(sailorMoon1.cantidad_total).toBe(5);

    const deathNote1 = libros.find((l) => l.titulo === 'Death Note 1');
    expect(deathNote1.precio).toBe(9000);
    expect(deathNote1.cantidad_total).toBe(2);

    const dragonBall1 = libros.find((l) => l.titulo === 'Dragon Ball 1');
    expect(dragonBall1.precio).toBe(8500);
    expect(dragonBall1.cantidad_total).toBe(4);
  });

  it('correr el script 2 veces no duplica nada', () => {
    cargarDatosIniciales(db);
    cargarDatosIniciales(db); // Segunda ejecución

    const totalUsuarios = (db.prepare('SELECT COUNT(*) as c FROM usuarios').get() as { c: number }).c;
    const totalLibros = (db.prepare('SELECT COUNT(*) as c FROM libros').get() as { c: number }).c;
    const totalSeries = (db.prepare('SELECT COUNT(*) as c FROM series').get() as { c: number }).c;

    expect(totalUsuarios).toBe(5); // 1 admin + 1 empleado + 3 clientes
    expect(totalLibros).toBe(8);
    expect(totalSeries).toBe(6);
  });
});
