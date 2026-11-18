import { Router, Request, Response } from 'express';
import { INFO_CONTACTO, INFO_POLITICAS } from '../config/horario';

const router = Router();

// HU-20, RN-02, RN-37: Sección de contacto
router.get('/contacto', (_req: Request, res: Response) => {
  res.status(200).json(INFO_CONTACTO);
});

// HU-20, RN-37: Sección de políticas
router.get('/politicas', (_req: Request, res: Response) => {
  res.status(200).json(INFO_POLITICAS);
});

export default router;
