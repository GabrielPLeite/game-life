import { describe, expect, it } from "vitest";
import { chefeDaSemana, conquistas, missoesDaSemana, planoEsteira, xpDaSemana, type DiaResumido } from "./jogo";
import { compararGrupos, estatisticasGlicose, paraCsv } from "./analises";
import { somarDias } from "./regras";

const dia = (i: number, extra: Partial<DiaResumido> = {}): DiaResumido => ({
  dia: somarDias("2026-11-09", i),
  garantido: false,
  treinos: 0,
  metaAgua: false,
  caminhadas: 0,
  glicoses: 0,
  sono: false,
  sequencia: 0,
  ...extra,
});
const semanaBoa = [0, 1, 2, 3, 4, 5, 6].map((i) => dia(i, { garantido: true, treinos: 1, metaAgua: true, caminhadas: 1, glicoses: 2, sono: true }));

describe("missões", () => {
  it("semana boa completa todas", () => {
    expect(missoesDaSemana(semanaBoa).every((m) => m.concluida)).toBe(true);
  });
  it("progresso nunca passa da meta", () => {
    expect(missoesDaSemana(semanaBoa).find((m) => m.id === "caminhadas")?.progresso).toBe(3);
  });
});

describe("chefe", () => {
  it("cai numa semana boa e dá XP", () => {
    expect(chefeDaSemana("2026-11-09", semanaBoa).derrotado).toBe(true);
    expect(xpDaSemana("2026-11-09", semanaBoa)).toBe(5 * 50 + 150);
  });
  it("não cai com 2 dias bons", () => {
    expect(chefeDaSemana("2026-11-09", semanaBoa.slice(0, 2)).derrotado).toBe(false);
  });
  it("mesmo nome para a mesma semana", () => {
    expect(chefeDaSemana("2026-11-09", []).nome).toBe(chefeDaSemana("2026-11-09", semanaBoa).nome);
  });
});

describe("conquistas", () => {
  it("marca as obtidas", () => {
    const c = conquistas(semanaBoa, 7, 1, 1);
    const obtidas = c.filter((x) => x.obtida).map((x) => x.id);
    expect(obtidas).toEqual(["seq3", "seq7", "agua7", "semana", "chefe"]);
  });
});

describe("plano de esteira", () => {
  it("sobe 5 min por semana e alivia na quarta", () => {
    const metas = [0, 7, 14, 21, 28].map((d) => planoEsteira("2026-11-09", somarDias("2026-11-09", d), 30).metaMin);
    expect(metas).toEqual([30, 35, 40, 21, 35]);
  });
});

describe("análises", () => {
  it("estatísticas de glicose", () => {
    const e = estatisticasGlicose([60, 100, 120, 200], 70, 160);
    expect(e).toMatchObject({ leituras: 4, media: 120, abaixo: 1, acima: 1, noAlvoPct: 50 });
  });
  it("sem leituras", () => {
    expect(estatisticasGlicose([], 70, 160).media).toBeNull();
  });
  it("comparação exige 3 dias em cada grupo", () => {
    const poucos = compararGrupos([{ grupo: true, valor: 100 }, { grupo: false, valor: 150 }]);
    expect(poucos.suficiente).toBe(false);
    const ok = compararGrupos([
      ...[100, 110, 120].map((v) => ({ grupo: true, valor: v })),
      ...[140, 150, 160, null].map((v) => ({ grupo: false, valor: v })),
    ]);
    expect(ok).toEqual({ suficiente: true, comMedia: 110, semMedia: 150, diasCom: 3, diasSem: 3 });
  });
  it("CSV com ponto e vírgula e vírgula decimal", () => {
    expect(paraCsv([{ a: 1.5, b: "x;y" }, { a: 2 }])).toBe('a;b\n1,5;"x;y"\n2;');
  });
});
