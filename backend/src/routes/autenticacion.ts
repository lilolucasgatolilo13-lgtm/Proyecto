import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AutenticacionController } from '../controllers/autenticacionController';

const router = Router();
const controller = new AutenticacionController();

// A-01: Límite de intentos de login — máximo 10 en 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos antes de intentar nuevamente.' }
});

router.post('/login', loginLimiter, controller.login);
router.post('/logout', controller.logout);

export default router;
