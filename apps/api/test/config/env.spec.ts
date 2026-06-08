import { validateEnv } from "../../src/config/env";

describe("validateEnv", () => {
  // DATABASE_URL is required; supply it wherever defaults are exercised.
  const DB_URL = "postgresql://localhost:5432/db";

  describe("defaults", () => {
    it("applies defaults when optional vars are absent", () => {
      // Arrange
      const raw = { DATABASE_URL: DB_URL };

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
      const raw = { DATABASE_URL: DB_URL, PORT: "8080" };

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
      const raw = { DATABASE_URL: "postgresql://localhost:5432/db" };

      // Act
      const env = validateEnv(raw);

      // Assert
      expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/db");
    });
  });

  describe("failure branch", () => {
    it("throws when PORT is not numeric", () => {
      // Arrange
      const raw = { DATABASE_URL: DB_URL, PORT: "not-a-port" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/Invalid environment variables/);
    });

    it("throws when WEB_ORIGIN is not a valid URL", () => {
      // Arrange
      const raw = { DATABASE_URL: DB_URL, WEB_ORIGIN: "not-a-url" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/WEB_ORIGIN/);
    });

    it("throws when NODE_ENV is outside the allowed enum", () => {
      // Arrange
      const raw = { DATABASE_URL: DB_URL, NODE_ENV: "staging" };

      // Act + Assert
      expect(() => validateEnv(raw)).toThrow(/Invalid environment variables/);
    });
  });
});
