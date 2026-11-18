import { describe, it, expect } from 'vitest';
import inject from 'light-my-request';
import app from '../app';

describe('GET /api/salud', () => {
  it('responde 200 con { ok: true }', async () => {
    const res = await inject(app, { method: 'GET', url: '/api/salud' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ ok: true });
  });
});
