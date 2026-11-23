import { describe, expect, it } from "vitest";
import { animacaoBase, esperaGesto, gestoEspontaneo, reacaoPara, type Catalogo } from "./animacao";

const a = { arquivo: "x.webp", quadros: 8, fps: 12, loop: true, largura: 300, altura: 320 };
const cat: Catalogo = { e1: { idle: a, piscar: { ...a, loop: false }, comemorar: { ...a, loop: false }, dormindo: a } };

describe("animação de base", () => {
  it("usa a do humor ou cai no repouso", () => {
    expect(animacaoBase(cat, 1, "feliz")).toBe("idle");
    expect(animacaoBase(cat, 1, "dormindo")).toBe("dormindo");
  });
  it("fome e sede sem animação própria ficam na pose parada (com balão)", () => {
    expect(animacaoBase(cat, 1, "fome")).toBeNull();
    expect(animacaoBase(cat, 1, "sede")).toBeNull();
  });
  it("estágio sem animações usa a pose parada", () => {
    expect(animacaoBase(cat, 2, "feliz")).toBeNull();
    expect(animacaoBase(undefined, 1, "feliz")).toBeNull();
  });
});

describe("reações e gestos", () => {
  it("treino comemora; toque sem animação de carinho não faz nada", () => {
    expect(reacaoPara(cat, 1, "treinou")).toBe("comemorar");
    expect(reacaoPara(cat, 1, "toque")).toBeNull();
  });
  it("pisca só por cima do repouso", () => {
    expect(gestoEspontaneo(cat, 1, "idle", 0.9)).toBe("piscar");
    expect(gestoEspontaneo(cat, 1, "dormindo", 0.9)).toBeNull();
  });
  it("espera entre 3 e 7 segundos", () => {
    expect(esperaGesto(0)).toBe(3000);
    expect(esperaGesto(1)).toBe(7000);
  });
});
