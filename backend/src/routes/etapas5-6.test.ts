import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import inject from 'light-my-request';
import Database from 'better-sqlite3';
import app from '../app';
import { crearBaseDatos, cerrarBaseDatos, establecerBaseDatos } from '../db/conexion';
import { cargarDatosIniciales } from '../db/datosIniciales';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';
import { DeudaService } from '../services/deudaService';
import { AdministracionService } from '../services/administracionService';

describe('Etapa 5 (T-24 a T-28) y Etapa 6 (T-29 a T-33)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let tokenAna: string;
  let tokenCarla: string;
  let tokenEmi: string;
  let tokenAda: string;
  let idAna: number;
  let idCarla: number;
  let idEmi: number;
  let idAda: number;

  beforeEach(() => {
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);
    db = crearBaseDatos(':memory:');
    establecerBaseDatos(db);
    cargarDatosIniciales(db);

    const crearSesion = (documento: string): { token: string; id: number } => {
      const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(documento) as any;
      const token = `token-${documento}`;
      db.prepare('INSERT INTO sesiones (token, usuario_id, ultima_actividad) VALUES (?, ?, ?)')
        .run(token, usuario.id, relojFalso.ahora().toISOString());
      return { token, id: usuario.id };
    };

    const sAda = crearSesion('30000001'); // Administrador
    tokenAda = sAda.token; idAda = sAda.id;

    const sEmi = crearSesion('30000002'); // Empleado
    tokenEmi = sEmi.token; idEmi = sEmi.id;

    const sAna = crearSesion('40111222'); // Cliente (26 años)
    tokenAna = sAna.token; idAna = sAna.id;

    const sCarla = crearSesion('40333444'); // Cliente (25 años)
    tokenCarla = sCarla.token; idCarla = sCarla.id;
  });

  afterEach(() => {
    cerrarBaseDatos();
    resetearReloj();
  });

  // ========================================================
  // ETAPA 5: Ausencias y bloqueos
  // ========================================================

  describe('T-24: Vencimiento automático y deuda (RN-18, RN-23, RN-26, HU-06)', () => {
    it('Reserva vencida pasa a estado vencida, disponibles +1 y deuda del 5% pendiente; job idempotente', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
      
      // Ana reserva Naruto 1 el 2026-12-01 10:00 ($10.000)
      const resReserva = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto1.id }
      });
      expect(resReserva.statusCode).toBe(201);
      const reserva = JSON.parse(resReserva.payload);

      // Creamos otra reserva de Carla que vence a las 12:00
      relojFalso.fijar(new Date('2026-12-01T12:00:00-03:00'));
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: naruto1.id }
      });

      // Avanzamos el reloj a 2026-12-02 10:01 (pasó el vencimiento de Ana, pero NO el de Carla)
      relojFalso.fijar(new Date('2026-12-02T10:01:00-03:00'));

      // Ejecutamos el job de vencimientos
      const deudaService = new DeudaService();
      const procesadas = deudaService.procesarVencimientos();
      expect(procesadas).toBe(1);

      // Estado de la reserva de Ana: vencida
      const rAna = db.prepare('SELECT * FROM reservas WHERE id = ?').get(reserva.id) as any;
      expect(rAna.estado).toBe('vencida');

      // Disponibles de Naruto 1: había 3 copias. Ana y Carla tenían 1 c/u (quedaba 1). Con la de Ana vencida, deben ser 2
      const resCatalogo = await inject(app, { method: 'GET', url: `/api/libros/${naruto1.id}` });
      const libroActualizado = JSON.parse(resCatalogo.payload);
      expect(libroActualizado.cantidad_disponible).toBe(2);

      // Deuda del 5% generada para Ana: $10.000 * 0.05 = $500
      const deudasAna = db.prepare("SELECT * FROM deudas WHERE cliente_id = ?").all(idAna) as any[];
      expect(deudasAna.length).toBe(1);
      expect(deudasAna[0].monto).toBe(500);
      expect(deudasAna[0].estado).toBe('pendiente');

      // La reserva de Carla no cambió
      const rCarla = db.prepare("SELECT * FROM reservas WHERE cliente_id = ?").get(idCarla) as any;
      expect(rCarla.estado).toBe('activa');

      // Correr el job 2 veces deja 1 sola deuda (idempotencia)
      const procesadasSegunda = deudaService.procesarVencimientos();
      expect(procesadasSegunda).toBe(0);
      const deudasAnaSegunda = db.prepare("SELECT * FROM deudas WHERE cliente_id = ?").all(idAna) as any[];
      expect(deudasAnaSegunda.length).toBe(1);

      // Con el reloj en 10:01, retirar la reserva vencida de Ana es rechazado
      const resRetiro = await inject(app, {
        method: 'POST', url: `/api/reservas/${reserva.id}/retirar`,
        headers: { authorization: `Bearer ${tokenEmi}` }
      });
      expect(resRetiro.statusCode).toBe(400);
    });
  });

  describe('T-25: Ver mi deuda (RN-26, RN-30, HU-06)', () => {
    it('GET /api/deudas/mias devuelve la deuda calculada sobre precio fijado; Ana sin deudas recibe lista vacía', async () => {
      // Ana sin deudas
      const resVacia = await inject(app, {
        method: 'GET', url: '/api/deudas/mias',
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resVacia.statusCode).toBe(200);
      expect(JSON.parse(resVacia.payload)).toEqual([]);

      // Ana reserva Naruto 1 con precio fijado $10.000
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto1.id }
      });

      // Luego el precio de Naruto 1 sube a $12.000
      db.prepare('UPDATE libros SET precio = 12000 WHERE id = ?').run(naruto1.id);

      // Pasa el plazo y vence
      relojFalso.fijar(new Date('2026-12-02T10:01:00-03:00'));
      new DeudaService().procesarVencimientos();

      // Consultar deudas: la deuda debe ser $500 (sobre $10.000), no $600
      const resDeudas = await inject(app, {
        method: 'GET', url: '/api/deudas/mias',
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resDeudas.statusCode).toBe(200);
      const deudas = JSON.parse(resDeudas.payload);
      expect(deudas.length).toBe(1);
      expect(deudas[0].monto).toBe(500);
      expect(deudas[0].precio_fijado).toBe(10000);
      expect(deudas[0].libro_titulo).toBe('Naruto 1');
    });
  });

  describe('T-26: Bloqueo por deuda (RN-27, RN-29, HU-06)', () => {
    it('Ana con deuda no puede crear nuevas reservas pero ve catálogo y conserva reservas activas', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
      const naruto2 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 2'").get() as any;

      // Ana reserva Naruto 1 a las 10:00 (vence mañana 10:00)
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto1.id }
      });

      // Ana reserva Naruto 2 a las 11:00 (vence mañana 11:00)
      relojFalso.fijar(new Date('2026-12-01T11:00:00-03:00'));
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto2.id }
      });

      // Mañana a las 10:05 vence la reserva de Naruto 1
      relojFalso.fijar(new Date('2026-12-02T10:05:00-03:00'));
      new DeudaService().procesarVencimientos();

      // Ana tiene ahora $500 de deuda.
      // Su reserva anterior de Naruto 2 sigue activa (vence a las 11:00)
      const resActivas = await inject(app, {
        method: 'GET', url: '/api/reservas/mias',
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      const activas = JSON.parse(resActivas.payload);
      expect(activas.length).toBe(1);
      expect(activas[0].titulo).toBe('Naruto 2');

      // Ve el catálogo sin problemas
      const resCatalogo = await inject(app, { method: 'GET', url: '/api/libros' });
      expect(resCatalogo.statusCode).toBe(200);

      // Pero POST /api/reservas para un nuevo libro es rechazado por deuda pendiente
      const deathNote = db.prepare("SELECT * FROM libros WHERE titulo = 'Death Note 1'").get() as any;
      const resIntentoReserva = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: deathNote.id }
      });
      expect(resIntentoReserva.statusCode).toBe(400);
      expect(JSON.parse(resIntentoReserva.payload).error).toMatch(/deuda/i);

      // Si a las 11:05 vence la reserva de Naruto 2 ($8.000 * 0.05 = $400)
      relojFalso.fijar(new Date('2026-12-02T11:05:00-03:00'));
      new DeudaService().procesarVencimientos();

      // Deuda acumulada de Ana: $500 + $500 = $1.000 (RN-27, RN-29)
      const deudasTotales = db.prepare("SELECT SUM(monto) as total FROM deudas WHERE cliente_id = ? AND estado = 'pendiente'").get(idAna) as any;
      expect(deudasTotales.total).toBe(1000);
    });
  });

  describe('T-27: Pagar y perdonar una deuda (RN-28, RN-31, RN-45, HU-11, HU-16)', () => {
    it('Empleado registra pago, cliente no puede pagar la suya (403), admin perdona con motivo y se guarda en historial', async () => {
      // Insertar una deuda pendiente para Ana
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
      db.prepare(`
        INSERT INTO reservas (id, codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
        VALUES (999, 'RES-ANA-1', ?, ?, 10000, '2026-12-01T10:00:00Z', '2026-12-02T10:00:00Z', 'vencida')
      `).run(idAna, naruto1.id);
      const deudaInfo = db.prepare(`
        INSERT INTO deudas (cliente_id, reserva_id, monto, estado, fecha)
        VALUES (?, 999, 500, 'pendiente', '2026-12-02T10:01:00Z')
      `).run(idAna);
      const deudaId = Number(deudaInfo.lastInsertRowid);

      // Ana intenta marcar su propia deuda como pagada: 403
      const resAnaPaga = await inject(app, {
        method: 'POST', url: `/api/deudas/${deudaId}/pago`,
        headers: { authorization: `Bearer ${tokenAna}` }
      });
      expect(resAnaPaga.statusCode).toBe(403);

      // Emi (empleado) intenta perdonar la deuda: 403
      const resEmiPerdona = await inject(app, {
        method: 'POST', url: `/api/deudas/${deudaId}/perdon`,
        headers: { authorization: `Bearer ${tokenEmi}` },
        payload: { motivo: 'error del sistema' }
      });
      expect(resEmiPerdona.statusCode).toBe(403);

      // Ada intenta perdonar sin motivo: 400 rechazado
      const resAdaSinMotivo = await inject(app, {
        method: 'POST', url: `/api/deudas/${deudaId}/perdon`,
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: {}
      });
      expect(resAdaSinMotivo.statusCode).toBe(400);

      // Ada perdona con motivo "error del sistema": 200 OK
      const resAdaPerdona = await inject(app, {
        method: 'POST', url: `/api/deudas/${deudaId}/perdon`,
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: { motivo: 'error del sistema' }
      });
      expect(resAdaPerdona.statusCode).toBe(200);

      // Verificar que quedó perdonada y registrada en historial_cuenta
      const deudaPerdonada = db.prepare('SELECT * FROM deudas WHERE id = ?').get(deudaId) as any;
      expect(deudaPerdonada.estado).toBe('perdonada');

      const historial = db.prepare('SELECT * FROM historial_cuenta WHERE usuario_id = ?').all(idAna) as any[];
      expect(historial.length).toBe(1);
      expect(historial[0].tipo).toBe('perdon_deuda');
      expect(historial[0].motivo).toBe('error del sistema');
      expect(historial[0].administrador_id).toBe(idAda);

      // Ahora insertamos otra deuda y Emi la marca como pagada
      const deuda2Info = db.prepare(`
        INSERT INTO deudas (cliente_id, reserva_id, monto, estado, fecha)
        VALUES (?, 999, 500, 'pendiente', '2026-12-02T10:01:00Z')
      `).run(idAna);
      const deuda2Id = Number(deuda2Info.lastInsertRowid);

      const resEmiPago = await inject(app, {
        method: 'POST', url: `/api/deudas/${deuda2Id}/pago`,
        headers: { authorization: `Bearer ${tokenEmi}` }
      });
      expect(resEmiPago.statusCode).toBe(200);

      // Ana ya no tiene deudas pendientes y puede volver a reservar
      const resNuevaReserva = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto1.id }
      });
      expect(resNuevaReserva.statusCode).toBe(201);
    });
  });

  describe('T-28: Baneo (RN-39, HU-13, HU-19)', () => {
    it('Empleado informa documento, Ada banea cancelando reservas sin deuda, revierte baneo y Emi 403 al banear', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;
      const naruto2 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 2'").get() as any;
      const dragonBall1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Dragon Ball 1'").get() as any;

      // Carla tiene 3 reservas activas
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: naruto1.id }
      });
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: naruto2.id }
      });
      await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: dragonBall1.id }
      });

      // Emi informa documento ajeno de Carla
      const resInforme = await inject(app, {
        method: 'POST', url: `/api/usuarios/${idCarla}/informe-documento`,
        headers: { authorization: `Bearer ${tokenEmi}` }
      });
      expect(resInforme.statusCode).toBe(200);

      // Emi intenta banear a Carla: 403
      const resEmiBaneo = await inject(app, {
        method: 'POST', url: `/api/usuarios/${idCarla}/baneo`,
        headers: { authorization: `Bearer ${tokenEmi}` },
        payload: { motivo: 'documento prestado' }
      });
      expect(resEmiBaneo.statusCode).toBe(403);

      // Ada banea a Carla con motivo "documento prestado"
      const resAdaBaneo = await inject(app, {
        method: 'POST', url: `/api/usuarios/${idCarla}/baneo`,
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: { motivo: 'documento prestado' }
      });
      expect(resAdaBaneo.statusCode).toBe(200);

      // Carla tenía 3 reservas activas: se cancelan las 3, disponibles +3, sin ninguna deuda
      const reservasCarla = db.prepare('SELECT * FROM reservas WHERE cliente_id = ?').all(idCarla) as any[];
      expect(reservasCarla.every(r => r.estado === 'cancelada')).toBe(true);

      const deudasCarla = db.prepare('SELECT * FROM deudas WHERE cliente_id = ?').all(idCarla) as any[];
      expect(deudasCarla.length).toBe(0);

      // Carla ve el catálogo
      const resCat = await inject(app, { method: 'GET', url: '/api/libros' });
      expect(resCat.statusCode).toBe(200);

      // Pero POST /api/reservas es rechazado
      const resIntento = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: naruto1.id }
      });
      expect(resIntento.statusCode).toBe(400);
      expect(JSON.parse(resIntento.payload).error).toMatch(/baneada/i);

      // Ada revierte el baneo: Carla vuelve a poder reservar
      const resRevertir = await inject(app, {
        method: 'DELETE', url: `/api/usuarios/${idCarla}/baneo`,
        headers: { authorization: `Bearer ${tokenAda}` }
      });
      expect(resRevertir.statusCode).toBe(200);

      const resReservaCarlaPost = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenCarla}` },
        payload: { libro_id: naruto1.id }
      });
      expect(resReservaCarlaPost.statusCode).toBe(201);
    });
  });

  // ========================================================
  // ETAPA 6: Avisos, cierre y administración
  // ========================================================

  describe('T-29: Avisos (RN-33, RN-44, HU-17)', () => {
    it('Aviso publicado 2026-12-01 10:00 es visible el 2026-12-08 09:59 y no visible el 2026-12-08 10:01; Emi recibe 403', async () => {
      // Emi intenta publicar un aviso: 403
      const resEmi = await inject(app, {
        method: 'POST', url: '/api/avisos',
        headers: { authorization: `Bearer ${tokenEmi}` },
        payload: { titulo: 'Feriado', texto: 'Cerrado' }
      });
      expect(resEmi.statusCode).toBe(403);

      // Ada publica un aviso el 2026-12-01 10:00
      const resAda = await inject(app, {
        method: 'POST', url: '/api/avisos',
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: { titulo: 'Nuevo ingreso', texto: 'Llegaron mangas de Chainsaw Man' }
      });
      expect(resAda.statusCode).toBe(201);

      // Con el reloj en 2026-12-08 09:59 (dentro de los 7 días): visible
      relojFalso.fijar(new Date('2026-12-08T09:59:00-03:00'));
      const resVisible = await inject(app, { method: 'GET', url: '/api/avisos' });
      const avisosVisible = JSON.parse(resVisible.payload);
      expect(avisosVisible.length).toBe(1);
      expect(avisosVisible[0].titulo).toBe('Nuevo ingreso');

      // Con el reloj en 2026-12-08 10:01 (pasados los 7 días): no visible
      relojFalso.fijar(new Date('2026-12-08T10:01:00-03:00'));
      const resNoVisible = await inject(app, { method: 'GET', url: '/api/avisos' });
      const avisosNoVisible = JSON.parse(resNoVisible.payload);
      expect(avisosNoVisible.length).toBe(0);
    });
  });

  describe('T-30: Cierre del local (RN-38, HU-17)', () => {
    it('Cierre el 2026-12-08 extiende 24 horas a reservas que vencían ese día, avisa por correo y crea aviso', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

      // Creamos reserva que vence el 2026-12-08 11:00 (se creó el 2026-12-07 11:00)
      db.prepare(`
        INSERT INTO reservas (id, codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
        VALUES (801, 'RES-CIERRE-1', ?, ?, 10000, '2026-12-07T11:00:00-03:00', '2026-12-08T11:00:00-03:00', 'activa')
      `).run(idAna, naruto1.id);

      // Creamos otra reserva que vence el 2026-12-10 11:00
      db.prepare(`
        INSERT INTO reservas (id, codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
        VALUES (802, 'RES-CIERRE-2', ?, ?, 10000, '2026-12-09T11:00:00-03:00', '2026-12-10T11:00:00-03:00', 'activa')
      `).run(idCarla, naruto1.id);

      // Ada registra cierre del local para el 2026-12-08
      const resCierre = await inject(app, {
        method: 'POST', url: '/api/cierres',
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: { fecha: '2026-12-08' }
      });
      expect(resCierre.statusCode).toBe(200);
      expect(JSON.parse(resCierre.payload).reservasAfectadas).toBe(1);

      // La reserva 801 pasa a vencer 2026-12-09 11:00
      const r801 = db.prepare('SELECT * FROM reservas WHERE id = 801').get() as any;
      expect(new Date(r801.fecha_vencimiento).getTime()).toBe(new Date('2026-12-09T11:00:00-03:00').getTime());

      // La reserva 802 queda sin cambios (2026-12-10 11:00)
      const r802 = db.prepare('SELECT * FROM reservas WHERE id = 802').get() as any;
      expect(new Date(r802.fecha_vencimiento).getTime()).toBe(new Date('2026-12-10T11:00:00-03:00').getTime());

      // El correo simulado recibe un correo para el cliente afectado
      const correos = db.prepare('SELECT * FROM correos WHERE destinatario = ?').all('ana@mail.com') as any[];
      expect(correos.length).toBeGreaterThanOrEqual(1);

      // Y aparece un aviso nuevo
      const avisos = db.prepare('SELECT * FROM avisos WHERE titulo LIKE ?').all('%Local cerrado%') as any[];
      expect(avisos.length).toBe(1);
    });
  });

  describe('T-31: Correos de reserva (RN-34, RN-38, HU-04)', () => {
    it('Manda confirmación, aviso de 6 horas sin duplicar, y nuevo aviso si un cierre extendió el plazo', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

      // Ana reserva a las 10:00 -> 1 correo de confirmación
      const resReserva = await inject(app, {
        method: 'POST', url: '/api/reservas',
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { libro_id: naruto1.id }
      });
      expect(resReserva.statusCode).toBe(201);
      const reserva = JSON.parse(resReserva.payload);

      let correosAna = db.prepare('SELECT * FROM correos WHERE destinatario = ?').all('ana@mail.com') as any[];
      expect(correosAna.length).toBe(1);

      // Avanzamos el reloj a las 04:00 del día siguiente (faltan 6 horas para las 10:00)
      relojFalso.fijar(new Date('2026-12-02T04:00:00-03:00'));
      const adminService = new AdministracionService();
      const enviados1 = adminService.procesarAvisos6Horas();
      expect(enviados1).toBe(1);

      correosAna = db.prepare('SELECT * FROM correos WHERE destinatario = ?').all('ana@mail.com') as any[];
      expect(correosAna.length).toBe(2);

      // Correr el job de nuevo a las 04:05 no lo repite
      relojFalso.fijar(new Date('2026-12-02T04:05:00-03:00'));
      const enviados2 = adminService.procesarAvisos6Horas();
      expect(enviados2).toBe(0);

      correosAna = db.prepare('SELECT * FROM correos WHERE destinatario = ?').all('ana@mail.com') as any[];
      expect(correosAna.length).toBe(2);

      // Ahora probamos el caso con cierre:
      // Reserva que vence 2026-12-08 11:00: recibe aviso de 6h el 2026-12-08 05:00.
      db.prepare(`
        INSERT INTO reservas (id, codigo, cliente_id, libro_id, precio_fijado, fecha_reserva, fecha_vencimiento, estado)
        VALUES (905, 'RES-6H-CIERRE', ?, ?, 10000, '2026-12-07T11:00:00-03:00', '2026-12-08T11:00:00-03:00', 'activa')
      `).run(idCarla, naruto1.id);

      relojFalso.fijar(new Date('2026-12-08T05:00:00-03:00'));
      adminService.procesarAvisos6Horas();
      const correosCarla1 = db.prepare('SELECT * FROM correos WHERE destinatario = ?').all('carla@mail.com') as any[];
      expect(correosCarla1.length).toBe(1);

      // Ada cierra el local el 2026-12-08 y la reserva pasa a vencer 2026-12-09 11:00
      adminService.cerrarLocal('2026-12-08', idAda);

      // El 2026-12-09 a las 05:00 (6 horas antes del nuevo vencimiento), corre el job y manda el segundo aviso
      relojFalso.fijar(new Date('2026-12-09T05:00:00-03:00'));
      adminService.procesarAvisos6Horas();
      const correosCarla2 = db.prepare('SELECT * FROM correos WHERE destinatario = ? AND asunto LIKE ?').all('carla@mail.com', '%vencer%') as any[];
      expect(correosCarla2.length).toBe(2);
    });
  });

  describe('T-32: Empleados y límites de usuarios (RN-40, HU-08, HU-18)', () => {
    it('Máximo 10 empleados y 4 administradores; Emi recibe 403 al crear personal', async () => {
      // Emi intenta crear un empleado: 403
      const resEmi = await inject(app, {
        method: 'POST', url: '/api/empleados',
        headers: { authorization: `Bearer ${tokenEmi}` },
        payload: {
          nombre: 'Juan', apellido: 'Perez', documento: '99000001',
          correo: 'juan@gmail.com', telefono: '11223344', contrasena: 'Pass1234',
          fecha_nacimiento: '1995-01-01'
        }
      });
      expect(resEmi.statusCode).toBe(403);

      // Cargar empleados hasta llegar a 10 (inicialmente hay 1 empleado en datosIniciales: Emi)
      for (let i = 2; i <= 10; i++) {
        const res = await inject(app, {
          method: 'POST', url: '/api/empleados',
          headers: { authorization: `Bearer ${tokenAda}` },
          payload: {
            rol: 'empleado',
            nombre: `Empleado${i}`, apellido: 'Test', documento: `9900000${i}`,
            correo: `emp${i}@gmail.com`, telefono: '11223344', contrasena: 'Pass1234',
            fecha_nacimiento: '1995-01-01'
          }
        });
        expect(res.statusCode).toBe(201);
      }

      // Con 10 empleados, crear el 11.° es rechazado
      const res11 = await inject(app, {
        method: 'POST', url: '/api/empleados',
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: {
          rol: 'empleado',
          nombre: 'Empleado11', apellido: 'Test', documento: '99000011',
          correo: 'emp11@gmail.com', telefono: '11223344', contrasena: 'Pass1234',
          fecha_nacimiento: '1995-01-01'
        }
      });
      expect(res11.statusCode).toBe(400);
      expect(JSON.parse(res11.payload).error).toMatch(/10 empleados/i);

      // Cargar administradores hasta llegar a 4 (inicialmente hay 1: Ada)
      for (let i = 2; i <= 4; i++) {
        const res = await inject(app, {
          method: 'POST', url: '/api/empleados',
          headers: { authorization: `Bearer ${tokenAda}` },
          payload: {
            rol: 'administrador',
            nombre: `Admin${i}`, apellido: 'Test', documento: `8800000${i}`,
            correo: `adm${i}@gmail.com`, telefono: '11223344', contrasena: 'Pass1234',
            fecha_nacimiento: '1990-01-01'
          }
        });
        expect(res.statusCode).toBe(201);
      }

      // Con 4 administradores, crear el 5.° es rechazado
      const resAdmin5 = await inject(app, {
        method: 'POST', url: '/api/empleados',
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: {
          rol: 'administrador',
          nombre: 'Admin5', apellido: 'Test', documento: '88000005',
          correo: 'adm5@gmail.com', telefono: '11223344', contrasena: 'Pass1234',
          fecha_nacimiento: '1990-01-01'
        }
      });
      expect(resAdmin5.statusCode).toBe(400);
      expect(JSON.parse(resAdmin5.payload).error).toMatch(/4 administradores/i);
    });
  });

  describe('T-33: Registro de actividad (RN-35, RN-45, HU-18)', () => {
    it('Registra cambio de precio con usuario y fecha; purga >30 días y preserva historial_cuenta', async () => {
      const naruto1 = db.prepare("SELECT * FROM libros WHERE titulo = 'Naruto 1'").get() as any;

      // Ada cambia el precio de Naruto 1 a $11.000
      const resPrecio = await inject(app, {
        method: 'PUT', url: `/api/libros/${naruto1.id}`,
        headers: { authorization: `Bearer ${tokenAda}` },
        payload: { precio: 11000 }
      });
      expect(resPrecio.statusCode).toBe(200);

      // Hay 1 registro con su usuario y la fecha
      const resActividad = await inject(app, {
        method: 'GET', url: '/api/registro-actividad',
        headers: { authorization: `Bearer ${tokenAda}` }
      });
      expect(resActividad.statusCode).toBe(200);
      const actividad = JSON.parse(resActividad.payload);
      const regPrecio = actividad.find((a: any) => a.accion === 'cambio_precio');
      expect(regPrecio).toBeDefined();
      expect(regPrecio.usuario_id).toBe(idAda);

      // Insertamos una actividad de hace 31 días y una de hace 29 días
      const fecha31DiasAtras = new Date(relojFalso.ahora().getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const fecha29DiasAtras = new Date(relojFalso.ahora().getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
      const fecha40DiasAtras = new Date(relojFalso.ahora().getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
        VALUES (?, 'test_antiguo_31', 'Actividad vieja', ?)
      `).run(idAda, fecha31DiasAtras);

      db.prepare(`
        INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
        VALUES (?, 'test_reciente_29', 'Actividad reciente', ?)
      `).run(idAda, fecha29DiasAtras);

      // Insertamos un registro de historial_cuenta de hace 40 días
      db.prepare(`
        INSERT INTO historial_cuenta (usuario_id, tipo, motivo, fecha, administrador_id)
        VALUES (?, 'baneo', 'Baneo histórico', ?, ?)
      `).run(idCarla, fecha40DiasAtras, idAda);

      // Corremos la limpieza de actividad antigua
      const adminService = new AdministracionService();
      const purgados = adminService.limpiarRegistroActividad();
      expect(purgados).toBeGreaterThanOrEqual(1);

      // El registro de hace 31 días se borró
      const r31 = db.prepare("SELECT * FROM registro_actividad WHERE accion = 'test_antiguo_31'").get();
      expect(r31).toBeUndefined();

      // El registro de hace 29 días sigue existiendo
      const r29 = db.prepare("SELECT * FROM registro_actividad WHERE accion = 'test_reciente_29'").get();
      expect(r29).toBeDefined();

      // El baneo de hace 40 días en historial_cuenta sigue intacto
      const h40 = db.prepare("SELECT * FROM historial_cuenta WHERE motivo = 'Baneo histórico'").get();
      expect(h40).toBeDefined();
    });
  });
});
