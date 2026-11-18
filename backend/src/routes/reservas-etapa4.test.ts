import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';

describe('Etapa 4: Retiro y cancelar (T-20 a T-23)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenAna: string;
  let tokenEmi: string;
  let idAna: number;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);
    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);
    cargarDatosIniciales(db);

    const crearSesion = (documento: string): string => {
      const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(documento) as any;
      const token = `token-${documento}`;
      db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
        .run(token, usuario.id, relojFalso.ahora().toISOString());
      return token;
    };

    const rowAna = db.prepare("SELECT id FROM usuarios WHERE documento = '40111222'").get() as { id: number };
    idAna = rowAna.id;
    tokenAna = crearSesion('40111222');
    tokenEmi = crearSesion('30000002');
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  // ---------- T-20: Buscar y retirar una reserva ----------

  it('T-20: Buscar reserva por código devuelve cliente, libro y estado', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = db.prepare("SELECT * FROM reservas WHERE cliente_id = ? AND estado = 'activa'").get(idAna) as any;
    const res = await inject(app, {
      method: 'GET', url: `/api/reservas/buscar?codigo=${reserva.codigo}`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.titulo).toBe('Naruto 1');
    expect(body.documento).toBe('40111222');
    expect(body.nombre).toBe('Ana');
    expect(body.estado).toBe('activa');
  });

  it('T-20: Retirar reserva activa de $10.000 -> total $10.500', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    expect(resCrear.statusCode).toBe(201);
    const reserva = JSON.parse(resCrear.payload);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(200);
    const body = JSON.parse(resRetirar.payload);
    expect(body.ok).toBe(true);
    expect(body.total).toBe(10500);
    expect(body.recargo_5).toBe(500);
    const reservaDb = db.prepare("SELECT * FROM reservas WHERE id = ?").get(reserva.id) as any;
    expect(reservaDb.estado).toBe('retirada');
  });

  it('T-20: Retirar reserva vencida es rechazado', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    relojFalso.fijar('2026-12-02T10:00:01-03:00');
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(400);
    expect(JSON.parse(resRetirar.payload).error).toContain('ya venció');
  });

  it('T-20: POST /api/pagos responde 404', async () => {
    const res = await inject(app, { method: 'POST', url: '/api/pagos', payload: { monto: 100 } });
    expect(res.statusCode).toBe(404);
  });

  it('T-20: Cliente que intenta retirar recibe 403', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(resRetirar.statusCode).toBe(403);
  });

  // ---------- T-21: Precio al retirar ----------

  it('T-21: Precio vigente bajó a $8.000 -> cobra $8.400 (precio más bajo)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    db.prepare('UPDATE libros SET precio = ? WHERE id = ?').run(8000, naruto1.id);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(200);
    const body = JSON.parse(resRetirar.payload);
    expect(body.total).toBe(8400);
    expect(body.precio_fijado).toBe(10000);
    expect(body.precio_vigente).toBe(8000);
  });

  it('T-21: Precio subió a $12.000 -> cobra $10.500 (precio fijado, no aumento)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    db.prepare('UPDATE libros SET precio = ? WHERE id = ?').run(12000, naruto1.id);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(200);
    const body = JSON.parse(resRetirar.payload);
    expect(body.total).toBe(10500);
  });

  it('T-21: Descuento 20% vigente -> cobra $8.400', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    db.prepare(
      `INSERT INTO descuentos (alcance, referencia_id, tipo, porcentaje, fecha_inicio, fecha_fin)
       VALUES ('libro', ?, 'descuento', 20, '2026-12-01T00:00:00-03:00', '2026-12-03T00:00:00-03:00')`
    ).run(String(naruto1.id));
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(200);
    const body = JSON.parse(resRetirar.payload);
    expect(body.total).toBe(8400);
  });

  it('T-21: Aumento 10% vigente -> cobra $10.500 (no se cobra aumento)', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    db.prepare(
      `INSERT INTO descuentos (alcance, referencia_id, tipo, porcentaje, fecha_inicio, fecha_fin)
       VALUES ('libro', ?, 'aumento', 10, '2026-12-01T00:00:00-03:00', '2026-12-03T00:00:00-03:00')`
    ).run(String(naruto1.id));
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    const resRetirar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
      headers: { authorization: `Bearer ${tokenEmi}` }
    });
    expect(resRetirar.statusCode).toBe(200);
    const body = JSON.parse(resRetirar.payload);
    expect(body.total).toBe(10500);
  });

  // ---------- T-22: Cancelar una reserva ----------

  it('T-22: Ana cancela una reserva activa -> estado cancelada, sin deuda, disponibles +1', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    expect(resCrear.statusCode).toBe(201);
    const reserva = JSON.parse(resCrear.payload);

    const disponiblesAntes = db.prepare("SELECT cantidad_total - (SELECT COUNT(*) FROM reservas WHERE libro_id = ? AND estado = 'activa') as disp FROM libros WHERE id = ?").get(naruto1.id, naruto1.id) as any;
    
    const resCancelar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(resCancelar.statusCode).toBe(200);
    const body = JSON.parse(resCancelar.payload);
    expect(body.ok).toBe(true);

    const reservaDb = db.prepare("SELECT * FROM reservas WHERE id = ?").get(reserva.id) as any;
    expect(reservaDb.estado).toBe('cancelada');
    expect(reservaDb.fecha_cancelacion).toBeDefined();

    const disponiblesDespues = db.prepare("SELECT cantidad_total - (SELECT COUNT(*) FROM reservas WHERE libro_id = ? AND estado = 'activa') as disp FROM libros WHERE id = ?").get(naruto1.id, naruto1.id) as any;
    expect(disponiblesDespues.disp).toBe(disponiblesAntes.disp + 1);
  });

  it('T-22: Cancelar reserva ya vencida es rechazado', async () => {
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: naruto1.id }
    });
    const reserva = JSON.parse(resCrear.payload);
    relojFalso.fijar('2026-12-02T10:00:01-03:00');
    const resCancelar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva.id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(resCancelar.statusCode).toBe(400);
    expect(JSON.parse(resCancelar.payload).error).toContain('ya venció');
  });

  it('T-22: Ana con 3 reservas cancela 1 -> las otras 2 siguen activas', async () => {
    const libros = db.prepare("SELECT id FROM libros WHERE cantidad_total > 0 AND oculto = 0 LIMIT 3").all() as any[];
    const reservas = [];
    for (const libro of libros) {
      const resCrear = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: libro.id }
      });
      expect(resCrear.statusCode).toBe(201);
      reservas.push(JSON.parse(resCrear.payload));
    }

    const resCancelar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reservas[0].id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(resCancelar.statusCode).toBe(200);

    const resMisReservas = await inject(app, {
      method: 'GET', url: '/api/reservas/mias',
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(resMisReservas.statusCode).toBe(200);
    const misReservas = JSON.parse(resMisReservas.payload);
    expect(misReservas.length).toBe(2);
  });

  // ---------- T-23: Límite de 5 cancelaciones por mes ----------

  it('T-23: Con 5 canceladas en diciembre, la 6.ª es rechazada y reserva sigue activa', async () => {
    const libros = db.prepare("SELECT id FROM libros WHERE cantidad_total > 0 AND oculto = 0").all() as any[];
    let reservaParaCancelar6: any = null;

    // Crear y cancelar 5 reservas secuencialmente (límite de 5 activas)
    for (let i = 0; i < 5; i++) {
      const libro = libros[i % libros.length];
      const resCrear = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: libro.id }
      });
      expect(resCrear.statusCode).toBe(201);
      const reserva = JSON.parse(resCrear.payload);

      const resCancelar = await inject(app, {
        method: 'POST', url: `/api/reservas/${reserva.id}/cancelar`,
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resCancelar.statusCode).toBe(200);
    }

    // Crear la 6.ª reserva (después de cancelar 5, hay espacio)
    const libro6 = libros[5 % libros.length];
    const resCrear6 = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: libro6.id }
    });
    expect(resCrear6.statusCode).toBe(201);
    reservaParaCancelar6 = JSON.parse(resCrear6.payload);

    // La 6.ª cancelación es rechazada (límite de 5 por mes)
    const res6 = await inject(app, {
      method: 'POST', url: `/api/reservas/${reservaParaCancelar6.id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(res6.statusCode).toBe(400);
    expect(JSON.parse(res6.payload).error).toContain('límite de 5 cancelaciones');

    // La reserva 6 sigue activa
    const reserva6Db = db.prepare("SELECT * FROM reservas WHERE id = ?").get(reservaParaCancelar6.id) as any;
    expect(reserva6Db.estado).toBe('activa');
  });

  it('T-23: Con 4 canceladas, la 5.ª funciona', async () => {
    const libros = db.prepare("SELECT id FROM libros WHERE cantidad_total > 0 AND oculto = 0").all() as any[];

    // Crear y cancelar 4 reservas secuencialmente
    for (let i = 0; i < 4; i++) {
      const libro = libros[i % libros.length];
      const resCrear = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: libro.id }
      });
      expect(resCrear.statusCode).toBe(201);
      const reserva = JSON.parse(resCrear.payload);

      const resCancelar = await inject(app, {
        method: 'POST', url: `/api/reservas/${reserva.id}/cancelar`,
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resCancelar.statusCode).toBe(200);
    }

    // Crear la 5.ª reserva y cancelarla (debe funcionar)
    const libro5 = libros[4 % libros.length];
    const resCrear5 = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAna}` },
      payload: { libro_id: libro5.id }
    });
    expect(resCrear5.statusCode).toBe(201);
    const reserva5 = JSON.parse(resCrear5.payload);

    const res5 = await inject(app, {
      method: 'POST', url: `/api/reservas/${reserva5.id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAna}` }
    });
    expect(res5.statusCode).toBe(200);
  });

  it('T-23: Cambio de mes (enero) -> contador vuelve a 0 y cancelar funciona', async () => {
    // Cancelar 5 en diciembre
    const libros = db.prepare("SELECT id FROM libros WHERE cantidad_total > 0 AND oculto = 0 LIMIT 5").all() as any[];
    const reservas = [];
    for (const libro of libros) {
      const resCrear = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: libro.id }
      });
      expect(resCrear.statusCode).toBe(201);
      reservas.push(JSON.parse(resCrear.payload));
    }

    for (let i = 0; i < 5; i++) {
      const resCancelar = await inject(app, {
        method: 'POST', url: `/api/reservas/${reservas[i].id}/cancelar`,
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resCancelar.statusCode).toBe(200);
    }

    // Cambiar reloj a enero 2027
    relojFalso.fijar('2027-01-01T00:00:00-03:00');
    // Recrear sesión porque cambiar el reloj expira la anterior
    const ana = db.prepare("SELECT * FROM usuarios WHERE documento = '40111222'").get() as any;
    const tokenAnaEnero = `token-ana-enero`;
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(ana.id);
    db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
      .run(tokenAnaEnero, ana.id, relojFalso.ahora().toISOString());

    // Crear una nueva reserva en enero
    const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
    const resCrear = await inject(app, {
      method: 'POST', url: '/api/reservas',
      headers: { authorization: `Bearer ${tokenAnaEnero}` },
      payload: { libro_id: naruto1.id }
    });
    expect(resCrear.statusCode).toBe(201);
    const reservaNueva = JSON.parse(resCrear.payload);

    // Cancelar en enero -> debe funcionar (contador reiniciado)
    const resCancelar = await inject(app, {
      method: 'POST', url: `/api/reservas/${reservaNueva.id}/cancelar`,
      headers: { authorization: `Bearer ${tokenAnaEnero}` }
    });
    expect(resCancelar.statusCode).toBe(200);
  });
});