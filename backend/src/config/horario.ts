import { ahora, ZONA_HORARIA } from './reloj';

export const INFO_CONTACTO = {
  direccion: 'Av. Corrientes 1234, CABA, Argentina',
  telefono: '011-4567-8901',
  correo: 'contacto@comiqueria.com',
  horario: 'Lunes a sábado de 10:00 a 13:00 y de 15:00 a 20:00. Domingos de 11:00 a 18:00 sin cierre al mediodía.'
};

export const INFO_POLITICAS = {
  plazo_reserva: 'El cliente tiene 24 horas corridas desde que reservó para retirar en el local, aunque el local esté cerrado.',
  recargo_reserva: '5% extra sobre el precio del libro al retirar en el local.',
  deudas: '5% del precio fijado al reservar si la reserva vence sin ser retirada. Mientras tenga deuda, no se pueden hacer nuevas reservas.',
  pago: 'Todos los pagos se realizan únicamente en persona y en efectivo en el local.'
};

/**
 * RN-02: El local abre de lunes a sábado de 10:00 a 13:00 y de 15:00 a 20:00,
 * y los domingos de 11:00 a 18:00 sin cierre al mediodía.
 * Calculado en la zona horaria oficial America/Argentina/Buenos_Aires.
 */
export function localAbierto(fecha: Date | string = ahora()): boolean {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;

  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(f);

  const diaSemanaTexto = partes.find((p) => p.type === 'weekday')?.value?.toLowerCase() || '';
  const hora = Number(partes.find((p) => p.type === 'hour')?.value || 0);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value || 0);
  const minutosTotales = hora * 60 + minuto;

  // En es-AR 'dom', 'domingo', 'd.'
  const esDomingo = diaSemanaTexto.startsWith('dom');

  if (esDomingo) {
    // Domingos: 11:00 (660m) a 18:00 (1080m)
    return minutosTotales >= 11 * 60 && minutosTotales < 18 * 60;
  } else {
    // Lunes a sábado: 10:00 a 13:00 (600 a 780) y 15:00 a 20:00 (900 a 1200)
    const turnoManana = minutosTotales >= 10 * 60 && minutosTotales < 13 * 60;
    const turnoTarde = minutosTotales >= 15 * 60 && minutosTotales < 20 * 60;
    return turnoManana || turnoTarde;
  }
}
