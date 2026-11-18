import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-06: Sesión y roles (RN-46, RN-36, RN-03)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    // Creamos los usuarios de prueba:
    // Ana (cliente)
    const hashAna = bcrypt.hashSync('contrasenaAna123', 10);
    db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('cliente', 'Ana', 'Pérez', '40111222', 'ana@mail.com', '11223344', ?, '2000-05-10', 0)
    `).run(hashAna);

    // Emi (empleado)
    const hashEmi = bcrypt.hashSync('contrasenaEmi123', 10);
    db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('empleado', 'Emi', 'Local', '30000002', 'emi@comiqueria.com', '11223355', ?, '1995-01-01', 0)
    `).run(hashEmi);

    // Ada (administrador)
    const hashAda = bcrypt.hashSync('contrasenaAda123', 10);
    db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('administrador', 'Ada', 'Admin', '30000001', 'ada@comiqueria.com', '11223366', ?, '1990-01-01', 0)
    `).run(hashAda);
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('login de Ana con contraseña correcta devuelve un token. Con contraseña incorrecta responde 401', async () => {
    // Intento con contraseña correcta
    const resCorrecto = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'contrasenaAna123'
      }
    });

    expect(resCorrecto.statusCode).toBe(200);
    const bodyCorrecto = JSON.parse(resCorrecto.payload);
    expect(bodyCorrecto.token).toBeDefined();
    expect(bodyCorrecto.usuario.documento).toBe('40111222');
    expect(bodyCorrecto.usuario.rol).toBe('cliente');

    // Intento con contraseña incorrecta
    const resIncorrecto = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'claveInvalida'
      }
    });

    expect(resIncorrecto.statusCode).toBe(401);
    expect(JSON.parse(resIncorrecto.payload).error).toContain('Credenciales inválidas');
  });

  it('cliente sin uso 3 días: la sesión sigue válida. Sin uso 4 días y 1 minuto: vencida (RN-46)', async () => {
    // Login inicial de Ana
    const resLogin = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'contrasenaAna123'
      }
    });
    const token = JSON.parse(resLogin.payload).token;

    // Avanzamos 3 días (72 horas)
    relojFalso.avanzarDias(3);

    // Debe seguir válida: hacemos logout o llamada de prueba
    const res3Dias = await inject(app, {
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res3Dias.statusCode).toBe(200);

    // Generamos nuevo login para probar el vencimiento exacto a 4 días y 1 minuto
    const resLogin2 = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'contrasenaAna123'
      }
    });
    const token2 = JSON.parse(resLogin2.payload).token;

    // Avanzamos 4 días y 1 minuto
    relojFalso.avanzarDias(4);
    relojFalso.avanzarMinutos(1);

    const resVencido = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${token2}` }
    });
    // Debe responder 401 por sesión vencida
    expect(resVencido.statusCode).toBe(401);
    expect(JSON.parse(resVencido.payload).error).toContain('inactividad');
  });

  it('empleado sin uso 6 días: válida. Sin uso 7 días y 1 minuto: vencida (RN-46)', async () => {
    // Login de Emi empleado
    const resLogin = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '30000002',
        contrasena: 'contrasenaEmi123'
      }
    });
    const token = JSON.parse(resLogin.payload).token;

    // Avanzamos 6 días
    relojFalso.avanzarDias(6);

    // Sigue válida (comprobamos que no da 401 por vencimiento)
    const res6Dias = await inject(app, {
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res6Dias.statusCode).toBe(200);

    // Nuevo login para probar límite de 7 días y 1 minuto
    const resLogin2 = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '30000002',
        contrasena: 'contrasenaEmi123'
      }
    });
    const token2 = JSON.parse(resLogin2.payload).token;

    // Avanzamos 7 días y 1 minuto
    relojFalso.avanzarDias(7);
    relojFalso.avanzarMinutos(1);

    const resVencido = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${token2}` }
    });
    expect(resVencido.statusCode).toBe(401);
    expect(JSON.parse(resVencido.payload).error).toContain('inactividad');
  });

  it('un cliente que llama a un endpoint de empleado recibe 403', async () => {
    // Login de Ana (cliente)
    const resLogin = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'contrasenaAna123'
      }
    });
    const token = JSON.parse(resLogin.payload).token;

    // Intenta llamar a POST /api/usuarios (endpoint reservado a empleados / admin)
    const res = await inject(app, {
      method: 'POST',
      url: '/api/usuarios',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Otro',
        apellido: 'Cliente',
        documento: '55667788',
        correo: 'otro@mail.com',
        telefono: '11001100',
        contrasena: '123456',
        fecha_nacimiento: '2000-01-01'
      }
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('Acceso denegado');
  });

  it('un empleado que llama a un endpoint de administrador (por ejemplo, POST /api/descuentos) recibe 403', async () => {
    // Login de Emi (empleado)
    const resLogin = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '30000002',
        contrasena: 'contrasenaEmi123'
      }
    });
    const token = JSON.parse(resLogin.payload).token;

    // Intenta llamar a POST /api/descuentos (exclusivo para administrador)
    const res = await inject(app, {
      method: 'POST',
      url: '/api/descuentos',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        alcance: 'catalogo',
        tipo: 'descuento',
        porcentaje: 20
      }
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('Acceso denegado');
  });
});
