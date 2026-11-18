import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { crearBaseDatos } from '../db/conexion';
import { RelojFalso, establecerReloj, resetearReloj } from '../config/reloj';
import { CorreoService } from './correoService';

describe('T-04: Correo simulado (RN-34, RN-35)', () => {
  let db: Database.Database;
  let relojFalso: RelojFalso;
  let correoService: CorreoService;

  beforeEach(() => {
    db = crearBaseDatos(':memory:');
    relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);
    correoService = new CorreoService(db);
  });

  afterEach(() => {
    db.close();
    resetearReloj();
  });

  it('enviar un correo a ana@mail.com con asunto "Reserva confirmada" lo deja enviado y en la lista con ese destinatario y asunto', () => {
    const correoId = correoService.enviar(
      'ana@mail.com',
      'Reserva confirmada',
      'Tu código de reserva es RES-12345'
    );

    // Verificación en base de datos
    const correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as {
      destinatario: string;
      asunto: string;
      estado: string;
      intentos: number;
    };

    expect(correoDb).toBeDefined();
    expect(correoDb.destinatario).toBe('ana@mail.com');
    expect(correoDb.asunto).toBe('Reserva confirmada');
    expect(correoDb.estado).toBe('enviado');
    expect(correoDb.intentos).toBe(1);

    // Verificación en la lista en memoria que pueden leer los tests
    const enviados = correoService.obtenerEnviados();
    expect(enviados.length).toBe(1);
    expect(enviados[0].destinatario).toBe('ana@mail.com');
    expect(enviados[0].asunto).toBe('Reserva confirmada');
  });

  it('con el simulado forzado a fallar, la función que lo llamó no lanza error y el correo queda pendiente con 1 intento', () => {
    correoService.forzarFallo(true);

    let correoId: number = 0;
    expect(() => {
      correoId = correoService.enviar(
        'ana@mail.com',
        'Reserva confirmada',
        'Tu código es RES-123'
      );
    }).not.toThrow();

    // Verificación en base de datos
    const correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as {
      estado: string;
      intentos: number;
    };

    expect(correoDb.estado).toBe('pendiente');
    expect(correoDb.intentos).toBe(1);

    // No debe estar en la lista de enviados
    expect(correoService.obtenerEnviados().length).toBe(0);
  });

  it('tras 3 fallos (con el reloj avanzando 1 minuto cada vez), el correo queda fallido, hay 1 registro "correo fallido" en registro_actividad y no se intenta una 4.ª vez', () => {
    correoService.forzarFallo(true);

    // Intento 1: al enviar inicialmente (t = 10:00:00)
    const correoId = correoService.enviar(
      'ana@mail.com',
      'Reserva confirmada',
      'Código RES-999'
    );

    let correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as { estado: string; intentos: number };
    expect(correoDb.estado).toBe('pendiente');
    expect(correoDb.intentos).toBe(1);

    // Si aún no pasó 1 minuto (por ejemplo solo pasaron 30 segundos), no debe reintentar
    relojFalso.avanzarMinutos(0.5);
    const procesadosAntesDeTiempo = correoService.procesarPendientes();
    expect(procesadosAntesDeTiempo).toBe(0);

    // Avanzamos hasta completar 1 minuto desde el intento 1 -> Intento 2 (t = 10:01:00)
    relojFalso.avanzarMinutos(0.5);
    const procesadosIntento2 = correoService.procesarPendientes();
    expect(procesadosIntento2).toBe(1);

    correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as { estado: string; intentos: number };
    expect(correoDb.estado).toBe('pendiente');
    expect(correoDb.intentos).toBe(2);

    // Avanzamos otro minuto -> Intento 3 (t = 10:02:00)
    relojFalso.avanzarMinutos(1);
    const procesadosIntento3 = correoService.procesarPendientes();
    expect(procesadosIntento3).toBe(1);

    correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as { estado: string; intentos: number };
    expect(correoDb.estado).toBe('fallido');
    expect(correoDb.intentos).toBe(3);

    // Debe existir 1 registro de "correo fallido" en registro_actividad (RN-35)
    const registros = db
      .prepare('SELECT * FROM registro_actividad WHERE accion = ?')
      .all('correo fallido') as { accion: string; detalle: string }[];

    expect(registros.length).toBe(1);
    expect(registros[0].accion).toBe('correo fallido');
    expect(registros[0].detalle).toContain('ana@mail.com');
    expect(registros[0].detalle).toContain('Reserva confirmada');

    // Avanzamos 1 minuto más: Intento 4 no debe ocurrir nunca
    relojFalso.avanzarMinutos(1);
    const procesadosIntento4 = correoService.procesarPendientes();
    expect(procesadosIntento4).toBe(0);

    // El correo sigue exactamente con 3 intentos y estado fallido
    correoDb = db
      .prepare('SELECT * FROM correos WHERE id = ?')
      .get(correoId) as { estado: string; intentos: number };
    expect(correoDb.estado).toBe('fallido');
    expect(correoDb.intentos).toBe(3);
  });
});
