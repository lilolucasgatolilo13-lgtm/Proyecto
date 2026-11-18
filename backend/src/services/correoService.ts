import Database from 'better-sqlite3';
import { obtenerBaseDatos } from '../db/conexion';
import { ahora } from '../config/reloj';

export interface CorreoEnviado {
  id: number;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  fecha: string;
}

export class CorreoService {
  private debeFallar: boolean = false;
  private listaEnviados: CorreoEnviado[] = [];

  constructor(db?: Database.Database) {
    if (db) this._db = db;
  }

  private get db(): Database.Database {
    return this._db || obtenerBaseDatos();
  }

  private _db?: Database.Database;

  forzarFallo(debeFallar: boolean): void {
    this.debeFallar = debeFallar;
  }

  obtenerEnviados(): CorreoEnviado[] {
    return [...this.listaEnviados];
  }

  limpiar(): void {
    this.listaEnviados = [];
    this.debeFallar = false;
  }

  /**
   * Encola un correo y ejecuta el primer intento de envío inmediatamente.
   * Si el envío falla, NO lanza error para no frenar la operación que lo llamó (RN-34).
   */
  enviar(destinatario: string, asunto: string, cuerpo: string): number {
    const fechaActual = ahora().toISOString();

    const insert = this.db.prepare(`
      INSERT INTO correos (destinatario, asunto, cuerpo, estado, intentos, fecha)
      VALUES (?, ?, ?, 'pendiente', 0, ?)
    `);

    const info = insert.run(destinatario, asunto, cuerpo, fechaActual);
    const correoId = Number(info.lastInsertRowid);

    try {
      this.intentarEnvio(correoId);
    } catch {
      // Garantizar que la llamada nunca propague un error hacia el llamador (RN-34)
    }

    return correoId;
  }

  /**
   * Intenta enviar un correo específico respetando la lógica de reintentos (RN-34, RN-35).
   */
  private intentarEnvio(correoId: number): boolean {
    const correo = this.db.prepare('SELECT * FROM correos WHERE id = ?').get(correoId) as
      | {
          id: number;
          destinatario: string;
          asunto: string;
          cuerpo: string;
          estado: string;
          intentos: number;
          fecha: string;
        }
      | undefined;

    if (!correo || correo.estado === 'enviado' || correo.estado === 'fallido') {
      return false;
    }

    const nuevosIntentos = correo.intentos + 1;
    const fechaIntento = ahora().toISOString();

    if (this.debeFallar) {
      if (nuevosIntentos >= 3) {
        // Superó los 3 intentos: marcar como fallido y registrar en registro_actividad (RN-34, RN-35)
        this.db
          .prepare(
            `UPDATE correos SET estado = 'fallido', intentos = ?, fecha = ? WHERE id = ?`
          )
          .run(nuevosIntentos, fechaIntento, correoId);

        this.db
          .prepare(
            `INSERT INTO registro_actividad (usuario_id, accion, detalle, fecha)
             VALUES (NULL, 'correo fallido', ?, ?)`
          )
          .run(
            `Fallo al enviar correo a ${correo.destinatario} con asunto "${correo.asunto}". Superó los 3 intentos.`,
            fechaIntento
          );
      } else {
        // Aún le quedan intentos: mantener como pendiente
        this.db
          .prepare(
            `UPDATE correos SET estado = 'pendiente', intentos = ?, fecha = ? WHERE id = ?`
          )
          .run(nuevosIntentos, fechaIntento, correoId);
      }
      return false;
    }

    // Envío exitoso
    this.db
      .prepare(
        `UPDATE correos SET estado = 'enviado', intentos = ?, fecha = ? WHERE id = ?`
      )
      .run(nuevosIntentos, fechaIntento, correoId);

    this.listaEnviados.push({
      id: correo.id,
      destinatario: correo.destinatario,
      asunto: correo.asunto,
      cuerpo: correo.cuerpo,
      fecha: fechaIntento
    });

    return true;
  }

  /**
   * Procesa los correos pendientes que hayan esperado al menos 1 minuto desde su último intento (RN-34).
   * Devuelve la cantidad de correos procesados en esta pasada.
   */
  procesarPendientes(): number {
    const pendientes = this.db
      .prepare(
        `SELECT * FROM correos WHERE estado = 'pendiente' AND intentos < 3`
      )
      .all() as {
      id: number;
      destinatario: string;
      asunto: string;
      cuerpo: string;
      estado: string;
      intentos: number;
      fecha: string;
    }[];

    const tiempoAhora = ahora().getTime();
    let procesados = 0;

    for (const correo of pendientes) {
      const tiempoUltimoIntento = new Date(correo.fecha).getTime();
      const unMinutoMs = 60 * 1000;

      // Debe haber pasado al menos 1 minuto desde el intento anterior
      if (tiempoAhora - tiempoUltimoIntento >= unMinutoMs) {
        this.intentarEnvio(correo.id);
        procesados++;
      }
    }

    return procesados;
  }
}
