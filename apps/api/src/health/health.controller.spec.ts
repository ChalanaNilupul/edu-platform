import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return the API health status', () => {
    const result = controller.check();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'EduPlatform API',
    });

    expect(typeof result.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
