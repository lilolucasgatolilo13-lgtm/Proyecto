import { DescuentoRepository, DescuentoEntidad } from '../repositories/descuentoRepository';
import { LibroRepository, LibroConDetalle } from '../repositories/libroRepository';
import { ahora } from '../config/reloj';

export interface CrearDescuentoDTO {
  alcance: 'libro' | 'serie' | 'editorial' | 'catalogo';
  referencia_id?: string | number | null;
  tipo: 'descuento' | 'aumento';
  porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export class DescuentoService {
  private descuentoRepo: DescuentoRepository;
  private libroRepo: LibroRepository;

  constructor(descuentoRepo?: DescuentoRepository, libroRepo?: LibroRepository) {
    this.descuentoRepo = descuentoRepo || new DescuentoRepository();
    this.libroRepo = libroRepo || new LibroRepository();
  }

  /**
   * RN-32, RN-43: Crear descuento o aumento del 10% al 50% con fecha de inicio y fin.
   */
  crear(datos: CrearDescuentoDTO): DescuentoEntidad {
    if (!datos.alcance || !['libro', 'serie', 'editorial', 'catalogo'].includes(datos.alcance)) {
      throw new Error('Alcance inválido. Debe ser: libro, serie, editorial o catalogo');
    }

    if (!datos.tipo || !['descuento', 'aumento'].includes(datos.tipo)) {
      throw new Error('Tipo inválido. Debe ser: descuento o aumento');
    }

    const porcentaje = Number(datos.porcentaje);
    if (isNaN(porcentaje) || porcentaje < 10 || porcentaje > 50) {
      throw new Error('El porcentaje de descuento o aumento debe estar entre el 10% y el 50%');
    }

    if (!datos.fecha_inicio || !datos.fecha_fin) {
      throw new Error('Las fechas de inicio y fin son obligatorias');
    }

    if (new Date(datos.fecha_fin).getTime() < new Date(datos.fecha_inicio).getTime()) {
      throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio');
    }

    return this.descuentoRepo.crear({
      alcance: datos.alcance,
      referencia_id: datos.referencia_id !== undefined && datos.referencia_id !== null ? String(datos.referencia_id) : null,
      tipo: datos.tipo,
      porcentaje,
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin
    });
  }

  /**
   * RN-20, RN-32: Calcula el precio vigente de un libro considerando descuentos o aumentos activos a la fecha.
   */
  calcularPrecioVigente(
    libro: { id: number; serie_id: number; editorial: string; precio: number },
    fecha: string = ahora().toISOString()
  ): { precio_vigente: number; tiene_descuento: boolean; porcentaje_descuento: number; tipo_ajuste?: 'descuento' | 'aumento' } {
    const vigentes = this.descuentoRepo.listarVigentes(fecha);

    // Buscar ajuste con precedencia: libro > serie > editorial > catalogo
    const ajuste =
      vigentes.find((d) => d.alcance === 'libro' && String(d.referencia_id) === String(libro.id)) ||
      vigentes.find((d) => d.alcance === 'serie' && String(d.referencia_id) === String(libro.serie_id)) ||
      vigentes.find((d) => d.alcance === 'editorial' && String(d.referencia_id).toLowerCase() === libro.editorial.toLowerCase()) ||
      vigentes.find((d) => d.alcance === 'catalogo');

    if (!ajuste) {
      return {
        precio_vigente: libro.precio,
        tiene_descuento: false,
        porcentaje_descuento: 0
      };
    }

    if (ajuste.tipo === 'descuento') {
      const precio_vigente = Math.round(libro.precio * (1 - ajuste.porcentaje / 100));
      return {
        precio_vigente,
        tiene_descuento: true,
        porcentaje_descuento: ajuste.porcentaje,
        tipo_ajuste: 'descuento'
      };
    } else {
      const precio_vigente = Math.round(libro.precio * (1 + ajuste.porcentaje / 100));
      return {
        precio_vigente,
        tiene_descuento: false,
        porcentaje_descuento: 0,
        tipo_ajuste: 'aumento'
      };
    }
  }

  /**
   * RN-09, HU-02: Sección de ofertas (libros con descuento vigente)
   */
  obtenerOfertas(): (LibroConDetalle & { precio_vigente: number; porcentaje_descuento: number })[] {
    const libros = this.libroRepo.listarPublicos();
    const fechaActual = ahora().toISOString();

    const ofertas: (LibroConDetalle & { precio_vigente: number; porcentaje_descuento: number })[] = [];

    for (const libro of libros) {
      const calculo = this.calcularPrecioVigente(libro, fechaActual);
      if (calculo.tiene_descuento && calculo.precio_vigente < libro.precio) {
        ofertas.push({
          ...libro,
          precio_vigente: calculo.precio_vigente,
          porcentaje_descuento: calculo.porcentaje_descuento
        });
      }
    }

    return ofertas;
  }
}
