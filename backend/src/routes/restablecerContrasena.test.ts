import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('T-07: Restablecer contraseña (RN-07, HU-07)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenEmi: string;
  let tokenAna: string;
  let idAna: number;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);

    // Emi (empleado)
    const hashEmi = bcrypt.hashSync('claveEmiOriginal', 10);
    const resEmi = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('empleado', 'Emi', 'Local', '30000002', 'emi@comiqueria.com', '11223355', ?, '1995-01-01', 0)
    `).run(hashEmi);
    const idEmi = Number(resEmi.lastInsertRowid);

    tokenEmi = 'token-emi-empleado';
    db.prepare(`
      INSERT INTO sesiones (token, usuario_id, ultima_actividad)
      VALUES (?, ?, ?)
    `).run(tokenEmi, idEmi, relojFalso.ahora().toISOString());

    // Ana (cliente)
    const hashAna = bcrypt.hashSync('claveViejaAna', 10);
    const resAna = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('cliente', 'Ana', 'Pérez', '40111222', 'ana@mail.com', '11223344', ?, '2000-05-10', 0)
    `).run(hashAna);
    idAna = Number(resAna.lastInsertRowid);

    tokenAna = 'token-ana-cliente';
    db.prepare(`
      INSERT INTO sesiones (token, usuario_id, ultima_actividad)
      VALUES (?, ?, ?)
    `).run(tokenAna, idAna, relojFalso.ahora().toISOString());
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  it('Emi restablece la contraseña de Ana: Ana entra con la nueva y la vieja ya no sirve (RN-07, HU-07)', async () => {
    // Emi restablece la contraseña de Ana en el local
    const resRestablecer = await inject(app, {
      method: 'POST',
      url: `/api/usuarios/${idAna}/contrasena`,
      headers: { authorization: `Bearer ${tokenEmi}` },
      payload: { nueva_contrasena: 'claveNuevaAna123' }
    });

    expect(resRestablecer.statusCode).toBe(200);
    expect(JSON.parse(resRestablecer.payload).ok).toBe(true);

    // Ana intenta loguearse con la vieja contraseña -> Falla 401
    const resLoginViejo = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'claveViejaAna'
      }
    });
    expect(resLoginViejo.statusCode).toBe(401);

    // Ana se loguea con la nueva contraseña -> Éxito 200
    const resLoginNuevo = await inject(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        documento: '40111222',
        contrasena: 'claveNuevaAna123'
      }
    });
    expect(resLoginNuevo.statusCode).toBe(200);
    const bodyLogin = JSON.parse(resLoginNuevo.payload);
    expect(bodyLogin.token).toBeDefined();
    expect(bodyLogin.usuario.documento).toBe('40111222');
  });

  it('Ana intenta restablecer su contraseña por su cuenta: 403 (RN-07)', async () => {
    // Ana intenta llamar al endpoint por su cuenta sin ser empleado ni admin
    const res = await inject(app, {
      method: 'POST',
      url: `/api/usuarios/${idAna}/contrasena`,
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { nueva_contrasena: 'autoRestablecida' }
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('Acceso denegado');
  });
});
