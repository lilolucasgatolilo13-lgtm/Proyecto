import { Router, Request, Response } from 'express';

const router = Router();

router.get('/salud', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

export default router;
