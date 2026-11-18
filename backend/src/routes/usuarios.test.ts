import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-05: Crear cuentas (RN-03, RN-04, RN-05, RN-06, RN-36, HU-08)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenEmpleado: string;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    // Creamos al empleado Emi para autenticar la creación de cuentas en el local (RN-03, RN-04)
    const hash = bcrypt.hashSync('empleado123', 10);
    const stmt = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('empleado', 'Emi', 'Local', '30000002', 'emi@comiqueria.com', '11000000', ?, '1995-01-01', 0)
    `);
    const info = stmt.run(hash);

    tokenEmpleado = 'token-empleado-test';
    db.prepare(`
      INSERT INTO sesiones (token, usuario_id, ultima_actividad)
      VALUES (?, ?, ?)
    `).run(tokenEmpleado, Number(info.lastInsertRowid), relojFalso.ahora().toISOString());
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('con el reloj en 2026-12-01, crear a Ana (doc 40111222, nacida 2000-05-10) funciona y la contraseña no se guarda en texto', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Ana',
        apellido: 'Pérez',
        documento: '40111222',
        correo: 'ana@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2000-05-10'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.nombre).toBe('Ana');
    expect(body.documento).toBe('40111222');
    expect(body.rol).toBe('cliente');
    expect(body.contrasena_hash).toBeUndefined();

    const { obtenerBaseDatos } = await import('../db/conexion');
    const usuarioDb = obtenerBaseDatos()
      .prepare('SELECT * FROM usuarios WHERE documento = ?')
      .get('40111222') as any;

    expect(usuarioDb).toBeDefined();
    expect(usuarioDb.contrasena_hash).not.toBe('secreta123');
    expect(bcrypt.compareSync('secreta123', usuarioDb.contrasena_hash)).toBe(true);
  });

  it('crear otra cuenta con el documento 40111222, o con el mismo correo, es rechazado (RN-05)', async () => {
    await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Ana',
        apellido: 'Pérez',
        documento: '40111222',
        correo: 'ana@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2000-05-10'
      }
    });

    const resMismoDoc = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Ana Clásica',
        apellido: 'Pérez',
        documento: '40111222',
        correo: 'otra_ana@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2000-05-10'
      }
    });
    expect(resMismoDoc.statusCode).toBe(400);
    expect(JSON.parse(resMismoDoc.payload).error).toContain('Ya existe una cuenta con ese documento');

    const resMismoCorreo = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Ana Otra',
        apellido: 'Pérez',
        documento: '40999888',
        correo: 'ana@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2000-05-10'
      }
    });
    expect(resMismoCorreo.statusCode).toBe(400);
    expect(JSON.parse(resMismoCorreo.payload).error).toContain('Ya existe una cuenta con ese correo');
  });

  it('fecha de nacimiento 2011-12-02 (14 años) es rechazada. Nacido 2010-06-01 (16 años) con adulto responsable se crea, y sin adulto es rechazado (RN-06)', async () => {
    const res14Anos = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Menor',
        apellido: 'Pérez',
        documento: '50111222',
        correo: 'menor@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2011-12-02'
      }
    });
    expect(res14Anos.statusCode).toBe(400);
    expect(JSON.parse(res14Anos.payload).error).toContain('La edad mínima para tener cuenta es 15 años');

    const res16SinAdulto = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Bruno',
        apellido: 'Gómez',
        documento: '41222333',
        correo: 'bruno@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2010-06-01',
        adulto_responsable: false
      }
    });
    expect(res16SinAdulto.statusCode).toBe(400);
    expect(JSON.parse(res16SinAdulto.payload).error).toContain('adulto responsable');

    const res16ConAdulto = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: {
        authorization: `Bearer ${tokenEmpleado}`
      },
      payload: {
        nombre: 'Bruno',
        apellido: 'Gómez',
        documento: '41222333',
        correo: 'bruno@mail.com',
        telefono: '11223344',
        contrasena: 'secreta123',
        fecha_nacimiento: '2010-06-01',
        adulto_responsable: true
      }
    });
    expect(res16ConAdulto.statusCode).toBe(201);
    expect(JSON.parse(res16ConAdulto.payload).documento).toBe('41222333');
  });

  it('no existe registro público: POST /api/registro responde 404 (RN-03)', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/registro',
      payload: {
        nombre: 'Público',
        correo: 'publico@mail.com'
      }
    });
    expect(res.statusCode).toBe(404);
  });
});
