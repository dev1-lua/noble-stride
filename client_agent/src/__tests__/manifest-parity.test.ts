import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 2026-07-21 QA (deploy-drift): prod was running probe-guard + outbound-leak-guard while the
// committed manifest declared NO processors, so anyone reasoning about prod from the manifest
// mis-diagnosed the security posture. This pins manifest ↔ code parity: every processor
// registered in src/index.ts must be declared in lua.skill.yaml. Keep this list in sync with
// src/index.ts.
const REGISTERED = {
  preprocessors: ["probe-guard"],
  postprocessors: ["outbound-leak-guard", "format-normalizer"],
};

function yamlSection(yaml: string, key: string): string {
  const start = yaml.indexOf(`\n${key}:`);
  if (start === -1) return "";
  const rest = yaml.slice(start + 1 + key.length + 1);
  const end = rest.search(/\n[a-zA-Z]/); // next top-level key
  return end === -1 ? rest : rest.slice(0, end);
}

describe("lua.skill.yaml declares every processor registered in src/index.ts", () => {
  const yaml = readFileSync(join(__dirname, "..", "..", "lua.skill.yaml"), "utf8");

  it.each(REGISTERED.preprocessors)("preprocessor %s is declared", (name) => {
    expect(yamlSection(yaml, "preprocessors")).toContain(`name: ${name}`);
  });

  it.each(REGISTERED.postprocessors)("postprocessor %s is declared", (name) => {
    expect(yamlSection(yaml, "postprocessors")).toContain(`name: ${name}`);
  });

  it("src/index.ts registers exactly the processors this test pins", () => {
    const index = readFileSync(join(__dirname, "..", "index.ts"), "utf8");
    expect(index).toContain("preProcessors: [probeGuard]");
    expect(index).toContain("postProcessors: [outboundLeakGuard, formatNormalizer]");
  });
});
