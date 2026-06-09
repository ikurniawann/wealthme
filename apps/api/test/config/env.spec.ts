import { validateEnv } from "../../src/config/env";

describe("validateEnv", () => {
  // Minimum required vars for a valid env.
  const DB_URL = "postgresql://localhost:5432/db";
  const BASE = {
    DATABASE_URL: DB_URL,
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "test-secret-that-is-at-least-32-chars-long!!",
    JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-chars-long!",
  };

  describe("defaults", () => {
    it("applies defaults when optional vars are absent", () => {
      // Arrange
      const raw = { ...BASE };

      // Act
      const env = validateEnv(raw);

      // Assert
      expect(env.NODE_ENV).toBe("development");
      expect(env.PORT).toBe(4000);
      expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    });
  });

  describe("coercion", () => {
    it("coerces a numeric PORT string into a number", () => {
      // Arrange
      const raw = { ...BASE, PORT: "8080" };

      // Act
      const env = validateEnv(raw);

      // Assert
      expect(env.PORT).toBe(8080);
    });
  });

  describe("DATABASE_URL", () => {
    it("throws when DATABASE_URL is absent", () => {
      // Arrange
      const raw = {};

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/DATABASE_URL/);
    });

    it("throws when DATABASE_URL is not a valid URL", () => {
      // Arrange
      const raw = { DATABASE_URL: "not-a-url" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/DATABASE_URL/);
    });
  });

  describe("optional passthrough", () => {
    it("preserves provided optional vars", () => {
      // Arrange
      const raw = { ...BASE };

      // Act
      const env = validateEnv(raw);

      // Assert
      expect(env.DATABASE_URL).toBe(DB_URL);
    });
  });

  describe("failure branch", () => {
    it("throws when PORT is not numeric", () => {
      // Arrange
      const raw = { ...BASE, PORT: "not-a-port" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/Invalid environment variables/);
    });

    it("throws when WEB_ORIGIN is not a valid URL", () => {
      // Arrange
      const raw = { ...BASE, WEB_ORIGIN: "not-a-url" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/WEB_ORIGIN/);
    });

    it("throws when NODE_ENV is outside the allowed enum", () => {
      // Arrange
      const raw = { ...BASE, NODE_ENV: "staging" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/Invalid environment variables/);
    });
  });
});
