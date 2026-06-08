import { Test, type TestingModule } from "@nestjs/testing";

import { HealthController } from "../src/health/health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe("check", () => {
    it("returns status ok", () => {
      // Arrange — controller is set up in beforeEach

      // Act
      const result = controller.check();

      // Assert
      expect(result.status).toBe("ok");
    });

    it("returns a valid ISO timestamp", () => {
      // Act
      const result = controller.check();

      // Assert
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("returns a non-negative uptime", () => {
      // Act
      const result = controller.check();

      // Assert
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
