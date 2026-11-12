// Regras do jogo. São funções "puras": recebem dados e devolvem resultados,
// sem tocar no banco. Assim é fácil testar e mudar uma regra depois.

// ---------- Datas ----------

/** Hora em que o dia "vira". Antes das 3h ainda conta como o dia anterior. */
export const HORA_DE_VIRADA = 3;

/** Devolve o dia do jogo no formato AAAA-MM-DD, respeitando a virada às 3h. */
export function diaLogico(agora: Date = new Date()): string {
  const d = new Date(agora.getTime() - HORA_DE_VIRADA * 60 * 60 * 1000);
  return formatarDia(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function formatarDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Soma (ou subtrai) dias de uma data AAAA-MM-DD. Usa UTC para não sofrer com horário de verão. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return formatarDia(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Segunda-feira da semana do dia informado (para limitar descansos por semana). */
export function inicioDaSemana(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const diaDaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((diaDaSemana + 6) % 7));
}

/** Turno do treino pelo horário: antes das 14h é manhã. */
export function turnoDoHorario(agora: Date = new Date()): "manha" | "noite" {
  return agora.getHours() < 14 ? "manha" : "noite";
}

// ---------- Água ----------

export const ML_POR_COPO = 250;
export const XP_POR_COPO = 2;
export const XP_META_AGUA = 10;
export const META_AGUA_PADRAO_ML = 2500;

/**
 * XP de água de um dia: 2 XP a cada 250 ml até a meta, mais 10 XP ao atingir a meta.
 * Acima da meta não há XP, para o jogo nunca incentivar beber água demais.
 */
export function xpAgua(totalMl: number, metaMl: number): number {
  const contado = Math.max(0, Math.min(totalMl, metaMl));
  const copos = Math.floor(contado / ML_POR_COPO);
  const bonus = metaMl > 0 && totalMl >= metaMl ? XP_META_AGUA : 0;
  return copos * XP_POR_COPO + bonus;
}

// ---------- Glicose e segurança ----------

export interface LimitesGlicose {
  /** Abaixo disso: não treinar (hipo). */
  limiteBaixoTreino: number;
  /** Até este valor (inclusive): comer algo antes de treinar. */
  limiteComerAntes: number;
  /** Acima disso: não treinar. Vazio (null) enquanto o médico não definir. */
  limiteAltoTreino: number | null;
}

export type ResultadoChecagem = "baixa" | "comer_antes" | "alta" | "liberado";

/**
 * Compara a glicose com os limites que VOCÊ configurou (vindos do seu médico).
 * O app não decide nada sozinho: só avisa e deixa a decisão com você.
 */
export function classificarGlicose(valor: number, limites: LimitesGlicose): ResultadoChecagem {
  if (valor < limites.limiteBaixoTreino) return "baixa";
  if (limites.limiteAltoTreino !== null && valor > limites.limiteAltoTreino) return "alta";
  if (valor <= limites.limiteComerAntes) return "comer_antes";
  return "liberado";
}

// ---------- XP do dia ----------

export const XP_POR_SESSAO = 40; // treino concluído ou pausa legítima
export const MAX_SESSOES = 2;
export const XP_POR_CHECAGEM = 10;
export const MAX_CHECAGENS = 2;
export const XP_POR_GLICOSE = 5;
export const MAX_GLICOSES = 6;
export const XP_DIA_GARANTIDO = 20;
export const XP_BONUS_POR_DIA_DE_SEQUENCIA = 2;
export const MAX_BONUS_SEQUENCIA = 20;

// Hábitos (fase 2). O XP vem de registrar, nunca do valor registrado.
export const XP_POR_REFEICAO = 5;
export const MAX_REFEICOES = 4;
export const XP_POR_CAMINHADA = 10; // caminhada pós-refeição
export const MAX_CAMINHADAS = 3;
export const XP_SONO = 5; // uma vez por dia
export const XP_MEDIDA = 5; // peso/cintura, uma vez por dia
export const XP_INSULINA = 5; // uma vez por dia, qualquer que seja o número de aplicações

export interface AtividadeDoDia {
  /** Treinos concluídos + 1 se houve pausa legítima. Limitado a 2. */
  sessoes: number;
  /** Checagens de glicose feitas antes de treinar. */
  checagens: number;
  /** Medições de glicose registradas (qualquer valor). */
  glicoses: number;
  aguaMl: number;
  metaAguaMl: number;
  /** O dia está garantido para a sequência (treino, pausa ou descanso). */
  garantido: boolean;
  /** Sequência contando com este dia. */
  sequencia: number;
  refeicoes?: number;
  caminhadas?: number;
  sono?: boolean;
  medida?: boolean;
  insulina?: boolean;
}

export function bonusDeSequencia(sequencia: number): number {
  return Math.min(MAX_BONUS_SEQUENCIA, XP_BONUS_POR_DIA_DE_SEQUENCIA * sequencia);
}

/** XP de um dia, separado por origem, para o app mostrar de onde veio cada ponto. */
export function xpDoDia(a: AtividadeDoDia) {
  const partes = {
    treinos: Math.min(a.sessoes, MAX_SESSOES) * XP_POR_SESSAO,
    checagens: Math.min(a.checagens, MAX_CHECAGENS) * XP_POR_CHECAGEM,
    glicose: Math.min(a.glicoses, MAX_GLICOSES) * XP_POR_GLICOSE,
    agua: xpAgua(a.aguaMl, a.metaAguaMl),
    dia: a.garantido ? XP_DIA_GARANTIDO : 0,
    bonus: a.garantido ? bonusDeSequencia(a.sequencia) : 0,
    habitos:
      Math.min(a.refeicoes ?? 0, MAX_REFEICOES) * XP_POR_REFEICAO +
      Math.min(a.caminhadas ?? 0, MAX_CAMINHADAS) * XP_POR_CAMINHADA +
      (a.sono ? XP_SONO : 0) +
      (a.medida ? XP_MEDIDA : 0) +
      (a.insulina ? XP_INSULINA : 0),
  };
  const total = Object.values(partes).reduce((s, v) => s + v, 0);
  return { total, partes };
}

// ---------- Sequência ----------

export type SituacaoDia = "cumprido" | "pausa" | "descanso" | "vazio";
export type ResultadoDia = "cumprido" | "pausa" | "descanso" | "congelado" | "perdido" | "pendente";

export const DIAS_PARA_GANHAR_CONGELAMENTO = 7;
export const MAX_CONGELAMENTOS = 2;

export interface DiaDaSequencia {
  dia: string;
  resultado: ResultadoDia;
  /** Sequência ao fim deste dia. */
  sequencia: number;
}

export interface EstadoSequencia {
  dias: DiaDaSequencia[];
  /** Sequência atual (inclui hoje só se hoje já estiver garantido). */
  atual: number;
  recorde: number;
  congelamentos: number;
  /** Quantos dias garantidos faltam para ganhar o próximo congelamento. */
  diasParaProximoCongelamento: number;
}

/**
 * Percorre todos os dias desde o primeiro uso até hoje e calcula a sequência.
 * - Dia garantido (treino, pausa legítima ou descanso planejado): sobe 1.
 * - Dia vazio no passado: usa um congelamento se houver; senão a sequência cai pela metade.
 * - Hoje vazio: ainda está pendente, não conta como falta.
 */
export function calcularSequencia(
  primeiroDia: string,
  hoje: string,
  situacaoDe: (dia: string) => SituacaoDia,
  /** Congelamentos comprados na loja naquele dia (Poção de Gelo). */
  compradosEm: (dia: string) => number = () => 0,
): EstadoSequencia {
  const dias: DiaDaSequencia[] = [];
  let sequencia = 0;
  let recorde = 0;
  let congelamentos = 0;
  let garantidosDesdeUltimoCongelamento = 0;

  for (let dia = primeiroDia; dia <= hoje; dia = somarDias(dia, 1)) {
    const situacao = situacaoDe(dia);
    let resultado: ResultadoDia;
    congelamentos = Math.min(MAX_CONGELAMENTOS, congelamentos + compradosEm(dia));

    if (situacao !== "vazio") {
      resultado = situacao;
      sequencia += 1;
      garantidosDesdeUltimoCongelamento += 1;
      if (garantidosDesdeUltimoCongelamento >= DIAS_PARA_GANHAR_CONGELAMENTO) {
        congelamentos = Math.min(MAX_CONGELAMENTOS, congelamentos + 1);
        garantidosDesdeUltimoCongelamento = 0;
      }
    } else if (dia === hoje) {
      resultado = "pendente";
    } else if (congelamentos > 0) {
      resultado = "congelado";
      congelamentos -= 1;
    } else {
      resultado = "perdido";
      sequencia = Math.floor(sequencia / 2);
      garantidosDesdeUltimoCongelamento = 0;
    }

    recorde = Math.max(recorde, sequencia);
    dias.push({ dia, resultado, sequencia });
  }

  return {
    dias,
    atual: sequencia,
    recorde,
    congelamentos,
    diasParaProximoCongelamento: DIAS_PARA_GANHAR_CONGELAMENTO - garantidosDesdeUltimoCongelamento,
  };
}

/** O que acontece com a sequência se hoje ficar vazio. Mostrado na tela para motivar. */
export function seFaltarHoje(estado: EstadoSequencia) {
  if (estado.congelamentos > 0) {
    return { usaCongelamento: true, sequenciaDepois: estado.atual };
  }
  return { usaCongelamento: false, sequenciaDepois: Math.floor(estado.atual / 2) };
}

// ---------- Níveis ----------

/** XP necessário para sair do nível n e chegar ao n+1: 300, 400, 500... */
export function custoDoNivel(nivel: number): number {
  return 300 + 100 * (nivel - 1);
}

/** Converte o XP total em nível e progresso dentro do nível. O nível nunca desce. */
export function nivelDeXp(xpTotal: number): { nivel: number; xpNoNivel: number; xpParaProximo: number } {
  let nivel = 1;
  let resto = Math.max(0, xpTotal);
  while (resto >= custoDoNivel(nivel)) {
    resto -= custoDoNivel(nivel);
    nivel += 1;
  }
  return { nivel, xpNoNivel: resto, xpParaProximo: custoDoNivel(nivel) };
}
