import { describe, expect, it } from "vitest";
import { estagioDe, falaDe, humorDe, janelaAberta, poseDe, proximaJanela, FALAS, type EntradaBrasa } from "./brasa";

const as = (h: number, m = 0) => new Date(2026, 10, 23, h, m);
const base = (mud: Partial<EntradaBrasa> = {}): EntradaBrasa => ({
  agora: as(16),
  treinouHoje: false,
  diasSemTreino: 1,
  pausaHoje: false,
  aguaMl: 1500,
  metaAguaMl: 2500,
  refeicoesHoje: ["manha", "almoco"],
  ...mud,
});

describe("janelas de refeição", () => {
  it("abre de manhã, no almoço e à noite (treino das 18h)", () => {
    expect(janelaAberta(as(6))).toBe("manha");
    expect(janelaAberta(as(12))).toBe("almoco");
    expect(janelaAberta(as(18))).toBe("noite");
    expect(janelaAberta(as(16))).toBeNull();
    expect(janelaAberta(as(23))).toBeNull();
  });
  it("diz qual é a próxima", () => {
    expect(proximaJanela(as(16))).toBe("noite");
    expect(proximaJanela(as(22))).toBeNull();
  });
});

describe("crescimento", () => {
  it("começa pequena e nunca depende de outra coisa além dos dias de treino", () => {
    expect(estagioDe(0).n).toBe(1);
    expect(estagioDe(20).proximo?.faltam).toBe(1);
    expect(estagioDe(21).n).toBe(2);
    expect(estagioDe(60).n).toBe(3);
    expect(estagioDe(200).proximo).toBeNull();
  });
});

describe("humor", () => {
  it("pausa legítima vem primeiro: cobertor, sem cobrança", () => {
    expect(humorDe(base({ pausaHoje: true, agora: as(12), refeicoesHoje: [] }))).toBe("doente");
  });
  it("de madrugada ela dorme", () => {
    expect(humorDe(base({ agora: as(1) }))).toBe("dormindo");
  });
  it("com a janela aberta e sem comer, tem fome; depois de comer, fica satisfeita", () => {
    expect(humorDe(base({ agora: as(18), refeicoesHoje: ["manha"] }))).toBe("fome");
    expect(humorDe(base({ agora: as(18, 10), refeicoesHoje: ["manha", "noite"], ultimaRefeicaoEm: as(18).toISOString() }))).toBe("satisfeita");
  });
  it("treinou hoje: animada", () => {
    expect(humorDe(base({ treinouHoje: true, diasSemTreino: 0 }))).toBe("animada");
  });
  it("pouca água à tarde: sede (lembrete, não castigo)", () => {
    expect(humorDe(base({ aguaMl: 500 }))).toBe("sede");
  });
  it("noite curta: cansada só até o meio da tarde", () => {
    expect(humorDe(base({ sonoHoras: 5, agora: as(14), refeicoesHoje: ["manha", "almoco"], aguaMl: 2000 }))).toBe("cansada");
    expect(humorDe(base({ sonoHoras: 5, agora: as(16), aguaMl: 2000 }))).toBe("feliz");
  });
  it("vários dias sem treino: fraca (física, não triste)", () => {
    expect(humorDe(base({ diasSemTreino: 4, aguaMl: 2000 }))).toBe("fraca");
  });
  it("noite boa: com energia", () => {
    expect(humorDe(base({ sonoHoras: 8, aguaMl: 2000 }))).toBe("energia");
  });
});

describe("poses e falas", () => {
  it("todo humor tem imagem em todo estágio, com balão onde falta desenho", () => {
    expect(poseDe(1, "fome")).toEqual({ arquivo: "e1-com-fome", balao: undefined });
    expect(poseDe(3, "sede").balao).toBe("💧");
  });
  it("a fala é estável para a mesma semente e vem da lista", () => {
    const a = falaDe("feliz", "2026-11-23-0");
    expect(falaDe("feliz", "2026-11-23-0")).toBe(a);
    expect(FALAS.feliz).toContain(a);
  });
  it("nenhuma fala cobra ou culpa", () => {
    const todas = Object.values(FALAS).flat().join(" ").toLowerCase();
    for (const proibida of ["preguiç", "fracass", "me abandon", "decepcion"]) expect(todas).not.toContain(proibida);
  });
});
