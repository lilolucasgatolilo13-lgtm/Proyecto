import { Request, Response } from 'express';
import { DescuentoService } from '../services/descuentoService';

export class DescuentoController {
  private descuentoService: DescuentoService;

  constructor(descuentoService?: DescuentoService) {
    this.descuentoService = descuentoService || new DescuentoService();
  }

  crear = (req: Request, res: Response): void => {
    try {
      const descuento = this.descuentoService.crear(req.body);
      res.status(201).json(descuento);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Error al crear descuento' });
    }
  };

  obtenerOfertas = (_req: Request, res: Response): void => {
    try {
      const ofertas = this.descuentoService.obtenerOfertas();
      res.status(200).json(ofertas);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener ofertas' });
    }
  };
}
