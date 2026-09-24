import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * EPIC-030 — PageAccessGuard refuses family-scoped routes that carry no
 * @PageAccess (fail closed), so a new controller without one would 403 for
 * every non-Master. This spec catches that at test time instead: every
 * controller that serves a `:familyGroupId` route must declare its resource.
 */
function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith(".controller.ts") ? [full] : [];
  });
}

describe("@PageAccess coverage", () => {
  const files = controllerFiles(join(__dirname, ".."));

  it.each(
    files
      .filter((f) => readFileSync(f, "utf8").includes(":familyGroupId"))
      .map((f) => [f.slice(f.indexOf("src/")), f]),
  )("%s declares @PageAccess on the controller", (_label, file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/@PageAccess\("[a-z.-]+"\)\s*\n\s*@Controller\(/);
  });
});
