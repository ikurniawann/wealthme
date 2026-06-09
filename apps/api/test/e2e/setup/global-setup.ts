import { execSync } from "child_process";
import * as path from "path";

import * as dotenv from "dotenv";

export default async function globalSetup(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env.test"),
    override: true,
  });

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set in .env.test — cannot run e2e tests");
  }

  execSync("pnpm prisma migrate deploy", {
    cwd: path.resolve(__dirname, "../../.."),
    env: { ...process.env },
    stdio: "inherit",
  });
}
