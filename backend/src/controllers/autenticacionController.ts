import { Request, Response } from 'express';
import { AutenticacionService } from '../services/autenticacionService';
import { extraerToken } from '../middlewares/autenticacion';

export class AutenticacionController {
  private authService: AutenticacionService;

  constructor(authService?: AutenticacionService) {
    this.authService = authService || new AutenticacionService();
  }

  login = (req: Request, res: Response): void => {
    try {
      const { documento, contrasena } = req.body;
      const resultado = this.authService.login(documento, contrasena);
      res.status(200).json(resultado);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Credenciales inválidas' });
    }
  };

  logout = (req: Request, res: Response): void => {
    try {
      const token = extraerToken(req);
      if (token) {
        this.authService.logout(token);
      }
      res.status(200).json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al cerrar sesión' });
    }
  };
}
