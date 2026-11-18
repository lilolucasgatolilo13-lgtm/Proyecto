import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-11: Administrar libros (RN-08, RN-12, RN-41, HU-14)', () => {
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

    // Obtenemos a Ada (administrador) y Emi (empleado)
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

  it('Ada oculta Dragon Ball 1: ya no aparece en el catálogo y sigue en la base (RN-12, HU-14)', async () => {
    const dragonBall1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Dragon Ball 1'").get() as any;
    expect(dragonBall1.oculto).toBe(0);

    // Ada oculta el libro
    const resOcultar = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${dragonBall1.id}/ocultar`,
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: { ocultar: true }
    });
    expect(resOcultar.statusCode).toBe(200);

    // Ya no aparece en el catálogo público
    const resCatalogo = await inject(app, {
      method: 'GET',
      url: '/api/libros'
    });
    const libros = JSON.parse(resCatalogo.payload);
    expect(libros.some((l: any) => l.titulo === 'Dragon Ball 1')).toBe(false);

    // Pero sigue existiendo en la base de datos
    const dbLibro = db.prepare("SELECT * FROM libros WHERE titulo = 'Dragon Ball 1'").get() as any;
    expect(dbLibro).toBeDefined();
    expect(dbLibro.oculto).toBe(1);
  });

  it('Ada intenta borrar Naruto 1 con 1 reserva: rechazado, solo puede ocultarlo (RN-12, HU-14)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const ana = db.prepare("SELECT * FROM usuarios WHERE documento = '40111222'").get() as any;

    // Insertamos 1 reserva (activa o histórica)
    db.prepare(`
      INSERT INTO reservas (codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
      VALUES ('RES-N1', ?, ?, 10000, ?, ?, 'activa')
    `).run(ana.id, naruto1.id, relojFalso.ahora().toISOString(), relojFalso.ahora().toISOString());

    // Ada intenta eliminarlo
    const resEliminar = await inject(app, {
      method: 'DELETE',
      url: `/api/libros/${naruto1.id}`,
      headers: { authorization: `Bearer ${tokenAda}` }
    });

    expect(resEliminar.statusCode).toBe(400);
    expect(JSON.parse(resEliminar.payload).error).toContain('No se puede borrar un libro que tenga reservas o historial');

    // El libro sigue intacto en la base
    const dbLibro = db.prepare("SELECT * FROM libros WHERE id = ?").get(naruto1.id);
    expect(dbLibro).toBeDefined();
  });

  it('Emi intenta ocultar un libro: 403 (RN-12)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    const res = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${naruto1.id}/ocultar`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { ocultar: true }
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('Acceso denegado');
  });

  it('Ada carga "Dragon Ball 2" ($8.500, 4 copias, serie Dragon Ball ya existente, portada con un enlace): aparece en el catálogo y en novedades (RN-08, RN-41, HU-14)', async () => {
    const serieDragonBall = db.prepare("SELECT * FROM series WHERE nombre = 'Dragon Ball'").get() as any;

    const resCrear = await inject(app, {
      method: 'POST',
      url: '/api/libros',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        titulo: 'Dragon Ball 2',
        serie_id: serieDragonBall.id,
        numero_tomo: 2,
        autor: 'Akira Toriyama',
        editorial: 'Ivrea',
        idioma: 'Español',
        genero: 'Shonen',
        clasificacion_edad: 'ATP',
        portada_url: 'https://imagenes.com/db2.jpg',
        sinopsis: 'Segunda entrega de Dragon Ball',
        precio: 8500,
        cantidad_total: 4
      }
    });

    expect(resCrear.statusCode).toBe(201);
    const libroCreado = JSON.parse(resCrear.payload);
    expect(libroCreado.titulo).toBe('Dragon Ball 2');
    expect(libroCreado.precio).toBe(8500);
    expect(libroCreado.cantidad_total).toBe(4);

    // Aparece en el catálogo
    const resCatalogo = await inject(app, { method: 'GET', url: '/api/libros' });
    const enCatalogo = JSON.parse(resCatalogo.payload).some((l: any) => l.titulo === 'Dragon Ball 2');
    expect(enCatalogo).toBe(true);

    // Aparece en novedades
    const resNovedades = await inject(app, { method: 'GET', url: '/api/libros/novedades' });
    const enNovedades = JSON.parse(resNovedades.payload).some((l: any) => l.titulo === 'Dragon Ball 2');
    expect(enNovedades).toBe(true);
  });

  it('Ada carga un libro con la serie nueva "Bleach": se crea la serie y el libro queda dentro (RN-08, HU-14)', async () => {
    const resCrear = await inject(app, {
      method: 'POST',
      url: '/api/libros',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        titulo: 'Bleach 1',
        serie_nueva: 'Bleach',
        numero_tomo: 1,
        autor: 'Tite Kubo',
        editorial: 'Ivrea',
        precio: 9500,
        cantidad_total: 3
      }
    });

    expect(resCrear.statusCode).toBe(201);
    const libro = JSON.parse(resCrear.payload);
    expect(libro.titulo).toBe('Bleach 1');
    expect(libro.serie).toBe('Bleach');

    // La serie Bleach ahora existe en la tabla series
    const serieDb = db.prepare("SELECT * FROM series WHERE nombre = 'Bleach'").get() as any;
    expect(serieDb).toBeDefined();
    expect(serieDb.nombre).toBe('Bleach');
  });

  it('cargar un libro sin título o sin precio: rechazado (RN-08, HU-14)', async () => {
    // Sin título
    const resSinTitulo = await inject(app, {
      method: 'POST',
      url: '/api/libros',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        serie_nueva: 'Nueva',
        precio: 10000
      }
    });
    expect(resSinTitulo.statusCode).toBe(400);
    expect(JSON.parse(resSinTitulo.payload).error).toContain('título');

    // Sin precio
    const resSinPrecio = await inject(app, {
      method: 'POST',
      url: '/api/libros',
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: {
        titulo: 'Libro Sin Precio',
        serie_nueva: 'Nueva'
      }
    });
    expect(resSinPrecio.statusCode).toBe(400);
    expect(JSON.parse(resSinPrecio.payload).error).toContain('precio');
  });

  it('Ada cambia el precio de Naruto 1 a $11.000: el catálogo muestra el nuevo (HU-14)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    const resPatch = await inject(app, {
      method: 'PATCH',
      url: `/api/libros/${naruto1.id}`,
      headers: { authorization: `Bearer ${tokenAda}` },
      payload: { precio: 11000 }
    });

    expect(resPatch.statusCode).toBe(200);
    expect(JSON.parse(resPatch.payload).precio).toBe(11000);

    const resCatalogo = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
    expect(JSON.parse(resCatalogo.payload).precio).toBe(11000);
  });
});
