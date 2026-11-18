import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RelojFalso,
  establecerReloj,
  resetearReloj,
  ahora,
  obtenerMesCalendario,
  obtenerClaveMesCalendario
} from './reloj';

describe('T-03: Reloj del servidor y mes calendario (RN-23, RN-42)', () => {
  beforeEach(() => {
    resetearReloj();
  });

  afterEach(() => {
    resetearReloj();
  });

  it('con el reloj falso en 2026-12-01 10:00, ahora() devuelve esa fecha', () => {
    // 2026-12-01 10:00 en horario de Buenos Aires (-03:00)
    const fechaEsperada = new Date('2026-12-01T10:00:00-03:00');
    const relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    expect(ahora().getTime()).toBe(fechaEsperada.getTime());
    expect(ahora().toISOString()).toBe(fechaEsperada.toISOString());
  });

  it('el mes calendario de 2026-12-31 23:59 es diciembre y el de 2027-01-01 00:00 es enero', () => {
    const finDeAno = '2026-12-31T23:59:00-03:00';
    const inicioAnoNuevo = '2027-01-01T00:00:00-03:00';

    expect(obtenerMesCalendario(finDeAno)).toBe('diciembre');
    expect(obtenerMesCalendario(inicioAnoNuevo)).toBe('enero');

    expect(obtenerClaveMesCalendario(finDeAno)).toBe('2026-12');
    expect(obtenerClaveMesCalendario(inicioAnoNuevo)).toBe('2027-01');
  });

  it('el reloj falso permite avanzar tiempo correctamente', () => {
    const relojFalso = new RelojFalso('2026-12-01T10:00:00-03:00');
    establecerReloj(relojFalso);

    relojFalso.avanzarMinutos(30);
    expect(ahora().toISOString()).toBe(new Date('2026-12-01T10:30:00-03:00').toISOString());

    relojFalso.avanzarHoras(24);
    expect(ahora().toISOString()).toBe(new Date('2026-12-02T10:30:00-03:00').toISOString());

    relojFalso.avanzarDias(2);
    expect(ahora().toISOString()).toBe(new Date('2026-12-04T10:30:00-03:00').toISOString());
  });
});
