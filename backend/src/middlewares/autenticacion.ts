import { Request, Response, NextFunction } from 'express';
import { AutenticacionService, UsuarioAutenticado } from '../services/autenticacionService';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

const authService = new AutenticacionService();

export function extraerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const xToken = req.headers['x-token'];
  if (typeof xToken === 'string') {
    return xToken.trim();
  }
  return null;
}

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const token = extraerToken(req);
  if (!token) {
    res.status(401).json({ error: 'No autorizado: token requerido' });
    return;
  }

  try {
    const usuario = authService.validarSesion(token);
    req.usuario = usuario;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Sesión inválida o expirada' });
  }
}

export function requerirRol(...rolesPermitidos: ('cliente' | 'empleado' | 'administrador')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
      return;
    }

    next();
  };
}
