import { describe, expect, it } from "vitest";
import { diaLogico, nivelDeXp, xpAgua } from "./regras";

describe("diaLogico", () => {
  it("antes das 3h ainda é o dia anterior", () => {
    expect(diaLogico(new Date(2026, 10, 12, 2, 59))).toBe("2026-11-11");
    expect(diaLogico(new Date(2026, 10, 12, 3, 0))).toBe("2026-11-12");
  });
});

describe("xpAgua", () => {
  it("dá 2 XP por copo de 250 ml", () => {
    expect(xpAgua(0, 2500)).toBe(0);
    expect(xpAgua(249, 2500)).toBe(0);
    expect(xpAgua(750, 2500)).toBe(6);
  });
  it("dá bônus ao atingir a meta e nada acima dela", () => {
    expect(xpAgua(2500, 2500)).toBe(30);
    expect(xpAgua(6000, 2500)).toBe(30);
  });
});

describe("nivelDeXp", () => {
  it("segue a tabela 300, 400, 500...", () => {
    expect(nivelDeXp(0).nivel).toBe(1);
    expect(nivelDeXp(299).nivel).toBe(1);
    expect(nivelDeXp(300)).toEqual({ nivel: 2, xpNoNivel: 0, xpParaProximo: 400 });
    expect(nivelDeXp(1800).nivel).toBe(5);
    expect(nivelDeXp(6300).nivel).toBe(10);
  });
});
