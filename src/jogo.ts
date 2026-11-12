// Camada semanal do jogo: missões, chefe da semana, conquistas e plano de esteira.
// Funções puras: recebem números já calculados por dia e devolvem o estado do jogo.
import { inicioDaSemana, somarDias } from "./regras";
import { CHEFES } from "./rpg";

/** O que aconteceu em um dia, já resumido. Base de tudo neste arquivo. */
export interface DiaResumido {
  dia: string;
  garantido: boolean;
  treinos: number;
  metaAgua: boolean;
  caminhadas: number;
  glicoses: number;
  sono: boolean;
  sequencia: number;
}

// ---------- Missões semanais ----------

export const XP_POR_MISSAO = 50;

export interface Missao {
  id: string;
  titulo: string;
  meta: number;
  progresso: number;
  concluida: boolean;
  /** O comportamento que ela pode incentivar sem querer (mostrado no app). */
  risco: string;
}

/** As missões da semana (segunda a domingo). Fixas, para você saber o que esperar. */
export function missoesDaSemana(dias: DiaResumido[]): Missao[] {
  const contar = (f: (d: DiaResumido) => boolean) => dias.filter(f).length;
  const lista = [
    { id: "garantidos", titulo: "Garantir 6 dias", meta: 6, progresso: contar((d) => d.garantido), risco: "Usar pausa sem precisar. A revisão semanal mostra quantas pausas houve." },
    { id: "agua", titulo: "Bater a meta de água em 5 dias", meta: 5, progresso: contar((d) => d.metaAgua), risco: "Beber tudo de uma vez à noite. Não há XP acima da meta." },
    { id: "caminhadas", titulo: "3 caminhadas pós-refeição", meta: 3, progresso: dias.reduce((s, d) => s + d.caminhadas, 0), risco: "Registrar caminhadas curtas demais. Conta a partir de 10 minutos." },
    { id: "glicose", titulo: "Medir a glicose em 6 dias", meta: 6, progresso: contar((d) => d.glicoses > 0), risco: "Medir só nos dias bons. O valor nunca tira pontos, então registre todos." },
    { id: "sono", titulo: "Registrar o sono em 5 dias", meta: 5, progresso: contar((d) => d.sono), risco: "Chutar as horas. Vale mais registrar o real." },
  ];
  return lista.map((m) => ({ ...m, progresso: Math.min(m.progresso, m.meta), concluida: m.progresso >= m.meta }));
}

// ---------- Chefe da semana ----------

export const VIDA_DO_CHEFE = 100;
export const XP_CHEFE = 150;

/** Dano por ação. Um dia normal tira cerca de 20 de vida; o chefe cai em 5 a 6 dias bons. */
export const DANO = { treino: 10, caminhada: 5, metaAgua: 3, diaGarantido: 2 };

export function chefeDaSemana(semana: string, dias: DiaResumido[]) {
  const dano = dias.reduce(
    (s, d) =>
      s + Math.min(d.treinos, 2) * DANO.treino + Math.min(d.caminhadas, 3) * DANO.caminhada + (d.metaAgua ? DANO.metaAgua : 0) + (d.garantido ? DANO.diaGarantido : 0),
    0,
  );
  // O nome muda a cada semana, sempre o mesmo para a mesma semana.
  const numero = Math.floor(Date.UTC(+semana.slice(0, 4), +semana.slice(5, 7) - 1, +semana.slice(8, 10)) / (7 * 864e5));
  const chefe = CHEFES[numero % CHEFES.length];
  return {
    id: chefe.id,
    nome: chefe.nome,
    vida: Math.max(0, VIDA_DO_CHEFE - dano),
    derrotado: dano >= VIDA_DO_CHEFE,
  };
}

// ---------- Semanas ----------

/** Separa os dias por semana (segunda a domingo). */
export function agruparPorSemana(dias: DiaResumido[]): Map<string, DiaResumido[]> {
  const semanas = new Map<string, DiaResumido[]>();
  for (const d of dias) {
    const s = inicioDaSemana(d.dia);
    semanas.set(s, [...(semanas.get(s) ?? []), d]);
  }
  return semanas;
}

/** XP das missões e do chefe de uma semana. */
export function xpDaSemana(semana: string, dias: DiaResumido[]): number {
  const missoes = missoesDaSemana(dias).filter((m) => m.concluida).length * XP_POR_MISSAO;
  return missoes + (chefeDaSemana(semana, dias).derrotado ? XP_CHEFE : 0);
}

// ---------- Conquistas ----------

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  obtida: boolean;
}

/** Conquistas de consistência. Não dão XP: são marcos, para não inflar o jogo. */
export function conquistas(dias: DiaResumido[], recorde: number, semanasCompletas: number, chefesDerrotados: number): Conquista[] {
  const totalTreinos = dias.reduce((s, d) => s + d.treinos, 0);
  const totalCaminhadas = dias.reduce((s, d) => s + d.caminhadas, 0);
  let aguaSeguida = 0;
  let melhorAgua = 0;
  for (const d of dias) {
    aguaSeguida = d.metaAgua ? aguaSeguida + 1 : 0;
    melhorAgua = Math.max(melhorAgua, aguaSeguida);
  }
  const c = (id: string, titulo: string, descricao: string, obtida: boolean) => ({ id, titulo, descricao, obtida });
  return [
    c("seq3", "Aquecimento", "Sequência de 3 dias", recorde >= 3),
    c("seq7", "Uma semana inteira", "Sequência de 7 dias", recorde >= 7),
    c("seq14", "Duas semanas", "Sequência de 14 dias", recorde >= 14),
    c("seq30", "Um mês", "Sequência de 30 dias", recorde >= 30),
    c("seq60", "Hábito formado", "Sequência de 60 dias", recorde >= 60),
    c("seq100", "Cem", "Sequência de 100 dias", recorde >= 100),
    c("treino10", "Dez treinos", "10 treinos concluídos", totalTreinos >= 10),
    c("treino50", "Cinquenta treinos", "50 treinos concluídos", totalTreinos >= 50),
    c("treino100", "Cem treinos", "100 treinos concluídos", totalTreinos >= 100),
    c("agua7", "Hidratado", "Meta de água 7 dias seguidos", melhorAgua >= 7),
    c("caminhada20", "Depois do prato, a rua", "20 caminhadas pós-refeição", totalCaminhadas >= 20),
    c("semana", "Semana perfeita", "Todas as missões de uma semana", semanasCompletas >= 1),
    c("chefe", "Primeiro chefe", "Derrotar um chefe da semana", chefesDerrotados >= 1),
  ];
}

// ---------- Plano progressivo de esteira ----------

/**
 * Ciclos de 4 semanas: base, +5 min, +10 min e uma semana leve (deload) com 70% da base.
 * A cada ciclo completo, a base sobe 5 minutos, até 60.
 */
export function planoEsteira(primeiroDia: string, hoje: string, baseMin: number) {
  const semanas = Math.floor((Date.parse(inicioDaSemana(hoje)) - Date.parse(inicioDaSemana(primeiroDia))) / (7 * 864e5));
  const ciclo = Math.floor(semanas / 4);
  const posicao = semanas % 4;
  const base = Math.min(60, baseMin + 5 * ciclo);
  const deload = posicao === 3;
  return {
    semanaDoCiclo: posicao + 1,
    deload,
    metaMin: deload ? Math.round(base * 0.7) : base + 5 * posicao,
    inicioDaProxima: somarDias(inicioDaSemana(hoje), 7),
  };
}
