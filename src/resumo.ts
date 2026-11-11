// Junta todos os registros e aplica as regras do jogo.
// Função pura: recebe os dados do banco e devolve tudo o que a tela precisa mostrar.
import type { Configuracoes, Dia, Marcacao, RegistroAgua, RegistroGlicose, RegistroTreino, TipoTreino } from "./db";
import {
  calcularSequencia,
  inicioDaSemana,
  nivelDeXp,
  seFaltarHoje,
  xpDoDia,
  type SituacaoDia,
} from "./regras";

export interface Dados {
  configuracoes: Configuracoes;
  dias: Dia[];
  agua: RegistroAgua[];
  glicose: RegistroGlicose[];
  treinos: RegistroTreino[];
  marcacoes: Marcacao[];
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
  const metaDoDia = new Map(d.dias.map((x) => [x.dia, x.metaAguaMl]));

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
  const todosOsDias = [...d.dias.map((x) => x.dia), ...agua.keys(), ...glicose.keys(), ...treinos.keys(), ...marcacoes.keys()];
  const primeiroDia = todosOsDias.length ? todosOsDias.reduce((a, b) => (a < b ? a : b)) : hoje;
  const sequencia = calcularSequencia(primeiroDia < hoje ? primeiroDia : hoje, hoje, situacaoDe);

  const atividadeDe = (dia: string, sequenciaDoDia: number) => ({
    sessoes: concluidos(dia).length + (pausaDe(dia) ? 1 : 0),
    checagens: (treinos.get(dia) ?? []).filter((t) => t.glicoseId !== undefined).length,
    glicoses: (glicose.get(dia) ?? []).length,
    aguaMl: (agua.get(dia) ?? []).reduce((s, r) => s + r.ml, 0),
    metaAguaMl: metaDoDia.get(dia) ?? d.configuracoes.metaAguaMl,
    garantido: situacaoDe(dia) !== "vazio",
    sequencia: sequenciaDoDia,
  });

  // O XP total é sempre recalculado a partir dos registros, nunca guardado como saldo.
  let xpTotal = 0;
  let xpHoje = xpDoDia(atividadeDe(hoje, sequencia.atual));
  for (const s of sequencia.dias) {
    const xp = xpDoDia(atividadeDe(s.dia, s.sequencia));
    xpTotal += xp.total;
    if (s.dia === hoje) xpHoje = xp;
  }

  const atividadeHoje = atividadeDe(hoje, sequencia.atual);
  const garantidoHoje = atividadeHoje.garantido;

  // Quanto XP ainda está em jogo hoje se você treinar uma vez (o que segura o dia).
  const sequenciaSeTreinar = garantidoHoje ? sequencia.atual : sequencia.atual + 1;
  const xpSeTreinar = xpDoDia({
    ...atividadeHoje,
    sessoes: Math.max(1, atividadeHoje.sessoes),
    checagens: Math.max(1, atividadeHoje.checagens),
    glicoses: Math.max(1, atividadeHoje.glicoses),
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
  const valorGlicose = new Map(d.glicose.map((g) => [g.id, g.valor]));

  return {
    nivel: nivelDeXp(xpTotal),
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
      aguaMl: atividadeHoje.aguaMl,
      metaAguaMl: atividadeHoje.metaAguaMl,
    },
    emJogo: {
      ...seFaltarHoje(sequencia),
      xp: Math.max(0, xpSeTreinar - xpHoje.total),
    },
    descansosRestantes: Math.max(0, d.configuracoes.descansosPorSemana - descansosNaSemana),
    ultimoTipo,
    valorGlicose,
  };
}

export type Resumo = ReturnType<typeof montarResumo>;
