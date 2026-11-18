import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { SesionRepository, SesionConUsuario } from '../repositories/sesionRepository';
import { UsuarioRepository } from '../repositories/usuarioRepository';
import { ahora } from '../config/reloj';

export interface UsuarioAutenticado {
  id: number;
  rol: 'cliente' | 'empleado' | 'administrador';
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  baneado: number;
}

export class AutenticacionService {
  private sesionRepo: SesionRepository;
  private usuarioRepo: UsuarioRepository;

  constructor(sesionRepo?: SesionRepository, usuarioRepo?: UsuarioRepository) {
    this.sesionRepo = sesionRepo || new SesionRepository();
    this.usuarioRepo = usuarioRepo || new UsuarioRepository();
  }

  login(documento: string, contrasena: string): { token: string; usuario: UsuarioAutenticado } {
    if (!documento || !contrasena) {
      throw new Error('Documento y contraseña requeridos');
    }

    const usuario = this.usuarioRepo.buscarPorDocumento(documento);
    if (!usuario) {
      throw new Error('Credenciales inválidas');
    }

    const contrasenaValida = bcrypt.compareSync(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      throw new Error('Credenciales inválidas');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const fechaActual = ahora().toISOString();

    this.sesionRepo.crear(token, usuario.id, fechaActual);

    return {
      token,
      usuario: {
        id: usuario.id,
        rol: usuario.rol,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        documento: usuario.documento,
        correo: usuario.correo,
        baneado: usuario.baneado
      }
    };
  }

  logout(token: string): void {
    if (token) {
      this.sesionRepo.eliminar(token);
    }
  }

  /**
   * Valida la sesión activa y verifica timeout de inactividad (RN-46):
   * - 4 días sin uso para el cliente (4 * 24 * 60 * 60 * 1000 ms)
   * - 7 días sin uso para el empleado / administrador (7 * 24 * 60 * 60 * 1000 ms)
   */
  validarSesion(token: string): UsuarioAutenticado {
    const sesion = this.sesionRepo.buscarPorToken(token);
    if (!sesion) {
      throw new Error('Sesión no encontrada o expirada');
    }

    const ultimaActividad = new Date(sesion.ultima_actividad).getTime();
    const tiempoActual = ahora().getTime();
    const diferenciaMs = tiempoActual - ultimaActividad;

    const unDiaMs = 24 * 60 * 60 * 1000;
    const limiteInactividadMs = sesion.rol === 'cliente' ? 4 * unDiaMs : 7 * unDiaMs;

    if (diferenciaMs > limiteInactividadMs) {
      this.sesionRepo.eliminar(token);
      throw new Error('Sesión vencida por inactividad');
    }

    // Actualizar última actividad
    this.sesionRepo.actualizarActividad(token, ahora().toISOString());

    return {
      id: sesion.usuario_id,
      rol: sesion.rol,
      nombre: sesion.nombre,
      apellido: sesion.apellido,
      documento: sesion.documento,
      correo: sesion.correo,
      baneado: sesion.baneado
    };
  }
}
