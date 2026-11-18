import crypto from 'crypto';
import { ReservaRepository } from '../repositories/reservaRepository';
import { LibroRepository } from '../repositories/libroRepository';
import { UsuarioRepository } from '../repositories/usuarioRepository';
import { DeudaRepository } from '../repositories/deudaRepository';
import { DescuentoService } from './descuentoService';
import { CorreoService } from './correoService';
import { ahora } from '../config/reloj';
import { calcularEdad } from './usuarioService';

export interface RetiroResultado {
  reservaId: number;
  titulo: string;
  precioFijado: number;
  precioVigente: number;
  recargo5: number;
  total: number;
}

export interface ReservaCreada {
  id: number;
  codigo: string;
  cliente_id: number;
  libro_id: number;
  precio_fijado: number;
  fecha_reserva: string;
  fecha_vencimiento: string;
  estado: string;
}

export interface ReservaConTiempoRestante {
  id: number;
  codigo: string;
  libro_id: number;
  titulo: string;
  precio_fijado: number;
  fecha_reserva: string;
  fecha_vencimiento: string;
  segundos_restantes: number;
  vencida: boolean;
}

export class ReservaService {
  private reservaRepo: ReservaRepository;
  private libroRepo: LibroRepository;
  private usuarioRepo: UsuarioRepository;
  private deudaRepo: DeudaRepository;
  private descuentoService: DescuentoService;
  private correoService: CorreoService;

  constructor(
    reservaRepo?: ReservaRepository,
    libroRepo?: LibroRepository,
    usuarioRepo?: UsuarioRepository,
    descuentoService?: DescuentoService,
    correoService?: CorreoService,
    deudaRepo?: DeudaRepository
  ) {
    this.reservaRepo = reservaRepo || new ReservaRepository();
    this.libroRepo = libroRepo || new LibroRepository();
    this.usuarioRepo = usuarioRepo || new UsuarioRepository();
    this.deudaRepo = deudaRepo || new DeudaRepository();
    this.descuentoService = descuentoService || new DescuentoService(undefined, this.libroRepo);
    this.correoService = correoService || new CorreoService();
  }

  crearReserva(clienteId: number, libroId: number): ReservaCreada {
    const ahoraFecha = ahora();

    const libro = this.libroRepo.buscarPorId(libroId, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }
    if (libro.oculto === 1) {
      throw new Error('El libro no est\u00e1 disponible en el cat\u00e1logo');
    }

    const cliente = this.usuarioRepo.buscarPorId(clienteId);
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }
    if (cliente.baneado === 1) {
      throw new Error('La cuenta está baneada y no puede reservar');
    }
    if (this.deudaRepo.contarPendientesPorCliente(clienteId) > 0) {
      throw new Error('No puede realizar nuevas reservas mientras tenga una deuda pendiente');
    }

    const reservasActivasCliente = this.reservaRepo.contarReservasActivasPorCliente(clienteId);
    if (reservasActivasCliente >= 5) {
      throw new Error('Ya tiene 5 reservas activas. No puede hacer m\u00e1s reservas hasta retirar o cancelar alguna.');
    }

    if (this.reservaRepo.existeReservaActivaDeLibroPorCliente(clienteId, libroId)) {
      throw new Error('Ya tiene una reserva activa de este libro');
    }

    const reservasActivasLibro = this.reservaRepo.contarReservasActivasDeLibro(libroId);
    const disponibles = libro.cantidad_total - reservasActivasLibro;
    if (disponibles <= 0) {
      throw new Error('Libro agotado');
    }

    if (libro.clasificacion_edad === '+18') {
      const fechaNacimiento = cliente.fecha_nacimiento;
      const edad = calcularEdad(fechaNacimiento, ahoraFecha);
      if (edad < 18) {
        throw new Error('Solo mayores de 18 a\u00f1os pueden reservar este libro');
      }
    }

    const precioCalculo = this.descuentoService.calcularPrecioVigente({
      id: libro.id,
      serie_id: libro.serie_id,
      editorial: libro.editorial,
      precio: libro.precio
    });
    const precioFijado = precioCalculo.precio_vigente;

    const fechaReserva = ahoraFecha.toISOString();
    const fechaVencimiento = new Date(ahoraFecha.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const codigo = `RES-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const reserva = this.reservaRepo.crear({
      codigo,
      cliente_id: clienteId,
      libro_id: libroId,
      precio_fijado: precioFijado,
      fecha_reserva: fechaReserva,
      fecha_vencimiento: fechaVencimiento
    });

    const libroParaCorreo = this.libroRepo.buscarPorId(libroId)!;
    this.correoService.enviar(
      cliente.correo,
      'Reserva confirmada',
      `Hola ${cliente.nombre}, su reserva del libro "${libroParaCorreo.titulo}" ha sido confirmada.\nCódigo de reserva: ${codigo}\nVence: ${new Date(fechaVencimiento).toLocaleString('es-AR')}\nPrecio: $${precioFijado}\nRecuerde retirar y pagar en el local.`
    );

    return {
      id: reserva.id,
      codigo: reserva.codigo,
      cliente_id: reserva.cliente_id,
      libro_id: reserva.libro_id,
      precio_fijado: reserva.precio_fijado,
      fecha_reserva: reserva.fecha_reserva,
      fecha_vencimiento: reserva.fecha_vencimiento,
      estado: reserva.estado
    };
  }

  obtenerMisReservas(clienteId: number): ReservaConTiempoRestante[] {
    const ahoraFecha = ahora();
    const reservas = this.reservaRepo.obtenerReservasActivasConLibro(clienteId);

    return reservas.map((r) => {
      const fechaVenc = new Date(r.fecha_vencimiento).getTime();
      const ahoraMs = ahoraFecha.getTime();
      let segundosRestantes = Math.max(0, Math.floor((fechaVenc - ahoraMs) / 1000));
      const vencida = fechaVenc <= ahoraMs;

      return {
        id: r.id,
        codigo: r.codigo,
        libro_id: r.libro_id,
        titulo: r.titulo,
        precio_fijado: r.precio_fijado,
        fecha_reserva: r.fecha_reserva,
        fecha_vencimiento: r.fecha_vencimiento,
        segundos_restantes: segundosRestantes,
        vencida: vencida
      };
    }).filter((r) => !r.vencida);
  }

  verificarVencimiento(reservaId: number): boolean {
    const reserva = this.reservaRepo.buscarPorId(reservaId);
    if (!reserva || reserva.estado !== 'activa') {
      return false;
    }
    const fechaVenc = new Date(reserva.fecha_vencimiento).getTime();
    return ahora().getTime() > fechaVenc;
  }

  /** RN-17, HU-09: Buscar reserva activa por código (empleado) */
  buscarReservaPorCodigo(codigo: string) {
    return this.reservaRepo.buscarReservaActivaPorCodigo(codigo);
  }

  /** RN-17, HU-09: Buscar reservas activas por documento (empleado) */
  buscarReservasPorDocumento(documento: string) {
    return this.reservaRepo.buscarReservasActivasPorDocumento(documento);
  }

  /** RN-17, RN-20, RN-21, RN-22: Retirar una reserva (empleado). Calcula precio + 5%. */
  retirarReserva(reservaId: number, usuarioId: number): RetiroResultado {
    const reserva = this.reservaRepo.buscarPorId(reservaId);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }
    if (reserva.estado !== 'activa') {
      throw new Error('La reserva no está activa');
    }

    // RN-23: Verificar que no haya vencido
    if (this.verificarVencimiento(reservaId)) {
      throw new Error('La reserva ya venció y no se puede retirar');
    }

    const libro = this.libroRepo.buscarPorId(reserva.libro_id, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }

    // RN-20, RN-21: Precio al retirar = precio fijado al reservar, o precio con descuento si es más bajo
    // Los aumentos NO se aplican a reservas existentes
    const precioCalculo = this.descuentoService.calcularPrecioVigente({
      id: libro.id,
      serie_id: libro.serie_id,
      editorial: libro.editorial,
      precio: libro.precio
    });

    // Solo considerar descuentos para bajar el precio, ignorar aumentos
    const precioVigenteConDescuento = precioCalculo.tipo_ajuste === 'descuento' ? precioCalculo.precio_vigente : libro.precio;
    const precioFijado = reserva.precio_fijado;

    // Se cobra el menor entre precio fijado y precio con descuento (si bajó), nunca se cobra aumento
    const precioAPagar = precioVigenteConDescuento < precioFijado ? precioVigenteConDescuento : precioFijado;

    // RN-01: Recargo del 5% al retirar, pago en efectivo en el local
    const recargo5 = Math.round(precioAPagar * 0.05);
    const total = precioAPagar + recargo5;

    this.reservaRepo.retirar(reservaId);

    return {
      reservaId: reserva.id,
      titulo: libro.titulo,
      precioFijado,
      precioVigente: precioVigenteConDescuento,
      recargo5,
      total
    };
  }

  /** RN-19, HU-05, RN-42: Cancelar una reserva (cliente). Sin costo ni deuda. */
  cancelarReserva(reservaId: number, clienteId: number): void {
    const reserva = this.reservaRepo.buscarPorId(reservaId);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }
    if (reserva.cliente_id !== clienteId) {
      throw new Error('No pertenece a este cliente');
    }
    if (reserva.estado !== 'activa') {
      throw new Error('La reserva no está activa');
    }

    // RN-23: No se puede cancelar si ya venció
    if (this.verificarVencimiento(reservaId)) {
      throw new Error('No se puede cancelar una reserva que ya venció');
    }

    // RN-42: Límite de 5 cancelaciones por mes calendario
    if (!this.puedeCancelar(clienteId)) {
      throw new Error('Ya alcanzó el límite de 5 cancelaciones por mes. No puede cancelar más reservas.');
    }

    this.reservaRepo.cancelar(reservaId);
  }

  /** RN-42: Contar cancelaciones del mes calendario para un cliente */
  contarCancelacionesDelMes(clienteId: number): number {
    const ahoraFecha = ahora();
    const partes = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(ahoraFecha);
    const anio = partes.find((p) => p.type === 'year')?.value;
    const mes = partes.find((p) => p.type === 'month')?.value;
    const anioMes = `${anio}-${mes}`;
    return this.reservaRepo.contarCancelacionesDelMes(String(clienteId), anioMes);
  }

  /** RN-42: Verificar si puede cancelar (máximo 5 por mes) */
  puedeCancelar(clienteId: number): boolean {
    const cancelacionesMes = this.contarCancelacionesDelMes(clienteId);
    return cancelacionesMes < 5;
  }
}