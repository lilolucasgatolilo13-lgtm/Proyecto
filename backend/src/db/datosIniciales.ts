import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { obtenerBaseDatos } from './conexion';
import { ahora } from '../config/reloj';

export function cargarDatosIniciales(db?: Database.Database): void {
  const base = db || obtenerBaseDatos();

  // 1. Usuarios comunes de prueba (1 administrador, 1 empleado, 3 clientes)
  const usuarios = [
    {
      rol: 'administrador',
      nombre: 'Ada',
      apellido: 'Admin',
      documento: '30000001',
      correo: 'ada@comiqueria.com',
      telefono: '11000001',
      contrasena: 'admin123',
      fecha_nacimiento: '1990-01-01'
    },
    {
      rol: 'empleado',
      nombre: 'Emi',
      apellido: 'Local',
      documento: '30000002',
      correo: 'emi@comiqueria.com',
      telefono: '11000002',
      contrasena: 'empleado123',
      fecha_nacimiento: '1995-01-01'
    },
    {
      rol: 'cliente',
      nombre: 'Ana',
      apellido: 'Pérez',
      documento: '40111222',
      correo: 'ana@mail.com',
      telefono: '11223344',
      contrasena: 'ana123',
      fecha_nacimiento: '2000-05-10'
    },
    {
      rol: 'cliente',
      nombre: 'Bruno',
      apellido: 'Gómez',
      documento: '41222333',
      correo: 'bruno@mail.com',
      telefono: '11223355',
      contrasena: 'bruno123',
      fecha_nacimiento: '2010-06-01'
    },
    {
      rol: 'cliente',
      nombre: 'Carla',
      apellido: 'Díaz',
      documento: '40333444',
      correo: 'carla@mail.com',
      telefono: '11223366',
      contrasena: 'carla123',
      fecha_nacimiento: '2001-03-15'
    }
  ];

  const stmtUsuario = base.prepare(`
    INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const u of usuarios) {
    const existe = base.prepare('SELECT id FROM usuarios WHERE documento = ?').get(u.documento);
    if (!existe) {
      const hash = bcrypt.hashSync(u.contrasena, 10);
      stmtUsuario.run(u.rol, u.nombre, u.apellido, u.documento, u.correo, u.telefono, hash, u.fecha_nacimiento);
    }
  }

  // 2. Series
  const seriesNombres = ['Naruto', 'Berserk', 'One Piece', 'Sailor Moon', 'Death Note', 'Dragon Ball'];
  const stmtSerie = base.prepare('INSERT OR IGNORE INTO series (nombre) VALUES (?)');
  for (const nombre of seriesNombres) {
    stmtSerie.run(nombre);
  }

  const obtenerSerieId = (nombre: string): number => {
    const row = base.prepare('SELECT id FROM series WHERE nombre = ?').get(nombre) as { id: number };
    return row.id;
  };

  // 3. Libros (8 libros de prueba comunes)
  const fechaIngreso = ahora().toISOString();

  const libros = [
    {
      titulo: 'Naruto 1',
      serie: 'Naruto',
      tomo: 1,
      autor: 'Masashi Kishimoto',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 10000,
      copias: 3
    },
    {
      titulo: 'Naruto 2',
      serie: 'Naruto',
      tomo: 2,
      autor: 'Masashi Kishimoto',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 10000,
      copias: 1
    },
    {
      titulo: 'Naruto 3',
      serie: 'Naruto',
      tomo: 3,
      autor: 'Masashi Kishimoto',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 10000,
      copias: 0
    },
    {
      titulo: 'Berserk 1',
      serie: 'Berserk',
      tomo: 1,
      autor: 'Kentaro Miura',
      editorial: 'Panini',
      idioma: 'Español',
      genero: 'Seinen',
      edad: '+18',
      precio: 12000,
      copias: 2
    },
    {
      titulo: 'One Piece 1',
      serie: 'One Piece',
      tomo: 1,
      autor: 'Eiichiro Oda',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 9000,
      copias: 5
    },
    {
      titulo: 'Sailor Moon 1',
      serie: 'Sailor Moon',
      tomo: 1,
      autor: 'Naoko Takeuchi',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shojo',
      edad: 'ATP',
      precio: 8000,
      copias: 5
    },
    {
      titulo: 'Death Note 1',
      serie: 'Death Note',
      tomo: 1,
      autor: 'Tsugumi Ohba',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 9000,
      copias: 2
    },
    {
      titulo: 'Dragon Ball 1',
      serie: 'Dragon Ball',
      tomo: 1,
      autor: 'Akira Toriyama',
      editorial: 'Ivrea',
      idioma: 'Español',
      genero: 'Shonen',
      edad: 'ATP',
      precio: 8500,
      copias: 4
    }
  ];

  const stmtLibro = base.prepare(`
    INSERT INTO libros (titulo, serie_id, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, portada_url, sinopsis, precio, cantidad_total, oculto, fecha_ingreso)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  for (const l of libros) {
    const serieId = obtenerSerieId(l.serie);
    const existe = base.prepare('SELECT id FROM libros WHERE titulo = ? AND serie_id = ?').get(l.titulo, serieId);
    if (!existe) {
      stmtLibro.run(
        l.titulo,
        serieId,
        l.tomo,
        l.autor,
        l.editorial,
        l.idioma,
        l.genero,
        l.edad,
        `https://imagenes.ejemplo.com/${l.titulo.toLowerCase().replace(/\s+/g, '-')}.jpg`,
        `Sinopsis oficial de ${l.titulo}`,
        l.precio,
        l.copias,
        fechaIngreso
      );
    }
  }
}
