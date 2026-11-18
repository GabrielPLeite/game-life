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
    expect(r.xpHoje.partes).toEqual({ treinos: 40, checagens: 10, glicose: 5, agua: 0, dia: 20, bonus: 2, habitos: 0, metas: 0, jardim: 0 });
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

  it("puxar do sensor vale uma medição por dia, quantas vezes for e qualquer que seja o valor", () => {
    const d = vazio();
    const sinc = (id: number, valor: number) => ({ id, dia: "2026-11-11", criadoEm: "", leituras: 100, tendencia: 3 as const, atualValor: valor, servicoLigado: true });
    d.sincronizacoes = [sinc(1, 250), sinc(2, 55), sinc(3, 120)];
    const r = montarResumo(d, "2026-11-11");
    expect(r.xpHoje.partes.glicose).toBe(5);
    expect(r.hoje.sensorHoje).toBe(true);
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

describe("montarResumo com hábitos e semana", () => {
  it("hábitos somam XP e caminhada curta não conta", () => {
    const d = vazio();
    d.habitos = [
      { ...base, id: 1, dia: "2026-11-11", tipo: "refeicao", descricao: "Almoço", contexto: "normal" },
      { ...base, id: 2, dia: "2026-11-11", tipo: "caminhada", minutos: 15, refeicaoId: 1 },
      { ...base, id: 3, dia: "2026-11-11", tipo: "caminhada", minutos: 5 },
      { ...base, id: 4, dia: "2026-11-11", tipo: "sono", horas: 7.5 },
      { ...base, id: 5, dia: "2026-11-11", tipo: "insulina", insulina: "basal" },
      { ...base, id: 6, dia: "2026-11-11", tipo: "insulina", insulina: "rapida", unidades: 4 },
    ];
    const r = montarResumo(d, "2026-11-11");
    // refeição 5 + caminhada 10 + sono 5 (+10 por ficar entre 7 e 9 h) + insulina 5
    expect(r.xpHoje.partes.habitos).toBe(5 + 10 + 5 + 10 + 5);
    expect(r.jogo.missoes.find((m) => m.id === "caminhadas")?.progresso).toBe(1);
  });

  it("recompensa libera ao atingir o nível", () => {
    const d = vazio();
    d.recompensas = [{ id: 1, nome: "Tênis", nivel: 1, criadoEm: "" }, { id: 2, nome: "Relógio", nivel: 5, criadoEm: "" }];
    const r = montarResumo(d, "2026-11-11");
    expect(r.jogo.recompensas.map((x) => x.liberada)).toEqual([true, false]);
  });

  describe("versão generalista", () => {
    const off = (): Dados => ({ ...vazio(), configuracoes: { ...CONFIG_PADRAO, glicoseHistorico: [{ desde: "2026-11-16", ligada: false }] }, registrosMeta: [], metas: [] });
    const reg = (id: string, metaId: string, dia: string, minutos: number, tipo: "limite" | "minimo", alvoMin: number, total = false) => ({ id, metaId, dia, criadoEm: `${dia}T12:00:00Z-${id}`, minutos, tipo, alvoMin, total });

    it("com a glicose desligada, o XP em jogo não conta checagem nem medição", () => {
      const r = montarResumo(off(), "2026-11-16");
      expect(r.emJogo.xp).toBe(40 + 20 + 2);
    });

    it("meta de limite só pontua quando o dia fecha, e estourar ainda vale o registro", () => {
      const d = off();
      d.registrosMeta!.push(reg("a", "tela", "2026-11-16", 50, "limite", 60, true), reg("b", "pc", "2026-11-16", 400, "limite", 180, true), reg("c", "tela", "2026-11-17", 0, "limite", 60, true));
      const r = montarResumo(d, "2026-11-17");
      const ontem = r.metasDoDia("2026-11-16");
      expect(ontem.find((m) => m.metaId === "tela")).toMatchObject({ xp: 25, cumprida: true });
      expect(ontem.find((m) => m.metaId === "pc")).toMatchObject({ xp: 10, cumprida: false });
      expect(r.metasDoDia("2026-11-17")[0]).toMatchObject({ xp: 0, cumprida: false });
      expect(r.xpHoje.partes.metas).toBe(0);
      expect(r.xpTotal).toBe(35);
    });

    it("estudo soma XP no próprio dia e vira golpe na batalha", () => {
      const d = off();
      d.registrosMeta!.push(reg("a", "estudo", "2026-11-16", 15, "minimo", 30), reg("b", "estudo", "2026-11-16", 15, "minimo", 30));
      const r = montarResumo(d, "2026-11-16");
      expect(r.xpHoje.partes.metas).toBe(10);
      expect(r.rpg.ataquesHoje.map((a) => [a.tipo, a.base])).toEqual([["meta", 4]]);
      expect(r.diasResumidos.at(-1)!.metasCumpridas).toBe(1);
    });

    it("a missão de glicose dá lugar à de metas só a partir da semana em que foi desligada", () => {
      const d = off();
      d.dias.push({ dia: "2026-11-09", metaAguaMl: 2500 });
      const r = montarResumo(d, "2026-11-16");
      expect(r.jogo.missoes.map((m) => m.id)).toContain("metas");
      expect(r.jogo.missoes.map((m) => m.id)).not.toContain("glicose");
      // Religar volta a missão de glicose para a semana atual.
      d.configuracoes = { ...d.configuracoes, glicoseHistorico: [...d.configuracoes.glicoseHistorico!, { desde: "2026-11-17", ligada: true }] };
      expect(montarResumo(d, "2026-11-17").jogo.missoes.map((m) => m.id)).toContain("glicose");
    });
  });

  it("jardim: cada vaso respondido vale XP, com reguei ou com não, sem contar o mesmo vaso duas vezes", () => {
    const d = vazio();
    const rega = (id: string, vasoId: string, regou: boolean) => ({ id, vasoId, dia: "2026-11-18", regou, criadoEm: "" });
    d.regas = [rega("a", "v1", true), rega("b", "v1", false), rega("c", "v2", false)];
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.jardim).toBe(10);
    d.regas.push(rega("d", "v3", true), rega("e", "v4", true));
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.jardim).toBe(15);
  });

  it("sono: bônus de 7 a 9 h e de horário de costume, nunca desconto", () => {
    const d = vazio();
    const noite = (id: number, dia: string, horas: number, deitou: string) => ({ ...base, id, dia, tipo: "sono" as const, horas, inicioEm: new Date(`${dia}T${deitou}:00`).toISOString() });
    d.habitos = [noite(1, "2026-11-15", 7, "23:00"), noite(2, "2026-11-16", 8, "23:30"), noite(3, "2026-11-17", 7.5, "00:10"), noite(4, "2026-11-18", 7.2, "23:40")];
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.habitos).toBe(5 + 10 + 5);
    d.habitos[3] = noite(4, "2026-11-18", 5, "03:00");
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.habitos).toBe(5);
  });

  it("glicose do sensor: bônus só com 70% no alvo, até 4% abaixo, dados suficientes e glicose ligada", () => {
    const d = vazio();
    const dia = (x: Partial<import("./db").DiaSensor>) => ({ dia: "2026-11-18", coberturaPct: 90, suficiente: true, noAlvoPct: 75, abaixoPct: 3, acimaPct: 22, ...x });
    d.diasSensor = [dia({})];
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.glicose).toBe(15);
    d.diasSensor = [dia({ abaixoPct: 6 })];
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.glicose).toBe(0);
    d.diasSensor = [dia({})];
    d.configuracoes = { ...CONFIG_PADRAO, glicoseHistorico: [{ desde: "2026-11-16", ligada: false }] };
    expect(montarResumo(d, "2026-11-18").xpHoje.partes.glicose).toBe(0);
  });
});
