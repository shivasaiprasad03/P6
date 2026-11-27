import type { NextFunction, Request, Response } from 'express';
import { actionPlanRequestSchema, chatRequestSchema } from '../../shared/schemas.js';
import {
  answerAirQualityQuestion,
  generatePersonalizedActionPlan,
} from '../services/aiAdvisorService.js';
import { getAirQualityReport } from '../services/airQualityService.js';

/** Handles `POST /api/advisor/plan` generating a tailored daily air quality action plan. */
export async function generatePlanHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = actionPlanRequestSchema.parse(req.body);
    const report = await getAirQualityReport(parsed.location);
    const plan = await generatePersonalizedActionPlan({
      report,
      profile: parsed.profile,
      focusNote: parsed.focusNote,
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

/** Handles `POST /api/advisor/chat` answering context-grounded urban smog questions. */
export async function advisorChatHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = chatRequestSchema.parse(req.body);
    const report = await getAirQualityReport(parsed.location);
    const response = await answerAirQualityQuestion({
      report,
      profile: parsed.profile,
      message: parsed.message,
      history: parsed.history,
    });
    res.json(response);
  } catch (err) {
    next(err);
  }
}
