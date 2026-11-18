import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Los tests viven junto a su archivo de producción: src/**/*.test.ts
    include: ['src/**/*.test.ts'],
  },
});
