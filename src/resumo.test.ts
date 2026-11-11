import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "./db";
import { montarResumo, type Dados } from "./resumo";

const vazio = (): Dados => ({ configuracoes: CONFIG_PADRAO, dias: [], agua: [], glicose: [], treinos: [], marcacoes: [] });
const base = { criadoEm: "", origem: "manual" as const };

describe("montarResumo", () => {
  it("app novo: nível 1, sequência 0, dia pendente", () => {
    const r = montarResumo(vazio(), "2026-11-11");
    expect(r.nivel.nivel).toBe(1);
    expect(r.sequencia.atual).toBe(0);
    expect(r.hoje.garantido).toBe(false);
    expect(r.emJogo.xp).toBe(40 + 10 + 5 + 20 + 2);
  });

  it("treino concluído garante o dia e soma XP", () => {
    const d = vazio();
    d.glicose.push({ ...base, id: 1, dia: "2026-11-11", valor: 120, momento: "antes_treino" });
    d.treinos.push({ ...base, id: 1, dia: "2026-11-11", turno: "manha", checagem: "liberado", glicoseId: 1, concluidoEm: "x", tipo: "esteira", duracaoMin: 30 });
    const r = montarResumo(d, "2026-11-11");
    expect(r.hoje.garantido).toBe(true);
    expect(r.sequencia.atual).toBe(1);
    expect(r.xpHoje.partes).toEqual({ treinos: 40, checagens: 10, glicose: 5, agua: 0, dia: 20, bonus: 2 });
    expect(r.ultimoTipo.manha).toBe("esteira");
  });

  it("adiar por hipo vale o mesmo XP de treino que treinar", () => {
    const d = vazio();
    d.glicose.push({ ...base, id: 1, dia: "2026-11-11", valor: 62, momento: "antes_treino" });
    d.treinos.push({ ...base, id: 1, dia: "2026-11-11", turno: "manha", checagem: "baixa", glicoseId: 1, adiadoEm: "x" });
    d.marcacoes.push({ ...base, id: 1, dia: "2026-11-11", tipo: "pausa", motivo: "hipo" });
    const r = montarResumo(d, "2026-11-11");
    expect(r.hoje.situacao).toBe("pausa");
    expect(r.xpHoje.partes.treinos).toBe(40);
    expect(r.hoje.treinoEmAndamento).toBeUndefined();
  });

  it("registros excluídos não contam", () => {
    const d = vazio();
    d.treinos.push({ ...base, id: 1, dia: "2026-11-11", turno: "noite", checagem: "sem_checagem", concluidoEm: "x", excluidoEm: "y" });
    expect(montarResumo(d, "2026-11-11").hoje.garantido).toBe(false);
  });

  it("dias sem uso entre registros contam como falta", () => {
    const d = vazio();
    d.treinos.push({ ...base, id: 1, dia: "2026-11-01", turno: "manha", checagem: "sem_checagem", concluidoEm: "x" });
    d.treinos.push({ ...base, id: 2, dia: "2026-11-02", turno: "manha", checagem: "sem_checagem", concluidoEm: "x" });
    const r = montarResumo(d, "2026-11-04");
    expect(r.sequencia.dias.map((x) => x.resultado)).toEqual(["cumprido", "cumprido", "perdido", "pendente"]);
    expect(r.sequencia.atual).toBe(1);
  });

  it("conta descansos da semana", () => {
    const d = vazio();
    d.marcacoes.push({ ...base, id: 1, dia: "2026-11-10", tipo: "descanso" });
    expect(montarResumo(d, "2026-11-11").descansosRestantes).toBe(0);
    expect(montarResumo(d, "2026-11-16").descansosRestantes).toBe(1);
  });
});
