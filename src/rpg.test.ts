import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "./db";
import { calcularSequencia } from "./regras";
import { montarResumo, type Dados } from "./resumo";
import { CHEFES, INIMIGOS, ITENS, atributos, bonusDeEquipamento, calcularAtaques, campanha, d20De, inimigoNumero, tituloDoNivel, type Evento } from "./rpg";
import { CHEFES_ARTE, INIMIGOS_ARTE } from "./sprites";

const ev = (chave: string, tipo: Evento["tipo"], base: number, quando = "2026-11-11T10:00:00Z"): Evento => ({ chave, tipo, base, quando });

describe("rpg", () => {
  it("o dado é sempre o mesmo para o mesmo registro e fica entre 1 e 20", () => {
    for (let i = 0; i < 200; i++) {
      const n = d20De(`treino-${i}`);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(20);
      expect(d20De(`treino-${i}`)).toBe(n);
    }
  });

  it("uma ação real nunca causa menos que o dano base", () => {
    const ataques = calcularAtaques(Array.from({ length: 50 }, (_, i) => ev(`glicose-${i}`, "glicose", 3)), [], undefined);
    expect(ataques.every((a) => a.dano >= 3)).toBe(true);
  });

  it("equipamento só conta depois da compra e vale o melhor de cada tipo", () => {
    const compras = [
      { itemId: "adaga", criadoEm: "2026-11-10T00:00:00Z" },
      { itemId: "espada-curta", criadoEm: "2026-11-12T00:00:00Z" },
      { itemId: "gibao", criadoEm: "2026-11-12T00:00:00Z" },
    ];
    expect(bonusDeEquipamento(compras, "2026-11-09T00:00:00Z")).toBe(0);
    expect(bonusDeEquipamento(compras, "2026-11-11T00:00:00Z")).toBe(1);
    expect(bonusDeEquipamento(compras, "2026-11-13T00:00:00Z")).toBe(3);
  });

  it("derrotar inimigos rende ouro e o dano que sobra passa para o próximo", () => {
    const c = campanha([{ ...ev("a", "treino", 40), d20: 5, critico: false, dano: 40 }]);
    expect(c.indice).toBe(1);
    expect(c.ouro).toBe(inimigoNumero(0).ouro);
    expect(c.hp).toBe(inimigoNumero(1).hp - 10);
    expect(c.derrotados.slime).toBe(1);
  });

  it("inimigos ficam mais fortes a cada volta", () => {
    expect(inimigoNumero(INIMIGOS.length).hp).toBeGreaterThan(inimigoNumero(0).hp);
    expect(inimigoNumero(INIMIGOS.length).nome).toContain("Feroz");
  });

  it("atributos começam em 8 e param em 20", () => {
    const zero = atributos({ treinos: 0, caminhadas: 0, diasMetaAgua: 0, diasComGlicose: 0, refeicoes: 0, noitesDeSono: 0, recordeSequencia: 0 });
    expect(zero.every((a) => a.valor === 8 && a.mod === -1)).toBe(true);
    const muito = atributos({ treinos: 999, caminhadas: 999, diasMetaAgua: 999, diasComGlicose: 999, refeicoes: 999, noitesDeSono: 999, recordeSequencia: 999 });
    expect(muito.every((a) => a.valor === 20 && a.mod === 5)).toBe(true);
  });

  it("títulos e arte existem para tudo", () => {
    expect(tituloDoNivel(1)).toBe("Aldeão");
    expect(tituloDoNivel(25)).toBe("Lenda");
    for (const i of INIMIGOS) expect(INIMIGOS_ARTE[i.id]).toBeDefined();
    for (const c of CHEFES) expect(CHEFES_ARTE[c.id]).toBeDefined();
    expect(new Set(ITENS.map((i) => i.id)).size).toBe(ITENS.length);
  });

  it("poção de gelo vira congelamento, respeitando o máximo de 2", () => {
    const s = calcularSequencia("2026-11-10", "2026-11-12", (d) => (d === "2026-11-10" ? "cumprido" : "vazio"), (d) => (d === "2026-11-10" ? 3 : 0));
    expect(s.dias[1].resultado).toBe("congelado");
    expect(s.atual).toBe(1);
    expect(s.congelamentos).toBe(1);
  });
});

describe("rpg no resumo", () => {
  const vazio = (): Dados => ({ configuracoes: CONFIG_PADRAO, dias: [], agua: [], glicose: [], treinos: [], marcacoes: [] });
  const base = { criadoEm: "2026-11-11T10:00:00Z", origem: "manual" as const };

  it("glicose baixa e glicose na faixa causam o mesmo dano", () => {
    const com = (valor: number) => {
      const d = vazio();
      d.glicose.push({ ...base, id: 1, dia: "2026-11-11", valor, momento: "jejum" });
      return montarResumo(d, "2026-11-11").rpg.batalha.danoTotal;
    };
    expect(com(55)).toBe(com(110));
    expect(com(250)).toBe(com(110));
  });

  it("adiar o treino por hipo golpeia igual a treinar", () => {
    const treinou = vazio();
    treinou.treinos.push({ ...base, id: 1, dia: "2026-11-11", turno: "manha", checagem: "liberado", concluidoEm: "2026-11-11T10:30:00Z", tipo: "esteira", duracaoMin: 30 });
    const adiou = vazio();
    adiou.marcacoes.push({ ...base, id: 1, dia: "2026-11-11", tipo: "pausa", motivo: "hipo" });
    const a = montarResumo(treinou, "2026-11-11").rpg.ataquesHoje.find((x) => x.tipo === "treino")!;
    const b = montarResumo(adiou, "2026-11-11").rpg.ataquesHoje.find((x) => x.tipo === "pausa")!;
    expect(a.base).toBe(b.base);
  });

  it("água acima da meta não causa dano extra e compras gastam ouro", () => {
    const d = vazio();
    d.agua.push({ ...base, id: 1, dia: "2026-11-11", ml: 20000 });
    const r = montarResumo(d, "2026-11-11");
    const meta = r.hoje.metaAguaMl;
    expect(r.rpg.batalha.danoTotal).toBeLessThanOrEqual(meta / 250 + 3 + 2 + 20);
    d.compras = [{ id: 1, itemId: "adaga", dia: "2026-11-11", criadoEm: "2026-11-11T11:00:00Z" }];
    expect(montarResumo(d, "2026-11-11").rpg.ouro).toBe(Math.max(0, r.rpg.ouro - 60));
  });
});
