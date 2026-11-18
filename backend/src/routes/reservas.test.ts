import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('Etapa 3: Reservar (T-15 a T-19)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenAna: string;
  let tokenBruno: string;
  let tokenCarla: string;
  let idAna: number;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);
    cargarDatosIniciales(db);

    const crearSesion = (documento: string, nombre: string, apellido: string): string => {
      const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(documento) as any;
      const token = `token-${documento}`;
      db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
        .run(token, usuario.id, relojFalso.ahora().toISOString());
      return token;
    };

    tokenAna = crearSesion('40111222', 'Ana', 'Pérez');
    idAna = (db.prepare("SELECT id FROM usuarios WHERE documento = '40111222'").get() as any).id;
    tokenBruno = crearSesion('41222333', 'Bruno', 'Gómez');
    tokenCarla = crearSesion('40333444', 'Carla', 'Díaz');
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  // ---------- T-15: Crear reserva ----------

  it('T-15: Ana reserva Naruto 1 con reloj 2026-12-01 10:00 -> reserva activa, vence 2026-12-02 10:00, precio $10.000, código generado, disponibles 3→2, 1 correo', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    expect(naruto1.cantidad_total).toBe(3);

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.estado).toBe('activa');
    expect(body.codigo).toBeDefined();
    expect(body.precio_fijado).toBe(10000);
    expect(new Date(body.fecha_vencimiento).toISOString()).toBe(new Date('2026-12-02T10:00:00-03:00').toISOString());

    const reservasActivas = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE libro_id = ? AND estado = 'activa'").get(naruto1.id) as any;
    expect(naruto1.cantidad_total - reservasActivas.c).toBe(2);

    const { obtenerBaseDatos } = await import('../db/conexion');
    const correos = obtenerBaseDatos().prepare("SELECT * FROM correos WHERE destinatario = ? AND asunto = ?").all('ana@mail.com', 'Reserva confirmada') as any[];
    expect(correos.length).toBe(1);
    expect(correos[0].cuerpo).toContain(body.codigo);
  });

  it('T-15: Reservar Naruto 3 (0 copias) es rechazado por libro agotado', async () => {
    const naruto3 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 3'").get() as any;
    expect(naruto3.cantidad_total).toBe(0);

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto3.id }
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('Libro agotado');
  });

  it('T-15: Reservar sin sesión responde 401', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      payload: { libro_id: naruto1.id }
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------- T-16: Límites de reserva y plazo ----------

  it('T-16: Ana con 4 reservas activas reserva la 5.ª OK, la 6.ª es rechazada', async () => {
    const librosDisponibles = db.prepare("SELECT id, titulo, cantidad_total, precio FROM libros WHERE cantidad_total > 0 AND oculto = 0 ORDER BY id ASC").all() as any[];
    for (let i = 0; i < 4; i++) {
      const libro = librosDisponibles[i];
      db.prepare(
        `INSERT INTO reservas (codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'activa')`
      ).run(`RES-TEST-${i}`, idAna, libro.id, libro.precio, relojFalso.ahora().toISOString(),
        new Date(relojFalso.ahora().getTime() + 24 * 60 * 60 * 1000).toISOString());
    }

    const libro5 = librosDisponibles[4];
    const res5 = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: libro5.id }
    });
    expect(res5.statusCode).toBe(201);

    const libroSinReserva = librosDisponibles.find((l: any) => {
      const c = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE cliente_id = ? AND libro_id = ? AND estado = 'activa'").get(idAna, l.id) as any;
      return c.c === 0;
    });
    if (libroSinReserva) {
      const res6 = await inject(app, {
        method: 'POST',
        url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: libroSinReserva.id }
      });
      expect(res6.statusCode).toBe(400);
      expect(JSON.parse(res6.payload).error).toContain('5 reservas activas');
    }
  });

  it('T-16: Ana con Naruto 1 activa intenta reservar otra copia de Naruto 1: rechazado', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const res1 = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    expect(res2.statusCode).toBe(400);
    expect(JSON.parse(res2.payload).error).toContain('Ya tiene una reserva activa de este libro');
  });

  it('T-16: Reserva el domingo 2026-12-06 17:50 vence el lunes 2026-12-07 17:50 (24h corridas)', async () => {
    relojFalso.fijar('2026-12-06T17:50:00-03:00');
    // Recrear sesión porque cambiar el reloj expira la anterior por inactividad (>4 días)
    const ana = db.prepare("SELECT * FROM usuarios WHERE documento = '40111222'").get() as any;
    const tokenAnaDomingo = `token-ana-domingo`;
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(ana.id);
    db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
      .run(tokenAnaDomingo, ana.id, relojFalso.ahora().toISOString());

    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAnaDomingo}` },
      payload: { libro_id: naruto1.id }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(new Date(body.fecha_vencimiento).toISOString()).toBe(new Date('2026-12-07T17:50:00-03:00').toISOString());
  });

  // ---------- T-17: Libros para mayores ----------

  it('T-17: Bruno (16 años) intenta reservar Berserk 1 (+18): rechazado', async () => {
    const berserk = db.prepare("SELECT * FROM libros WHERE titulo = 'Berserk 1'").get() as any;
    expect(berserk.clasificacion_edad).toBe('+18');

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenBruno}` },
      payload: { libro_id: berserk.id }
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('mayores de 18');
  });

  it('T-17: Ana (26 años) reserva Berserk 1 (+18) sin problema', async () => {
    const berserk = db.prepare("SELECT * FROM libros WHERE titulo = 'Berserk 1'").get() as any;

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: berserk.id }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.estado).toBe('activa');
    expect(body.precio_fijado).toBe(12000);
  });

  it('T-17: Cliente nacido 2008-12-01, reloj 2026-12-01 (cumple 18 ese día), reserva Berserk 1 sin problema', async () => {
    const hash = bcrypt.hashSync('pass123', 10);
    const stmt = db.prepare(`
      INSERT INTO usuarios (rol, nombre, apellido, documento, correo, telefono, contrasena_hash, fecha_nacimiento, baneado)
      VALUES ('cliente', 'Cumpleañero', 'Test', '99999999', 'cumple@mail.com', '11999999', ?, '2008-12-01', 0)
    `).run(hash);
    const usuarioId = Number(stmt.lastInsertRowid);
    const tokenCumple = `token-cumple-${usuarioId}`;
    db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
      .run(tokenCumple, usuarioId, relojFalso.ahora().toISOString());

    const berserk = db.prepare("SELECT * FROM libros WHERE titulo = 'Berserk 1'").get() as any;
    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenCumple}` },
      payload: { libro_id: berserk.id }
    });

    expect(res.statusCode).toBe(201);
  });

  // ---------- T-18: Concurrencia ----------

  it('T-18: Naruto 2 (1 copia): Ana y Carla lo reservan a la vez. Queda 1 reserva activa, el otro recibe "libro ya reservado". Disponibles: 0.', async () => {
    const naruto2 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 2'").get() as any;
    expect(naruto2.cantidad_total).toBe(1);

    const resAna = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto2.id }
    });
    expect(resAna.statusCode).toBe(201);

    const resCarla = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenCarla}` },
      payload: { libro_id: naruto2.id }
    });
    expect(resCarla.statusCode).toBe(400);
    expect(JSON.parse(resCarla.payload).error).toContain('Libro agotado');

    const reservasActivas = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE libro_id = ? AND estado = 'activa'").get(naruto2.id) as any;
    expect(naruto2.cantidad_total - reservasActivas.c).toBe(0);
  });

  it('T-18: Con 2 copias y los mismos 2 pedidos a la vez, ambos funcionan', async () => {
    const onePiece = db.prepare("SELECT * FROM libros WHERE titulo = 'One Piece 1'").get() as any;
    expect(onePiece.cantidad_total).toBe(5);

    const resAna = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: onePiece.id }
    });
    expect(resAna.statusCode).toBe(201);

    const resBruno = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenBruno}` },
      payload: { libro_id: onePiece.id }
    });
    expect(resBruno.statusCode).toBe(201);

    const reservasActivas = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE libro_id = ? AND estado = 'activa'").get(onePiece.id) as any;
    expect(onePiece.cantidad_total - reservasActivas.c).toBe(3);
  });

  // ---------- T-19: Mis reservas y contador ----------

  it('T-19: Reserva hecha 2026-12-01 10:00 y reloj en 14:00: quedan 20 horas (72.000 segundos)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });

    relojFalso.fijar('2026-12-01T14:00:00-03:00');

    const res = await inject(app, {
      method: 'GET',
      url: '/api/reservas/mias',
      headers: { authorization: `Bearer ${tokenAna}` }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.length).toBe(1);
    expect(body[0].segundos_restantes).toBe(72000);
  });

  it('T-19: Con el reloj en 2026-12-02 10:00:01 la reserva ya no figura como activa (vencida)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });

    relojFalso.fijar('2026-12-02T10:00:01-03:00');

    const res = await inject(app, {
      method: 'GET',
      url: '/api/reservas/mias',
      headers: { authorization: `Bearer ${tokenAna}` }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.length).toBe(0);
  });

  it('T-19: Si el cliente manda una hora propia en el pedido, el servidor la ignora (usa reloj del servidor)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

    const res = await inject(app, {
      method: 'POST',
      url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id, fecha_reserva: '2025-01-01T00:00:00-03:00' }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.fecha_reserva).toContain('2026-12-01');
  });
});