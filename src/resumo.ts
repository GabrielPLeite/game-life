// Junta todos os registros e aplica as regras do jogo.
// Função pura: recebe os dados do banco e devolve tudo o que a tela precisa mostrar.
import type { CompraLoja, Rega, Configuracoes, Dia, Habito, Marcacao, Meta, Recompensa, RegistroMeta, RegistroAgua, RegistroGlicose, RegistroTreino, SincronizacaoSensor, TipoTreino } from "./db";
import { agruparPorSemana, chefeDaSemana, conquistas, missoesDaSemana, planoEsteira, xpDaSemana, type DiaResumido } from "./jogo";
import {
  calcularSequencia,
  glicoseLigadaEm,
  inicioDaSemana,
  METAS_DE_LIMITE_LIGADAS,
  metaCumprida,
  minutosDoDia,
  somarDias,
  xpMeta,
  type MetaNoDia,
  nivelDeXp,
  seFaltarHoje,
  xpDoDia,
  type SituacaoDia,
} from "./regras";
import { DANO_BASE, OURO_POR_CHEFE, OURO_POR_MISSAO, POCAO_DE_GELO, atributos, calcularAtaques, campanha, itemPorId, tituloDoNivel, type Evento } from "./rpg";

export interface Dados {
  configuracoes: Configuracoes;
  dias: Dia[];
  agua: RegistroAgua[];
  glicose: RegistroGlicose[];
  treinos: RegistroTreino[];
  marcacoes: Marcacao[];
  habitos?: Habito[];
  recompensas?: Recompensa[];
  compras?: CompraLoja[];
  /** Vezes que você puxou dados do app Glicose. Cada dia com pelo menos uma vale como uma medição de glicose. */
  sincronizacoes?: SincronizacaoSensor[];
  metas?: Meta[];
  registrosMeta?: RegistroMeta[];
  /** Respostas do jardim. Só importa quantos vasos foram respondidos em cada dia. */
  regas?: Rega[];
}

/** Agrupa registros ativos (não excluídos) por dia. */
function porDia<T extends { dia: string; excluidoEm?: string }>(lista: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const r of lista) {
    if (r.excluidoEm) continue;
    mapa.set(r.dia, [...(mapa.get(r.dia) ?? []), r]);
  }
  return mapa;
}

export function montarResumo(d: Dados, hoje: string) {
  const agua = porDia(d.agua);
  const glicose = porDia(d.glicose);
  const treinos = porDia(d.treinos);
  const marcacoes = porDia(d.marcacoes);
  const habitos = porDia(d.habitos ?? []);
  const sincronizacoes = porDia(d.sincronizacoes ?? []);
  /** Puxar do sensor vale como UMA medição no dia (o XP vem de olhar, nunca do valor). */
  const sensorNoDia = (dia: string) => ((sincronizacoes.get(dia) ?? []).length > 0 ? 1 : 0);
  const habitosDe = <T extends Habito["tipo"]>(dia: string, tipo: T) =>
    (habitos.get(dia) ?? []).filter((h): h is Extract<Habito, { tipo: T }> => h.tipo === tipo);
  /** Caminhada pós-refeição só conta a partir de 10 minutos. */
  const caminhadasValidas = (dia: string) => habitosDe(dia, "caminhada").filter((c) => c.minutos >= 10);
  const metaDoDia = new Map(d.dias.map((x) => [x.dia, x.metaAguaMl]));

  // ---------- Metas pessoais (tela, jogos, estudo...) ----------
  const registrosMeta = porDia(d.registrosMeta ?? []);
  const regas = porDia(d.regas ?? []);
  /** Vasos diferentes respondidos no dia (responder de novo o mesmo vaso não conta duas vezes). */
  const vasosRespondidos = (dia: string) => new Set((regas.get(dia) ?? []).map((r) => r.vasoId)).size;
  const metasAtivas = (d.metas ?? []).filter((m) => !m.arquivadaEm && (METAS_DE_LIMITE_LIGADAS || m.tipo !== "limite")).sort((a, b) => a.ordem - b.ordem);
  /** Situação de cada meta com lançamento em um dia. Tipo e alvo vêm do último lançamento do dia. */
  const metasDoDia = (dia: string) => {
    const porMeta = new Map<string, RegistroMeta[]>();
    for (const r of registrosMeta.get(dia) ?? []) porMeta.set(r.metaId, [...(porMeta.get(r.metaId) ?? []), r]);
    return [...porMeta.entries()].map(([metaId, regs]) => {
      const ordenados = [...regs].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
      const ultimo = ordenados.at(-1)!;
      const m: MetaNoDia = { tipo: ultimo.tipo, alvoMin: ultimo.alvoMin, minutos: minutosDoDia(ordenados), registrado: true, diaFechado: dia < hoje };
      return { metaId, ...m, xp: xpMeta(m), cumprida: metaCumprida(m), ultimoEm: ultimo.criadoEm };
    });
  };
  /** O que a tela mostra de uma meta em um dia (com ou sem lançamento). */
  const metaNaTela = (meta: Meta, dia: string) => {
    const achada = metasDoDia(dia).find((x) => x.metaId === meta.id);
    return achada ?? { metaId: meta.id, tipo: meta.tipo, alvoMin: meta.alvoMin, minutos: 0, registrado: false, diaFechado: dia < hoje, xp: 0, cumprida: false, ultimoEm: undefined };
  };

  const concluidos = (dia: string) => (treinos.get(dia) ?? []).filter((t) => t.concluidoEm);
  const pausaDe = (dia: string) => (marcacoes.get(dia) ?? []).filter((m) => m.tipo === "pausa").at(-1);
  const descansoDe = (dia: string) => (marcacoes.get(dia) ?? []).filter((m) => m.tipo === "descanso").at(-1);

  const situacaoDe = (dia: string): SituacaoDia => {
    if (concluidos(dia).length > 0) return "cumprido";
    if (pausaDe(dia)) return "pausa";
    if (descansoDe(dia)) return "descanso";
    return "vazio";
  };

  // O jogo começa no primeiro dia com qualquer registro.
  const todosOsDias = [...d.dias.map((x) => x.dia), ...agua.keys(), ...glicose.keys(), ...treinos.keys(), ...marcacoes.keys(), ...habitos.keys(), ...registrosMeta.keys(), ...regas.keys()];
  const primeiroDia = todosOsDias.length ? todosOsDias.reduce((a, b) => (a < b ? a : b)) : hoje;
  const compras = (d.compras ?? []).filter((c) => !c.excluidoEm);
  const pocoesEm = (dia: string) => compras.filter((c) => c.itemId === POCAO_DE_GELO && c.dia === dia).length;
  const sequencia = calcularSequencia(primeiroDia < hoje ? primeiroDia : hoje, hoje, situacaoDe, pocoesEm);

  const atividadeDe = (dia: string, sequenciaDoDia: number) => ({
    sessoes: concluidos(dia).length + (pausaDe(dia) ? 1 : 0),
    checagens: (treinos.get(dia) ?? []).filter((t) => t.glicoseId !== undefined).length,
    glicoses: (glicose.get(dia) ?? []).length + sensorNoDia(dia),
    aguaMl: (agua.get(dia) ?? []).reduce((s, r) => s + r.ml, 0),
    metaAguaMl: metaDoDia.get(dia) ?? d.configuracoes.metaAguaMl,
    garantido: situacaoDe(dia) !== "vazio",
    sequencia: sequenciaDoDia,
    refeicoes: habitosDe(dia, "refeicao").length,
    caminhadas: caminhadasValidas(dia).length,
    sono: habitosDe(dia, "sono").length > 0,
    medida: habitosDe(dia, "medida").length > 0,
    insulina: habitosDe(dia, "insulina").length > 0,
    metas: metasDoDia(dia).reduce((x, m) => x + m.xp, 0),
    regas: vasosRespondidos(dia),
  });

  // O XP total é sempre recalculado a partir dos registros, nunca guardado como saldo.
  let xpTotal = 0;
  let xpHoje = xpDoDia(atividadeDe(hoje, sequencia.atual));
  const diasResumidos: DiaResumido[] = [];
  for (const s of sequencia.dias) {
    const a = atividadeDe(s.dia, s.sequencia);
    const xp = xpDoDia(a);
    xpTotal += xp.total;
    if (s.dia === hoje) xpHoje = xp;
    diasResumidos.push({
      dia: s.dia,
      garantido: a.garantido,
      treinos: concluidos(s.dia).length,
      metaAgua: a.metaAguaMl > 0 && a.aguaMl >= a.metaAguaMl,
      caminhadas: a.caminhadas,
      glicoses: a.glicoses,
      sono: a.sono,
      sequencia: s.sequencia,
      metasCumpridas: metasDoDia(s.dia).filter((m) => m.tipo === "minimo" && m.cumprida).length,
    });
  }

  // Camada semanal: missões e chefe somam XP quando concluídos.
  const semanas = agruparPorSemana(diasResumidos);
  let semanasCompletas = 0;
  let chefesDerrotados = 0;
  let missoesConcluidas = 0;
  // Cada semana usa o modo (glicose ligada ou não) que valia no fim dela; a semana atual usa o de hoje.
  // Assim, desligar a glicose não muda missões nem XP de semanas que já passaram.
  const comGlicoseNaSemana = (semana: string) => {
    const fim = somarDias(semana, 6);
    return glicoseLigadaEm(fim < hoje ? fim : hoje, d.configuracoes.glicoseHistorico);
  };
  for (const [semana, diasDaSemana] of semanas) {
    const missoes = missoesDaSemana(diasDaSemana, comGlicoseNaSemana(semana));
    xpTotal += xpDaSemana(semana, diasDaSemana, comGlicoseNaSemana(semana));
    missoesConcluidas += missoes.filter((m) => m.concluida).length;
    if (missoes.every((m) => m.concluida)) semanasCompletas += 1;
    if (chefeDaSemana(semana, diasDaSemana).derrotado) chefesDerrotados += 1;
  }
  const semanaAtual = inicioDaSemana(hoje);
  const diasDaSemanaAtual = semanas.get(semanaAtual) ?? [];

  const atividadeHoje = atividadeDe(hoje, sequencia.atual);
  const garantidoHoje = atividadeHoje.garantido;

  // Quanto XP ainda está em jogo hoje se você treinar uma vez (o que segura o dia).
  const comGlicoseHoje = glicoseLigadaEm(hoje, d.configuracoes.glicoseHistorico);
  const sequenciaSeTreinar = garantidoHoje ? sequencia.atual : sequencia.atual + 1;
  const xpSeTreinar = xpDoDia({
    ...atividadeHoje,
    sessoes: Math.max(1, atividadeHoje.sessoes),
    // Checagem e medição só entram na conta com a parte de glicose ligada.
    checagens: comGlicoseHoje ? Math.max(1, atividadeHoje.checagens) : atividadeHoje.checagens,
    glicoses: comGlicoseHoje ? Math.max(1, atividadeHoje.glicoses) : atividadeHoje.glicoses,
    garantido: true,
    sequencia: sequenciaSeTreinar,
  }).total;

  // Descansos planejados já usados nesta semana (segunda a domingo).
  const semana = inicioDaSemana(hoje);
  const descansosNaSemana = [...marcacoes.entries()]
    .filter(([dia]) => dia >= semana && dia <= hoje)
    .flatMap(([, ms]) => ms)
    .filter((m) => m.tipo === "descanso").length;

  // Último tipo de treino por turno, para já vir sugerido (padrão "repetir o último").
  const ultimoTipo: Partial<Record<"manha" | "noite", TipoTreino>> = {};
  for (const t of d.treinos) if (!t.excluidoEm && t.tipo) ultimoTipo[t.turno] = t.tipo;

  const treinosHoje = treinos.get(hoje) ?? [];
  const glicoseHoje = glicose.get(hoje) ?? [];
  const ultimaSincronizacao = (d.sincronizacoes ?? []).at(-1);
  const valorGlicose = new Map(d.glicose.map((g) => [g.id, g.valor]));

  const nivel = nivelDeXp(xpTotal);

  // ---------- RPG: cada registro real vira um ataque ----------
  const eventos: Evento[] = [];
  const ev = (tipo: Evento["tipo"], chave: string, quando: string, base = DANO_BASE[tipo]) => eventos.push({ tipo, chave, quando, base, dia: diaAtual });
  let diaAtual = hoje;
  for (const s of sequencia.dias) {
    const dia = s.dia;
    diaAtual = dia;
    // Treinos e pausa legítima: no máximo 2 golpes por dia, e a pausa golpeia igual a um treino.
    const sessoes = [
      ...concluidos(dia).map((t) => ({ tipo: "treino" as const, chave: `treino-${t.id}`, quando: t.concluidoEm! })),
      ...(pausaDe(dia) ? [{ tipo: "pausa" as const, chave: `pausa-${pausaDe(dia)!.id}`, quando: pausaDe(dia)!.criadoEm }] : []),
    ].slice(0, 2);
    sessoes.forEach((x) => ev(x.tipo, x.chave, x.quando));
    (treinos.get(dia) ?? []).filter((t) => t.glicoseId !== undefined).slice(0, 2).forEach((t) => ev("checagem", `checagem-${t.id}`, t.criadoEm));
    const golpesDeGlicose = [
      ...(glicose.get(dia) ?? []).map((g) => ({ chave: `glicose-${g.id}`, quando: g.criadoEm })),
      ...(sincronizacoes.get(dia) ?? []).slice(0, 1).map((x) => ({ chave: `sensor-${x.id}`, quando: x.criadoEm })),
    ];
    golpesDeGlicose.slice(0, 6).forEach((g) => ev("glicose", g.chave, g.quando));
    habitosDe(dia, "refeicao").slice(0, 4).forEach((h) => ev("refeicao", `habito-${h.id}`, h.criadoEm));
    caminhadasValidas(dia).slice(0, 3).forEach((h) => ev("caminhada", `habito-${h.id}`, h.criadoEm));
    habitosDe(dia, "sono").slice(0, 1).forEach((h) => ev("sono", `habito-${h.id}`, h.criadoEm));
    habitosDe(dia, "medida").slice(0, 1).forEach((h) => ev("medida", `habito-${h.id}`, h.criadoEm));
    habitosDe(dia, "insulina").slice(0, 1).forEach((h) => ev("insulina", `habito-${h.id}`, h.criadoEm));
    // Metas pessoais: um golpe por meta por dia. Limite: 4 por registrar o dia fechado, 8 se ficou dentro.
    // Mínimo: 2 por bloco de 15 min, até 8.
    for (const m of metasDoDia(dia)) {
      const base = m.tipo === "limite" ? (m.xp > 0 ? (m.cumprida ? 8 : 4) : 0) : Math.round((m.xp / 5) * 2);
      if (base > 0) ev("meta", `meta-${m.metaId}-${dia}`, m.ultimoEm, base);
    }
    // Água: 1 de dano por copo até a meta, +3 ao bater a meta. Nada acima da meta.
    const aguas = agua.get(dia) ?? [];
    if (aguas.length > 0) {
      const meta = metaDoDia.get(dia) ?? d.configuracoes.metaAguaMl;
      const total = aguas.reduce((x, r) => x + r.ml, 0);
      const copos = Math.floor(Math.min(total, meta) / 250);
      if (copos > 0) ev("agua", `agua-${dia}`, aguas.at(-1)!.criadoEm, copos * DANO_BASE.agua + (total >= meta ? 3 : 0));
    }
  }
  const ataques = calcularAtaques(eventos, compras, d.configuracoes.heroiClasse);
  const batalha = campanha(ataques);

  const recompensasCompradas = (d.recompensas ?? []).filter((r) => !r.excluidoEm && r.resgatadaEm && r.custoOuro);
  const ouroGanho = batalha.ouro + missoesConcluidas * OURO_POR_MISSAO + chefesDerrotados * OURO_POR_CHEFE;
  const ouroGasto = compras.reduce((x, c) => x + (itemPorId(c.itemId)?.preco ?? 0), 0) + recompensasCompradas.reduce((x, r) => x + (r.custoOuro ?? 0), 0);
  const ouro = Math.max(0, ouroGanho - ouroGasto);
  const recompensas = (d.recompensas ?? [])
    .filter((r) => !r.excluidoEm)
    .sort((a, b) => a.nivel - b.nivel)
    .map((r) => ({ ...r, liberada: r.custoOuro ? ouro >= r.custoOuro : nivel.nivel >= r.nivel }));

  return {
    nivel,
    xpTotal,
    xpHoje,
    sequencia,
    hoje: {
      situacao: situacaoDe(hoje),
      garantido: garantidoHoje,
      pausa: pausaDe(hoje),
      descanso: descansoDe(hoje),
      treinosConcluidos: concluidos(hoje),
      treinoEmAndamento: treinosHoje.find((t) => !t.concluidoEm && !t.adiadoEm),
      glicoses: glicoseHoje,
      /** Puxou dados do sensor hoje (vale como uma medição de glicose no XP). */
      sensorHoje: sensorNoDia(hoje) > 0,
      aguaMl: atividadeHoje.aguaMl,
      metaAguaMl: atividadeHoje.metaAguaMl,
    },
    ultimaSincronizacao,
    emJogo: {
      ...seFaltarHoje(sequencia),
      xp: Math.max(0, xpSeTreinar - xpHoje.total),
    },
    descansosRestantes: Math.max(0, d.configuracoes.descansosPorSemana - descansosNaSemana),
    ultimoTipo,
    valorGlicose,
    diasResumidos,
    jogo: {
      missoes: missoesDaSemana(diasDaSemanaAtual, comGlicoseNaSemana(semanaAtual)),
      chefe: chefeDaSemana(semanaAtual, diasDaSemanaAtual),
      conquistas: conquistas(diasResumidos, sequencia.recorde, semanasCompletas, chefesDerrotados),
      plano: planoEsteira(primeiroDia < hoje ? primeiroDia : hoje, hoje, d.configuracoes.esteiraBaseMin),
      recompensas,
    },
    habitosHoje: habitos.get(hoje) ?? [],
    /** Metas ativas, com a situação de hoje e de ontem (ontem é onde as metas de limite fecham). */
    metas: metasAtivas.map((meta) => ({ meta, hoje: metaNaTela(meta, hoje), ontem: metaNaTela(meta, somarDias(hoje, -1)) })),
    ontem: somarDias(hoje, -1),
    /** Situação das metas com lançamento em um dia qualquer (para a revisão semanal). */
    metasDoDia,
    rpg: {
      nome: d.configuracoes.heroiNome,
      classe: d.configuracoes.heroiClasse,
      titulo: tituloDoNivel(nivel.nivel),
      atributos: atributos({
        treinos: diasResumidos.reduce((x, y) => x + y.treinos, 0),
        caminhadas: diasResumidos.reduce((x, y) => x + y.caminhadas, 0),
        diasMetaAgua: diasResumidos.filter((y) => y.metaAgua).length,
        diasComGlicose: diasResumidos.filter((y) => y.glicoses > 0).length,
        refeicoes: (d.habitos ?? []).filter((h) => !h.excluidoEm && h.tipo === "refeicao").length,
        noitesDeSono: diasResumidos.filter((y) => y.sono).length,
        recordeSequencia: sequencia.recorde,
        diasDeEstudo: diasResumidos.filter((y) => (y.metasCumpridas ?? 0) > 0).length,
      }),
      batalha,
      ouro,
      ouroGanho,
      ataquesHoje: ataques.filter((a) => a.dia === hoje),
      itensComprados: compras.map((c) => c.itemId),
    },
  };
}

export type Resumo = ReturnType<typeof montarResumo>;
