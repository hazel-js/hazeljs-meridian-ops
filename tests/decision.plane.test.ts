/**
 * Decision Plane — finite model-route answers (not DecisionRuntime).
 */

import {
  decideModelRoute,
  inferRouteContext,
  MERIDIAN_MODEL_ROUTE,
} from '../src/decision/meridian-decision-plane';

describe('Meridian Decision Plane', () => {
  it('exposes the model-route definition', () => {
    expect(MERIDIAN_MODEL_ROUTE.id).toBe('meridian.model-route');
    expect(MERIDIAN_MODEL_ROUTE.answers).toContain('fast');
  });

  it('routes routine tracking to fast', async () => {
    const result = await decideModelRoute(inferRouteContext('Where is ORD-1001?'));
    expect(result.status).toBe('succeeded');
    if (result.status === 'succeeded') {
      expect(result.answer).toBe('fast');
    }
  });

  it('routes refund intent to advanced', async () => {
    const result = await decideModelRoute(inferRouteContext('I want a refund for ORD-1002'));
    expect(result.status).toBe('succeeded');
    if (result.status === 'succeeded') {
      expect(result.answer).toBe('advanced');
    }
  });

  it('abstains when context is empty', async () => {
    const result = await decideModelRoute({});
    expect(result.status).toBe('abstained');
  });
});
