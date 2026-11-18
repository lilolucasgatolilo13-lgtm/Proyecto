import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-14: Descuentos y aumentos (RN-32, RN-43, RN-09, HU-15)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenAda: string;
  let tokenEmi: string;

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

  it('descuento del 20% vigente sobre Naruto 1 ($10.000): precio vigente $8.000, y aparece en ofertas (RN-32, RN-09, HU-15)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    expect(naruto1.precio).toBe(10000);

    // Ada crea descuento del 20% para Naruto 1 desde hoy hasta fin de mes
    const resCrear = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        alcance: 'libro',
        referencia_id: naruto1.id,
        tipo: 'descuento',
        porcentaje: 20,
        fecha_inicio: '2026-12-01T00:00:00-03:00',
        fecha_fin: '2026-12-31T23:59:59-03:00'
      }
    });

    expect(resCrear.statusCode).toBe(201);

    // Consulta del libro: precio original 10000, precio vigente 8000
    const resLibro = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
    expect(resLibro.statusCode).toBe(200);
    const libro = JSON.parse(resLibro.payload);
    expect(libro.precio).toBe(10000);
    expect(libro.precio_vigente).toBe(8000);

    // Consulta de sección de ofertas: Naruto 1 debe aparecer
    const resOfertas = await inject(app, { method: 'GET', url: '/api/libros/ofertas' });
    expect(resOfertas.statusCode).toBe(200);
    const ofertas = JSON.parse(resOfertas.payload);
    const ofertaNaruto = ofertas.find((o: any) => o.titulo === 'Naruto 1');
    expect(ofertaNaruto).toBeDefined();
    expect(ofertaNaruto.precio_vigente).toBe(8000);
    expect(ofertaNaruto.porcentaje_descuento).toBe(20);
  });

  it('aumento del 10% sobre Naruto 1: precio vigente $11.000 (RN-32, HU-15)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    // Ada crea aumento del 10%
    const resCrear = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        alcance: 'libro',
        referencia_id: naruto1.id,
        tipo: 'aumento',
        porcentaje: 10,
        fecha_inicio: '2026-12-01T00:00:00-03:00',
        fecha_fin: '2026-12-31T23:59:59-03:00'
      }
    });
    expect(resCrear.statusCode).toBe(201);

    const resLibro = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
    const libro = JSON.parse(resLibro.payload);
    expect(libro.precio).toBe(10000);
    expect(libro.precio_vigente).toBe(11000);
  });

  it('descuento del 5% o del 60%: rechazado. Fuera de sus fechas: no tiene efecto (RN-43, HU-15)', async () => {
    // Intento con 5% (mínimo permitido es 10%) -> Rechazado
    const res5 = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        alcance: 'catalogo',
        tipo: 'descuento',
        porcentaje: 5,
        fecha_inicio: '2026-12-01T00:00:00-03:00',
        fecha_fin: '2026-12-31T23:59:59-03:00'
      }
    });
    expect(res5.statusCode).toBe(400);
    expect(JSON.parse(res5.payload).error).toContain('10% y el 50%');

    // Intento con 60% (máximo permitido es 50%) -> Rechazado
    const res60 = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        alcance: 'catalogo',
        tipo: 'descuento',
        porcentaje: 60,
        fecha_inicio: '2026-12-01T00:00:00-03:00',
        fecha_fin: '2026-12-31T23:59:59-03:00'
      }
    });
    expect(res60.statusCode).toBe(400);
    expect(JSON.parse(res60.payload).error).toContain('10% y el 50%');

    // Descuento válido del 20% pero para el año 2027 (fuera de fecha ahora en 2026)
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        alcance: 'libro',
        referencia_id: naruto1.id,
        tipo: 'descuento',
        porcentaje: 20,
        fecha_inicio: '2027-01-01T00:00:00-03:00',
        fecha_fin: '2027-01-31T23:59:59-03:00'
      }
    });

    // En 2026-12-01 no debe tener efecto
    const resFueraDeFecha = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
    const libroFuera = JSON.parse(resFueraDeFecha.payload);
    expect(libroFuera.precio_vigente).toBe(10000); // Mantiene precio base
  });

  it('Emi intenta crear un descuento: 403 (RN-32, HU-15)', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: {
        alcance: 'catalogo',
        tipo: 'descuento',
        porcentaje: 20,
        fecha_inicio: '2026-12-01T00:00:00-03:00',
        fecha_fin: '2026-12-31T23:59:59-03:00'
      }
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('Acceso denegado');
  });
});
