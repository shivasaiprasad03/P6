import type { NextFunction, Request, Response } from 'express';
import { simulateImpact } from '../../shared/impact.js';
import { impactSimulationRequestSchema } from '../../shared/schemas.js';

/** `POST /api/impact/simulate`: household and community impact of a set of actions. */
export function simulateImpactHandler(req: Request, res: Response, next: NextFunction): void {
  try {
    res.json(simulateImpact(impactSimulationRequestSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}
