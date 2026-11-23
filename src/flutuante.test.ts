import { describe, expect, it } from "vitest";
import { ehAndroid, linkBolinha } from "./flutuante";

describe("bolinha do celular", () => {
  const link = linkBolinha("https://x.io/game-life/", { estagio: 1, humor: "animada", refeicoesHoje: ["manha", "almoco"], dia: "2026-11-23" });
  it("abre o app do celular com as poses certas", () => {
    expect(link).toMatch(/^intent:\/\/brasa\?/);
    expect(link).toContain("package=br.gleite.glicose");
    expect(link).toContain("p=e1-animada");
    expect(link).toContain("pf=e1-com-fome");
    expect(link).toContain("pd=e1-dormindo");
    expect(link).toContain("r=manha%2Calmoco");
    expect(link).toContain("d=2026-11-23");
  });
  it("sem o app, volta ao Game Life avisando", () => {
    expect(link).toContain(encodeURIComponent("https://x.io/game-life/#bolinha=sem-app"));
  });
  it("reconhece Android", () => {
    expect(ehAndroid("Mozilla/5.0 (Linux; Android 15; SM-S931B)")).toBe(true);
    expect(ehAndroid("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});
