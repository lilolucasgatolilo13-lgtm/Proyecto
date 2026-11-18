export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

export interface Reloj {
  ahora(): Date;
}

export class RelojSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}

export class RelojFalso implements Reloj {
  private fechaActual: Date;

  constructor(fechaInicial: Date | string = new Date()) {
    this.fechaActual = typeof fechaInicial === 'string' ? new Date(fechaInicial) : new Date(fechaInicial.getTime());
  }

  ahora(): Date {
    return new Date(this.fechaActual.getTime());
  }

  fijar(fecha: Date | string): void {
    this.fechaActual = typeof fecha === 'string' ? new Date(fecha) : new Date(fecha.getTime());
  }

  avanzarMinutos(minutos: number): void {
    this.fechaActual = new Date(this.fechaActual.getTime() + minutos * 60 * 1000);
  }

  avanzarHoras(horas: number): void {
    this.fechaActual = new Date(this.fechaActual.getTime() + horas * 60 * 60 * 1000);
  }

  avanzarDias(dias: number): void {
    this.fechaActual = new Date(this.fechaActual.getTime() + dias * 24 * 60 * 60 * 1000);
  }
}

let relojActivo: Reloj = new RelojSistema();

export function obtenerReloj(): Reloj {
  return relojActivo;
}

export function establecerReloj(reloj: Reloj): void {
  relojActivo = reloj;
}

export function resetearReloj(): void {
  relojActivo = new RelojSistema();
}

export function ahora(): Date {
  return relojActivo.ahora();
}

/**
 * Devuelve el nombre del mes calendario en minúsculas en español (ej. 'diciembre', 'enero')
 * calculado en la zona horaria America/Argentina/Buenos_Aires (RN-23, RN-42).
 */
export function obtenerMesCalendario(fecha: Date | string = ahora()): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const formateador = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    month: 'long'
  });
  return formateador.format(f).toLowerCase();
}

/**
 * Devuelve el año y mes en formato YYYY-MM en la zona horaria de Buenos Aires.
 */
export function obtenerClaveMesCalendario(fecha: Date | string = ahora()): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(f);

  const anio = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value?.padStart(2, '0');
  return `${anio}-${mes}`;
}
