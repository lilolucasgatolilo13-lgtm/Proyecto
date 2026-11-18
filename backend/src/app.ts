import express from 'express';
import path from 'path';
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

app.use(express.json());

// Rutas API
app.use('/api', saludRouter);
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
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
