import { describe, it, expect } from 'vitest';
import inject from 'light-my-request';
import app from '../app';
import { localAbierto } from '../config/horario';

describe('T-13: Horario, contacto y políticas (RN-02, RN-37, HU-20)', () => {
  it('GET /api/contacto devuelve dirección, horario, teléfono y correo (RN-02, RN-37, HU-20)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/contacto'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.direccion).toBeDefined();
    expect(body.horario).toBeDefined();
    expect(body.telefono).toBeDefined();
    expect(body.correo).toBeDefined();
    expect(body.horario).toContain('10:00 a 13:00');
    expect(body.horario).toContain('15:00 a 20:00');
  });

  it('localAbierto: lunes 10:30 es abierto, lunes 13:30 es cerrado, domingo 12:00 es abierto, domingo 18:30 es cerrado (RN-02)', () => {
    // 2026-11-30 es lunes
    const lunes1030 = '2026-11-30T10:30:00-03:00';
    const lunes1330 = '2026-11-30T13:30:00-03:00';

    // 2026-11-29 es domingo
    const domingo1200 = '2026-11-29T12:00:00-03:00';
    const domingo1830 = '2026-11-29T18:30:00-03:00';

    expect(localAbierto(lunes1030)).toBe(true);
    expect(localAbierto(lunes1330)).toBe(false);
    expect(localAbierto(domingo1200)).toBe(true);
    expect(localAbierto(domingo1830)).toBe(false);
  });

  it('GET /api/politicas incluye el plazo de 24 horas, el 5% extra y las deudas (RN-37, HU-20)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/politicas'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.plazo_reserva).toContain('24 horas');
    expect(body.recargo_reserva).toContain('5%');
    expect(body.deudas).toContain('5%');
  });
});
