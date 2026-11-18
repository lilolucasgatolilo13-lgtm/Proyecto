import { Request, Response } from 'express';
import { UsuarioService } from '../services/usuarioService';

export class UsuarioController {
  private usuarioService: UsuarioService;

  constructor(usuarioService?: UsuarioService) {
    this.usuarioService = usuarioService || new UsuarioService();
  }

  crear = (req: Request, res: Response): void => {
    try {
      const usuario = this.usuarioService.crearCuentaCliente(req.body);
      const { contrasena_hash, ...publico } = usuario;
      res.status(201).json(publico);
    } catch (error: any) {
      const mensaje = error.message || 'Error al crear la cuenta';
      res.status(400).json({ error: mensaje });
    }
  };

  restablecerContrasena = (req: Request, res: Response): void => {
    try {
      const usuarioId = Number(req.params.id);
      const nuevaContrasena = req.body.nueva_contrasena || req.body.contrasena;

      if (!nuevaContrasena) {
        res.status(400).json({ error: 'La nueva contraseña es requerida' });
        return;
      }

      this.usuarioService.restablecerContrasena(usuarioId, nuevaContrasena);
      res.status(200).json({ ok: true, mensaje: 'Contraseña restablecida exitosamente' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al restablecer contraseña';
      res.status(400).json({ error: mensaje });
    }
  };

  banear = (req: Request, res: Response): void => {
    try {
      const usuarioId = Number(req.params.id);
      const motivo = req.body.motivo;
      const adminId = (req as any).usuario?.id;

      this.usuarioService.banear(usuarioId, motivo, adminId);
      res.status(200).json({ ok: true, mensaje: 'Usuario baneado exitosamente' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al banear usuario';
      res.status(400).json({ error: mensaje });
    }
  };

  revertirBaneo = (req: Request, res: Response): void => {
    try {
      const usuarioId = Number(req.params.id);
      const adminId = (req as any).usuario?.id;

      this.usuarioService.revertirBaneo(usuarioId, adminId);
      res.status(200).json({ ok: true, mensaje: 'Baneo revertido exitosamente' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al revertir baneo';
      res.status(400).json({ error: mensaje });
    }
  };

  informarDocumento = (req: Request, res: Response): void => {
    try {
      const usuarioId = Number(req.params.id);
      const empleadoId = (req as any).usuario?.id;

      this.usuarioService.informarDocumento(usuarioId, empleadoId);
      res.status(200).json({ ok: true, mensaje: 'Documento informado exitosamente' });
    } catch (error: any) {
      const mensaje = error.message || 'Error al informar documento';
      res.status(400).json({ error: mensaje });
    }
  };

  crearPersonal = (req: Request, res: Response): void => {
    try {
      const adminId = (req as any).usuario?.id;
      const datos = {
        rol: req.body.rol || 'empleado',
        ...req.body
      };

      const creado = this.usuarioService.crearPersonal(datos, adminId);
      res.status(201).json(creado);
    } catch (error: any) {
      const mensaje = error.message || 'Error al crear personal';
      res.status(400).json({ error: mensaje });
    }
  };
}
