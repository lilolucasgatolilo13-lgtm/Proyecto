import { LibroRepository, LibroConDetalle, FiltrosLibro } from '../repositories/libroRepository';
import { DescuentoService } from './descuentoService';
import { ahora } from '../config/reloj';

export interface LibroConPrecioVigente extends LibroConDetalle {
  precio_vigente: number;
}

export class LibroService {
  private libroRepo: LibroRepository;
  private descuentoService: DescuentoService;

  constructor(libroRepo?: LibroRepository, descuentoService?: DescuentoService) {
    this.libroRepo = libroRepo || new LibroRepository();
    this.descuentoService = descuentoService || new DescuentoService(undefined, this.libroRepo);
  }

  obtenerCatalogo(filtros?: FiltrosLibro): LibroConPrecioVigente[] {
    const libros = this.libroRepo.listarPublicos(filtros);
    return libros.map((l) => {
      const { precio_vigente } = this.descuentoService.calcularPrecioVigente(l);
      return { ...l, precio_vigente };
    });
  }

  obtenerPorId(id: number): LibroConPrecioVigente {
    const libro = this.libroRepo.buscarPorId(id);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }
    const { precio_vigente } = this.descuentoService.calcularPrecioVigente(libro);
    return { ...libro, precio_vigente };
  }

  /**
   * RN-41, HU-02: Libros con fecha de ingreso de los últimos 2 días corridos (48 horas)
   */
  obtenerNovedades(): LibroConDetalle[] {
    const dosDiasMs = 2 * 24 * 60 * 60 * 1000;
    const fechaLimite = new Date(ahora().getTime() - dosDiasMs).toISOString();
    return this.libroRepo.obtenerNovedades(fechaLimite);
  }

  /**
   * RN-09, HU-02: Obtener serie con todos sus tomos en orden
   */
  obtenerSerie(serieId: number): { id: number; nombre: string; libros: LibroConDetalle[] } {
    const serie = this.libroRepo.obtenerSeriePorId(serieId);
    if (!serie) {
      throw new Error('Serie no encontrada');
    }
    return serie;
  }

  listarSeries(): { id: number; nombre: string }[] {
    return this.libroRepo.listarSeries();
  }

  /**
   * RN-08, RN-41, HU-14: El administrador carga un libro con serie existente o nueva
   */
  crearLibro(datos: {
    titulo: string;
    serie_id?: number;
    serie_nueva?: string;
    serie?: string | number;
    numero_tomo?: number;
    autor?: string;
    editorial?: string;
    idioma?: string;
    genero?: string;
    clasificacion_edad?: string;
    portada_url?: string;
    sinopsis?: string;
    precio: number;
    cantidad_total?: number;
  }): LibroConDetalle {
    if (!datos.titulo || datos.titulo.trim().length === 0) {
      throw new Error('El título del libro es obligatorio');
    }

    if (datos.precio === undefined || datos.precio === null || isNaN(datos.precio) || datos.precio <= 0) {
      throw new Error('El precio del libro es obligatorio y debe ser mayor a 0');
    }

    // M-05: Validar protocolo de portada_url para evitar URLs tipo javascript:
    if (datos.portada_url && datos.portada_url.trim().length > 0 && !/^https?:\/\//i.test(datos.portada_url.trim())) {
      throw new Error('La URL de portada debe comenzar con http:// o https://');
    }

    // Resolución de serie (soporta serie_id, serie_nueva o serie por nombre/ID)
    let serieId = datos.serie_id;

    const nombreSerie = (typeof datos.serie_nueva === 'string' && datos.serie_nueva.trim().length > 0)
      ? datos.serie_nueva.trim()
      : (typeof datos.serie === 'string' && datos.serie.trim().length > 0)
        ? datos.serie.trim()
        : undefined;

    if (!serieId && nombreSerie) {
      const existente = this.libroRepo.obtenerSeriePorNombre(nombreSerie);
      if (existente) {
        serieId = existente.id;
      } else {
        const nueva = this.libroRepo.crearSerie(nombreSerie);
        serieId = nueva.id;
      }
    }

    if (!serieId) {
      throw new Error('Debe especificar una serie existente o el nombre de una serie nueva');
    }

    const fechaIngreso = ahora().toISOString();

    return this.libroRepo.crearLibro({
      titulo: datos.titulo.trim(),
      serie_id: serieId,
      numero_tomo: datos.numero_tomo || 1,
      autor: datos.autor?.trim() || 'Autor Desconocido',
      editorial: datos.editorial?.trim() || 'Editorial',
      idioma: datos.idioma?.trim() || 'Español',
      genero: datos.genero?.trim() || 'General',
      clasificacion_edad: datos.clasificacion_edad?.trim() || 'ATP',
      portada_url: datos.portada_url?.trim() || '',
      sinopsis: datos.sinopsis?.trim() || '',
      precio: Number(datos.precio),
      cantidad_total: datos.cantidad_total !== undefined ? Number(datos.cantidad_total) : 0,
      fecha_ingreso: fechaIngreso
    });
  }

  /**
   * RN-13, RN-41, HU-12: El empleado o administrador actualizan la cantidad de copias.
   * No permite bajar por debajo de las reservas activas y no modifica fecha_ingreso.
   */
  actualizarCantidad(id: number, nuevaCantidad: number): LibroConDetalle {
    if (nuevaCantidad === undefined || isNaN(nuevaCantidad) || nuevaCantidad < 0) {
      throw new Error('La cantidad debe ser un número entero no negativo');
    }

    const libro = this.libroRepo.buscarPorId(id, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }

    const reservasActivas = this.libroRepo.contarReservasActivas(id);
    if (nuevaCantidad < reservasActivas) {
      throw new Error(`No se puede reducir la cantidad a ${nuevaCantidad} porque hay ${reservasActivas} reserva(s) activa(s)`);
    }

    // Actualiza solo cantidad_total sin tocar fecha_ingreso (RN-41)
    this.libroRepo.actualizarLibro(id, { cantidad_total: nuevaCantidad });
    return this.libroRepo.buscarPorId(id, true)!;
  }
  actualizarLibro(id: number, cambios: any, usuarioId?: number): LibroConDetalle {
    const libro = this.libroRepo.buscarPorId(id, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }

    if (cambios.precio !== undefined && (isNaN(cambios.precio) || cambios.precio <= 0)) {
      throw new Error('El precio debe ser un número válido mayor a 0');
    }

    // M-05: Validar protocolo de portada_url si se está actualizando
    if (cambios.portada_url && cambios.portada_url.trim().length > 0 && !/^https?:\/\//i.test(cambios.portada_url.trim())) {
      throw new Error('La URL de portada debe comenzar con http:// o https://');
    }

    this.libroRepo.actualizarLibro(id, cambios);

    if (cambios.precio !== undefined) {
      const ahoraIso = ahora().toISOString();
      try {
        // A-04: Uso del metodo tipado registrarActividad en lugar de (repo as any).getDb()
        this.libroRepo.registrarActividad(
          usuarioId ?? null,
          'cambio_precio',
          `Cambio de precio de "${libro.titulo}" de $${libro.precio} a $${cambios.precio}`,
          ahoraIso
        );
      } catch {
        // Silencioso si falla
      }
    }

    return this.libroRepo.buscarPorId(id, true)!;
  }

  /**
   * RN-12, HU-14: Ocultar o desocultar un libro del catálogo
   */
  ocultarLibro(id: number, ocultar: boolean = true): void {
    const libro = this.libroRepo.buscarPorId(id, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }
    this.libroRepo.ocultarLibro(id, ocultar);
  }

  /**
   * RN-12, HU-14: Eliminar libro (prohibido si tiene reservas o historial)
   */
  eliminarLibro(id: number): void {
    const libro = this.libroRepo.buscarPorId(id, true);
    if (!libro) {
      throw new Error('Libro no encontrado');
    }

    const reservas = this.libroRepo.contarReservas(id);
    if (reservas > 0) {
      throw new Error('No se puede borrar un libro que tenga reservas o historial, solo ocultarlo');
    }

    this.libroRepo.eliminarLibro(id);
  }
}
