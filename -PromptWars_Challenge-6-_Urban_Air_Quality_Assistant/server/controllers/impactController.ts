import type { NextFunction, Request, Response } from 'express';
import { impactSimulationRequestSchema } from '../../shared/schemas.js';
import { simulatePledgeImpact } from '../services/impactCalculator.js';

/** Handles `POST /api/impact/simulate` computing household & community abatement impact. */
export function simulateImpactHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const parsed = impactSimulationRequestSchema.parse(req.body);
    const result = simulatePledgeImpact(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
