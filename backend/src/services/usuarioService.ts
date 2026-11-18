import bcrypt from 'bcrypt';
import { UsuarioRepository, Usuario } from '../repositories/usuarioRepository';
import { ReservaRepository } from '../repositories/reservaRepository';
import { DeudaRepository } from '../repositories/deudaRepository';
import { ahora } from '../config/reloj';

export interface CrearCuentaClienteDTO {
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  telefono: string;
  contrasena: string;
  fecha_nacimiento: string;
  adulto_responsable?: boolean;
}

export interface CrearPersonalDTO {
  rol: 'empleado' | 'administrador';
  nombre: string;
  apellido: string;
  documento: string;
  correo: string;
  telefono: string;
  contrasena: string;
  fecha_nacimiento: string;
}

export function calcularEdad(fechaNacimientoStr: string, fechaReferencia: Date = ahora()): number {
  const partes = fechaNacimientoStr.split('T')[0].split('-').map(Number);
  const anioNac = partes[0];
  const mesNac = partes[1];
  const diaNac = partes[2];

  const anioRef = fechaReferencia.getFullYear();
  const mesRef = fechaReferencia.getMonth() + 1;
  const diaRef = fechaReferencia.getDate();

  let edad = anioRef - anioNac;
  if (mesRef < mesNac || (mesRef === mesNac && diaRef < diaNac)) {
    edad--;
  }
  return edad;
}

export class UsuarioService {
  private usuarioRepo: UsuarioRepository;
  private reservaRepo: ReservaRepository;
  private deudaRepo: DeudaRepository;

  constructor(
    usuarioRepo?: UsuarioRepository,
    reservaRepo?: ReservaRepository,
    deudaRepo?: DeudaRepository
  ) {
    this.usuarioRepo = usuarioRepo || new UsuarioRepository();
    this.reservaRepo = reservaRepo || new ReservaRepository();
    this.deudaRepo = deudaRepo || new DeudaRepository();
  }

  crearCuentaCliente(datos: CrearCuentaClienteDTO): Omit<Usuario, 'contrasena_hash'> & { contrasena_hash?: string } {
    if (!datos.nombre || !datos.apellido || !datos.documento || !datos.correo || !datos.telefono || !datos.contrasena || !datos.fecha_nacimiento) {
      throw new Error('Todos los campos son obligatorios');
    }

    // M-04: Validación de formato de correo
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
      throw new Error('El correo electrónico no tiene un formato válido');
    }

    // M-04: Validación de fecha de nacimiento
    if (isNaN(Date.parse(datos.fecha_nacimiento))) {
      throw new Error('La fecha de nacimiento no es válida');
    }

    // RN-05: Unicidad de documento y correo
    if (this.usuarioRepo.buscarPorDocumento(datos.documento)) {
      throw new Error('Ya existe una cuenta con ese documento');
    }
    if (this.usuarioRepo.buscarPorCorreo(datos.correo)) {
      throw new Error('Ya existe una cuenta con ese correo');
    }

    // RN-06: Validación de edad
    const edad = calcularEdad(datos.fecha_nacimiento, ahora());
    if (edad < 15) {
      throw new Error('La edad mínima para tener cuenta es 15 años');
    }

    if (edad >= 15 && edad < 18 && !datos.adulto_responsable) {
      throw new Error('Los clientes de 15 a 17 años necesitan ir con un adulto responsable al crear la cuenta');
    }

    // RN-36: Cifrado de contraseña
    const saltRounds = 10;
    const contrasena_hash = bcrypt.hashSync(datos.contrasena, saltRounds);

    const usuarioCreado = this.usuarioRepo.crear({
      rol: 'cliente',
      nombre: datos.nombre,
      apellido: datos.apellido,
      documento: datos.documento,
      correo: datos.correo,
      telefono: datos.telefono,
      contrasena_hash,
      fecha_nacimiento: datos.fecha_nacimiento.split('T')[0],
      baneado: 0
    });

    return usuarioCreado;
  }

  /**
   * RN-40, HU-08, HU-18: El administrador crea empleados y administradores con topes.
   */
  crearPersonal(datos: CrearPersonalDTO, adminId: number): Omit<Usuario, 'contrasena_hash'> {
    if (!datos.nombre || !datos.apellido || !datos.documento || !datos.correo || !datos.telefono || !datos.contrasena || !datos.fecha_nacimiento) {
      throw new Error('Todos los campos son obligatorios');
    }

    if (datos.rol !== 'empleado' && datos.rol !== 'administrador') {
      throw new Error('Rol inválido');
    }

    // M-04: Validación de formato de correo
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
      throw new Error('El correo electrónico no tiene un formato válido');
    }

    // RN-40: Máximo 10 empleados y 4 administradores
    if (datos.rol === 'empleado') {
      const cantidadEmpleados = this.usuarioRepo.contarPorRol('empleado');
      if (cantidadEmpleados >= 10) {
        throw new Error('Se alcanzó el límite máximo de 10 empleados');
      }
    } else if (datos.rol === 'administrador') {
      const cantidadAdmins = this.usuarioRepo.contarPorRol('administrador');
      if (cantidadAdmins >= 4) {
        throw new Error('Se alcanzó el límite máximo de 4 administradores');
      }
    }

    if (this.usuarioRepo.buscarPorDocumento(datos.documento)) {
      throw new Error('Ya existe una cuenta con ese documento');
    }
    if (this.usuarioRepo.buscarPorCorreo(datos.correo)) {
      throw new Error('Ya existe una cuenta con ese correo');
    }

    const saltRounds = 10;
    const contrasena_hash = bcrypt.hashSync(datos.contrasena, saltRounds);

    const usuarioCreado = this.usuarioRepo.crear({
      rol: datos.rol,
      nombre: datos.nombre,
      apellido: datos.apellido,
      documento: datos.documento,
      correo: datos.correo,
      telefono: datos.telefono,
      contrasena_hash,
      fecha_nacimiento: datos.fecha_nacimiento.split('T')[0],
      baneado: 0
    });

    const ahoraIso = ahora().toISOString();
    // A-04: Uso del metodo tipado registrarActividad en lugar de (repo as any).getDb()
    this.usuarioRepo.registrarActividad(
      adminId,
      'crear_personal',
      `Creación de ${datos.rol} "${datos.nombre} ${datos.apellido}"`,
      ahoraIso
    );

    return usuarioCreado;
  }

  /**
   * RN-07, HU-07: El empleado restablece la contraseña del cliente en el local.
   */
  restablecerContrasena(usuarioId: number, nuevaContrasena: string): void {
    if (!nuevaContrasena || nuevaContrasena.trim().length === 0) {
      throw new Error('La nueva contraseña es requerida');
    }

    const usuario = this.usuarioRepo.buscarPorId(usuarioId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    const contrasena_hash = bcrypt.hashSync(nuevaContrasena, 10);
    this.usuarioRepo.actualizarContrasena(usuarioId, contrasena_hash);
  }

  /**
   * RN-39, HU-13: Baneo de cuenta por el administrador.
   * Cancela todas las reservas activas sin generar deuda y libera las copias.
   */
  banear(usuarioId: number, motivo: string, adminId: number): void {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo del baneo es obligatorio');
    }

    const usuario = this.usuarioRepo.buscarPorId(usuarioId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    this.usuarioRepo.actualizarBaneo(usuarioId, 1);
    this.reservaRepo.cancelarTodasDeCliente(usuarioId);

    const ahoraIso = ahora().toISOString();
    this.deudaRepo.registrarHistorial({
      usuario_id: usuarioId,
      tipo: 'baneo',
      motivo: motivo.trim(),
      fecha: ahoraIso,
      administrador_id: adminId
    });

    // A-04: Uso del metodo tipado registrarActividad en lugar de (repo as any).getDb()
    this.usuarioRepo.registrarActividad(
      adminId,
      'baneo_usuario',
      `Baneo de usuario #${usuarioId} (${usuario.nombre} ${usuario.apellido}). Motivo: ${motivo.trim()}`,
      ahoraIso
    );
  }

  /**
   * RN-39, HU-13: Revertir baneo por el administrador.
   */
  revertirBaneo(usuarioId: number, adminId: number): void {
    const usuario = this.usuarioRepo.buscarPorId(usuarioId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    this.usuarioRepo.actualizarBaneo(usuarioId, 0);

    const ahoraIso = ahora().toISOString();
    this.deudaRepo.registrarHistorial({
      usuario_id: usuarioId,
      tipo: 'reversion_baneo',
      motivo: 'Reversión de baneo',
      fecha: ahoraIso,
      administrador_id: adminId
    });

    // A-04: Uso del metodo tipado registrarActividad en lugar de (repo as any).getDb()
    this.usuarioRepo.registrarActividad(
      adminId,
      'reversion_baneo',
      `Reversión de baneo de usuario #${usuarioId}`,
      ahoraIso
    );
  }

  /**
   * RN-39, HU-19: Empleado informa documento ajeno.
   */
  informarDocumento(usuarioId: number, empleadoId: number): void {
    const usuario = this.usuarioRepo.buscarPorId(usuarioId);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    const ahoraIso = ahora().toISOString();
    // A-04: Uso del metodo tipado registrarActividad en lugar de (repo as any).getDb()
    this.usuarioRepo.registrarActividad(
      empleadoId,
      'informe_documento',
      `Informe de documento ajeno presentado para usuario #${usuarioId} (${usuario.documento})`,
      ahoraIso
    );
  }
}
