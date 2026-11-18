import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-09: Catálogo y cantidad disponible (RN-08, RN-10, RN-11, HU-01)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    // Cargamos los datos iniciales de prueba (8 libros, 5 usuarios)
    cargarDatosIniciales(db);
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('sin sesión, GET /api/libros devuelve los 8 libros con su ficha completa (RN-08, HU-01)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/libros'
    });

    expect(res.statusCode).toBe(200);
    const libros = JSON.parse(res.payload);
    expect(Array.isArray(libros)).toBe(true);
    expect(libros.length).toBe(8);

    // Verificamos campos de ficha completa en uno de los libros
    const naruto1 = libros.find((l: any) => l.titulo === 'Naruto 1');
    expect(naruto1).toBeDefined();
    expect(naruto1.serie).toBe('Naruto');
    expect(naruto1.numero_tomo).toBe(1);
    expect(naruto1.autor).toBe('Masashi Kishimoto');
    expect(naruto1.editorial).toBe('Ivrea');
    expect(naruto1.idioma).toBe('Español');
    expect(naruto1.genero).toBe('Shonen');
    expect(naruto1.clasificacion_edad).toBe('ATP');
    expect(naruto1.precio).toBe(10000);
    expect(naruto1.cantidad_total).toBe(3);
    expect(naruto1.cantidad_disponible).toBe(3);
    expect(naruto1.agotado).toBe(false);

    // También verificamos GET /api/libros/:id
    const resDetalle = await inject(app, {
      method: 'GET',
      url: `/api/libros/${naruto1.id}`
    });
    expect(resDetalle.statusCode).toBe(200);
    expect(JSON.parse(resDetalle.payload).titulo).toBe('Naruto 1');
  });

  it('Naruto 3 (0 copias) aparece con la marca de agotado (RN-11)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/libros'
    });

    expect(res.statusCode).toBe(200);
    const libros = JSON.parse(res.payload);
    const naruto3 = libros.find((l: any) => l.titulo === 'Naruto 3');

    expect(naruto3).toBeDefined();
    expect(naruto3.cantidad_total).toBe(0);
    expect(naruto3.cantidad_disponible).toBe(0);
    expect(naruto3.agotado).toBe(true);
  });

  it('Naruto 2 (1 copia) con 1 reserva activa muestra 0 disponibles (RN-10)', async () => {
    // Buscamos Naruto 2 en la base
    const naruto2 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 2'").get() as any;
    expect(naruto2.cantidad_total).toBe(1);

    // Buscamos a Ana (cliente) para asociar la reserva
    const ana = db.prepare("SELECT * FROM usuarios WHERE documento = '40111222'").get() as any;

    // Creamos 1 reserva activa para Naruto 2
    db.prepare(`
      INSERT INTO reservas (codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
      VALUES ('RES-NARUTO-02', ?, ?, ?, ?, ?, 'activa')
    `).run(
      ana.id,
      naruto2.id,
      naruto2.precio,
      relojFalso.ahora().toISOString(),
      new Date(relojFalso.ahora().getTime() + 24 * 60 * 60 * 1000).toISOString()
    );

    const res = await inject(app, {
      method: 'GET',
      url: `/api/libros/${naruto2.id}`
    });

    expect(res.statusCode).toBe(200);
    const libroActualizado = JSON.parse(res.payload);
    expect(libroActualizado.cantidad_total).toBe(1);
    expect(libroActualizado.cantidad_disponible).toBe(0);
    expect(libroActualizado.agotado).toBe(true);
  });
});
