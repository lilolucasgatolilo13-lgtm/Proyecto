import express from 'express';
import path from 'path';
import helmet from 'helmet';
import morgan from 'morgan';
import saludRouter from './routes/salud';
import usuariosRouter from './routes/usuarios';
import authRouter from './routes/autenticacion';
import descuentosRouter from './routes/descuentos';
import librosRouter from './routes/libros';
import contactoPoliticasRouter from './routes/contactoPoliticas';
import reservasRouter from './routes/reservas';
import deudasRouter from './routes/deudas';
import administracionRouter from './routes/administracion';

const app = express();

// A-02: Headers de seguridad HTTP
app.use(helmet({
  contentSecurityPolicy: false // lo gestionamos manualmente si hace falta, desactivar evita romper el frontend
}));

// B-03: Logs de acceso HTTP
app.use(morgan('combined'));

// A-03: Límite de tamaño del body JSON (evita DoS por body gigante)
app.use(express.json({ limit: '50kb' }));

// Rutas API
app.use('/api', saludRouter);
app.use('/api/auth', authRouter);
// M-03: Eliminada ruta duplicada /auth (sin /api) que permitía bypassear rate limiters
app.use('/api', usuariosRouter);
app.use('/api', descuentosRouter);
app.use('/api', librosRouter);
app.use('/api', contactoPoliticasRouter);
app.use('/api', reservasRouter);
app.use('/api', deudasRouter);
app.use('/api', administracionRouter);
app.use('/', contactoPoliticasRouter); // disponible en /contacto y /politicas directamente

// Servir frontend estático desde la misma origen (evita CORS)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Fallback: rutas no-API sirven el index.html del frontend (SPA)
app.use((_req, res) => {
  if (_req.url?.startsWith('/api')) {
    res.status(404).json({ error: 'Ruta no encontrada' });
    return;
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

export default app;
