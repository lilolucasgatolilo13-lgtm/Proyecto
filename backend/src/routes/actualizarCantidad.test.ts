import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-12: Actualizar cantidad de copias (RN-13, RN-41, HU-12)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenEmi: string;
  let tokenAda: string;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    cargarDatosIniciales(db);

    const ada = db.prepare("SELECT * FROM usuarios WHERE documento = '30000001'").get() as any;
    const emi = db.prepare("SELECT * FROM usuarios WHERE documento = '30000002'").get() as any;

    tokenAda = 'token-ada-admin';
    tokenEmi = 'token-emi-empleado';

    db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
      .run(tokenAda, ada.id, relojFalso.ahora().toISOString());

    db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
      .run(tokenEmi, emi.id, relojFalso.ahora().toISOString());
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('Emi sube Naruto 1 de 3 a 10 copias y el catálogo muestra el valor nuevo en el instante (RN-13, HU-12)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    expect(naruto1.cantidad_total).toBe(3);

    const res = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${naruto1.id}/cantidad`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { cantidad: 10 }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).cantidad_total).toBe(10);
    expect(JSON.parse(res.payload).cantidad_disponible).toBe(10);

    // En el catálogo público se refleja de inmediato
    const resCatalogo = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
    expect(JSON.parse(resCatalogo.payload).cantidad_disponible).toBe(10);
  });

  it('Naruto 1 con 2 reservas activas: bajar a 1 copia es rechazado. Bajar a 2 funciona (RN-13, HU-12)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const ana = db.prepare("SELECT * FROM usuarios WHERE documento = '40111222'").get() as any;

    // Insertamos 2 reservas activas
    db.prepare(`
      INSERT INTO reservas (codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
      VALUES ('RES-1', ?, ?, 10000, ?, ?, 'activa'),
             ('RES-2', ?, ?, 10000, ?, ?, 'activa')
    `).run(
      ana.id, naruto1.id, relojFalso.ahora().toISOString(), relojFalso.ahora().toISOString(),
      ana.id, naruto1.id, relojFalso.ahora().toISOString(), relojFalso.ahora().toISOString()
    );

    // Intentar bajar a 1 copia: debe ser rechazado
    const resBajarA1 = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${naruto1.id}/cantidad`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { cantidad: 1 }
    });
    expect(resBajarA1.statusCode).toBe(400);
    expect(JSON.parse(resBajarA1.payload).error).toContain('reserva(s) activa(s)');

    // Bajar a 2 copias: debe funcionar
    const resBajarA2 = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${naruto1.id}/cantidad`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { cantidad: 2 }
    });
    expect(resBajarA2.statusCode).toBe(200);
    const libroActualizado = JSON.parse(resBajarA2.payload);
    expect(libroActualizado.cantidad_total).toBe(2);
    expect(libroActualizado.cantidad_disponible).toBe(0); // 2 copias - 2 reservas = 0 disponibles
    expect(libroActualizado.agotado).toBe(true);
  });

  it('Ada sube Sailor Moon 1 de 5 a 8 copias: el catálogo muestra 8 (RN-13, HU-12)', async () => {
    const sailorMoon = db.prepare("SELECT * FROM libros WHERE titulo = 'Sailor Moon 1'").get() as any;
    expect(sailorMoon.cantidad_total).toBe(5);

    const res = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${sailorMoon.id}/cantidad`,
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: { cantidad: 8 }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).cantidad_total).toBe(8);

    const resCat = await inject(app, { method: 'GET', url: `/api/libros/${sailorMoon.id}` });
    expect(JSON.parse(resCat.payload).cantidad_total).toBe(8);
  });

  it('Emi suma 3 copias a Death Note 1 (ya existía): no aparece en novedades (RN-41, HU-12)', async () => {
    // Simulamos que el catálogo se cargó hace 5 días (fuera de los 2 días de novedades)
    relojFalso.avanzarDias(5);

    const deathNote = db.prepare("SELECT * FROM libros WHERE titulo = 'Death Note 1'").get() as any;
    expect(deathNote.cantidad_total).toBe(2);

    // Emi suma copias (de 2 a 5 copias)
    const resSuma = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${deathNote.id}/cantidad`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { cantidad: 5 }
    });
    expect(resSuma.statusCode).toBe(200);
    expect(JSON.parse(resSuma.payload).cantidad_total).toBe(5);

    // Verificamos que NO aparece en novedades (RN-41)
    const resNov = await inject(app, { method: 'GET', url: '/api/libros/novedades' });
    const novedades = JSON.parse(resNov.payload);
    const estaEnNovedades = novedades.some((l: any) => l.titulo === 'Death Note 1');
    expect(estaEnNovedades).toBe(false);
  });
});
