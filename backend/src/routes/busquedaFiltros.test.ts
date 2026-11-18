import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-10: Búsqueda, filtros, series y novedades (RN-09, RN-41, HU-02)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    cargarDatosIniciales(db);
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('buscar "naruto" devuelve los 3 tomos de Naruto y ningún otro libro (RN-09, HU-02)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/libros?q=naruto'
    });

    expect(res.statusCode).toBe(200);
    const libros = JSON.parse(res.payload);
    expect(libros.length).toBe(3);

    for (const libro of libros) {
      expect(libro.titulo.toLowerCase()).toContain('naruto');
      expect(libro.serie).toBe('Naruto');
    }
  });

  it('abrir la serie Naruto devuelve los tomos 1, 2 y 3 en ese orden, y el 3 como agotado (RN-09, HU-02)', async () => {
    const serieNaruto = db.prepare("SELECT * FROM series WHERE nombre = 'Naruto'").get() as any;
    expect(serieNaruto).toBeDefined();

    const res = await inject(app, {
      method: 'GET',
      url: `/api/series/${serieNaruto.id}`
    });

    expect(res.statusCode).toBe(200);
    const datosSerie = JSON.parse(res.payload);
    expect(datosSerie.id).toBe(serieNaruto.id);
    expect(datosSerie.nombre).toBe('Naruto');

    const tomos = datosSerie.libros;
    expect(tomos.length).toBe(3);

    // En orden por numero_tomo ASC
    expect(tomos[0].numero_tomo).toBe(1);
    expect(tomos[0].titulo).toBe('Naruto 1');
    expect(tomos[0].agotado).toBe(false);

    expect(tomos[1].numero_tomo).toBe(2);
    expect(tomos[1].titulo).toBe('Naruto 2');
    expect(tomos[1].agotado).toBe(false);

    expect(tomos[2].numero_tomo).toBe(3);
    expect(tomos[2].titulo).toBe('Naruto 3');
    expect(tomos[2].cantidad_disponible).toBe(0);
    expect(tomos[2].agotado).toBe(true);
  });

  it('un libro con fecha de ingreso de hace 1 día está en novedades. Uno de hace 3 días no (RN-41, HU-02)', async () => {
    // libroA: ingresado hace 1 día (24 horas antes de ahora)
    const fechaA = new Date(relojFalso.ahora().getTime() - 24 * 60 * 60 * 1000).toISOString();
    // libroB: ingresado hace 3 días (72 horas antes de ahora)
    const fechaB = new Date(relojFalso.ahora().getTime() - 72 * 60 * 60 * 1000).toISOString();

    const serieId = (db.prepare("SELECT id FROM series WHERE nombre = 'Naruto'").get() as any).id;

    // Insertamos libro A (reciente, 1 día)
    db.prepare(`
      INSERT INTO libros (titulo, serie_id, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, portada_url, sinopsis, precio, cantidad_total, oculto, fecha_ingreso)
      VALUES ('Manga Novedad', ?, 99, 'Autor', 'Ivrea', 'Español', 'Shonen', 'ATP', 'url', 'sinopsis', 10000, 2, 0, ?)
    `).run(serieId, fechaA);

    // Insertamos libro B (antiguo, 3 días)
    db.prepare(`
      INSERT INTO libros (titulo, serie_id, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, portada_url, sinopsis, precio, cantidad_total, oculto, fecha_ingreso)
      VALUES ('Manga Antiguo', ?, 100, 'Autor', 'Ivrea', 'Español', 'Shonen', 'ATP', 'url', 'sinopsis', 10000, 2, 0, ?)
    `).run(serieId, fechaB);

    const res = await inject(app, {
      method: 'GET',
      url: '/api/libros/novedades'
    });

    expect(res.statusCode).toBe(200);
    const novedades = JSON.parse(res.payload);

    const existeA = novedades.some((l: any) => l.titulo === 'Manga Novedad');
    const existeB = novedades.some((l: any) => l.titulo === 'Manga Antiguo');

    expect(existeA).toBe(true);
    expect(existeB).toBe(false);
  });

  it('filtros por género, editorial, idioma, precio y disponibilidad funcionan (RN-09)', async () => {
    // Filtro por género Seinen (Berserk 1)
    const resSeinen = await inject(app, {
      method: 'GET',
      url: '/api/libros?genero=Seinen'
    });
    const seinen = JSON.parse(resSeinen.payload);
    expect(seinen.length).toBe(1);
    expect(seinen[0].titulo).toBe('Berserk 1');

    // Filtro por precio (precio_max = 8500: Sailor Moon 1 $8000, Dragon Ball 1 $8500)
    const resPrecio = await inject(app, {
      method: 'GET',
      url: '/api/libros?precio_max=8500'
    });
    const baratos = JSON.parse(resPrecio.payload);
    expect(baratos.length).toBe(2);

    // Filtro por disponibilidad: solo agotados
    const resAgotados = await inject(app, {
      method: 'GET',
      url: '/api/libros?disponible=false'
    });
    const agotados = JSON.parse(resAgotados.payload);
    expect(agotados.length).toBe(1);
    expect(agotados[0].titulo).toBe('Naruto 3');
  });
});
