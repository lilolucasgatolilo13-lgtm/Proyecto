import { AdministracionRepository, AvisoEntidad, RegistroActividadEntidad } from '../repositories/administracionRepository';
import { ReservaRepository } from '../repositories/reservaRepository';
import { CorreoService } from './correoService';
import { ahora } from '../config/reloj';

export class AdministracionService {
  private adminRepo: AdministracionRepository;
  private reservaRepo: ReservaRepository;
  private correoService: CorreoService;

  constructor(
    adminRepo?: AdministracionRepository,
    reservaRepo?: ReservaRepository,
    correoService?: CorreoService
  ) {
    this.adminRepo = adminRepo || new AdministracionRepository();
    this.reservaRepo = reservaRepo || new ReservaRepository();
    this.correoService = correoService || new CorreoService();
  }

  /**
   * RN-33, RN-44, HU-17: Crear aviso (visible por 7 días)
   */
  crearAviso(titulo: string, texto: string, adminId: number): AvisoEntidad {
    if (!titulo || !texto) {
      throw new Error('El título y el texto del aviso son obligatorios');
    }

    const ahoraIso = ahora().toISOString();
    const aviso = this.adminRepo.crearAviso({
      titulo: titulo.trim(),
      texto: texto.trim(),
      fecha_publicacion: ahoraIso,
      administrador_id: adminId
    });

    this.adminRepo.registrarActividad(
      adminId,
      'crear_aviso',
      `Aviso creado: "${titulo}"`,
      ahoraIso
    );

    return aviso;
  }

  /**
   * RN-33, RN-44: Listar avisos activos (publicados en los últimos 7 días)
   */
  listarAvisos(): AvisoEntidad[] {
    const ahoraIso = ahora().toISOString();
    return this.adminRepo.listarAvisosActivos(ahoraIso);
  }

  /**
   * RN-38, HU-17: Cierre del local por un día.
   * Se extienden 24 horas a las reservas activas que vencían ese día,
   * se envía correo a los clientes y se publica un aviso general.
   */
  cerrarLocal(fechaStr: string, adminId: number): { reservasAfectadas: number; fecha: string } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
      throw new Error('Formato de fecha inválido. Se espera YYYY-MM-DD');
    }

    if (this.adminRepo.esDiaCerrado(fechaStr)) {
      throw new Error(`El local ya está registrado como cerrado para el día ${fechaStr}`);
    }

    this.adminRepo.registrarCierre(fechaStr, adminId);
    const ahoraIso = ahora().toISOString();

    // Obtener reservas activas y verificar cuáles vencían en esa fecha
    const activas = this.reservaRepo.obtenerTodasActivasConDetalle();
    let afectadas = 0;

    for (const r of activas) {
      // Si la fecha de vencimiento cae en el día del cierre
      if (r.fecha_vencimiento.startsWith(fechaStr)) {
        const vencimientoDate = new Date(r.fecha_vencimiento);
        // Sumar 24 horas (86.400.000 ms)
        const nuevoVencimiento = new Date(vencimientoDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
        this.reservaRepo.actualizarVencimiento(r.id, nuevoVencimiento);

        // Notificar por correo
        try {
          this.correoService.enviar(
            r.cliente_correo,
            'Plazo de reserva extendido por cierre de local',
            `El local permanecerá cerrado el ${fechaStr}. El plazo de tu reserva del libro "${r.titulo}" se ha extendido 24 horas.`
          );
        } catch {
          // Errores de envío no interrumpen el proceso
        }

        afectadas++;
      }
    }

    // Publicar aviso general del cierre
    this.adminRepo.crearAviso({
      titulo: `Local cerrado el ${fechaStr}`,
      texto: `El local permanecerá cerrado el día ${fechaStr}. Las reservas que vencían ese día han sido extendidas 24 horas.`,
      fecha_publicacion: ahoraIso,
      administrador_id: adminId
    });

    this.adminRepo.registrarActividad(
      adminId,
      'cierre_local',
      `Cierre registrado para el día ${fechaStr}. Reservas afectadas: ${afectadas}`,
      ahoraIso
    );

    return { reservasAfectadas: afectadas, fecha: fechaStr };
  }

  /**
   * RN-34, RN-38, HU-04: Enviar aviso 6 horas antes de vencer.
   */
  procesarAvisos6Horas(): number {
    const ahoraMs = ahora().getTime();
    const activas = this.reservaRepo.obtenerTodasActivasConDetalle();
    let enviados = 0;

    for (const r of activas) {
      const vencimientoMs = new Date(r.fecha_vencimiento).getTime();
      const restanteMs = vencimientoMs - ahoraMs;
      const seisHorasMs = 6 * 60 * 60 * 1000;

      // Si faltan 6 horas o menos y aún no venció
      if (restanteMs > 0 && restanteMs <= seisHorasMs) {
        // Verificar si ya se envió el aviso para este vencimiento específico
        if (r.aviso_6h_para !== r.fecha_vencimiento) {
          try {
            this.correoService.enviar(
              r.cliente_correo,
              'Tu reserva está por vencer',
              `Faltan menos de 6 horas para retirar tu reserva del libro "${r.titulo}". Código: ${r.codigo}.`
            );
          } catch {
            // Continúa
          }

          this.reservaRepo.actualizarAviso6h(r.id, r.fecha_vencimiento);
          enviados++;
        }
      }
    }

    return enviados;
  }

  /**
   * RN-35, RN-45, HU-18: Consultar registro de actividad
   */
  listarRegistroActividad(): RegistroActividadEntidad[] {
    return this.adminRepo.listarActividad();
  }

  /**
   * RN-35: Borrar registros de actividad con más de 30 días de antigüedad
   */
  limpiarRegistroActividad(): number {
    const ahoraDate = ahora();
    const limite30Dias = new Date(ahoraDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.adminRepo.purgarActividadAntigua(limite30Dias);
  }
}
