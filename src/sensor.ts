// Ponte com o app "Glicose" (o app do celular que leva o sensor Libre ao relógio).
// Funções puras: ler o pacote que o app Glicose devolve, montar o link do botão e calcular tempo no alvo.
//
// Regras do projeto que este arquivo respeita:
// - O Game Life NUNCA fala com o LibreLinkUp nem com o sensor. Quem fala é só o app Glicose.
// - Nada roda em segundo plano: os dados só chegam quando você toca em "Puxar do sensor".
import { HORA_DE_VIRADA, diaLogico } from "./regras";

/** Faixa do consenso internacional para tempo no alvo com sensor (a mesma do gráfico do relógio). */
export const ALVO_SENSOR_MIN = 70;
export const ALVO_SENSOR_MAX = 180;
/** Leitura mais velha que isso não serve para pré-preencher a checagem do treino. */
export const LEITURA_RECENTE_MIN = 15;
/** Uma leitura "vale" por no máximo 15 min (intervalo do histórico do LibreLinkUp). Mais que isso é buraco. */
const VALIDADE_LEITURA_MS = 15 * 60 * 1000;
/** Abaixo desta cobertura do dia, o app mostra "poucos dados" em vez de um número enganoso. */
export const COBERTURA_MINIMA_PCT = 50;

/** Uma leitura do sensor guardada no Game Life. O horário (ts) é a chave: puxar de novo não duplica. */
export interface LeituraSensor {
  /** Horário da leitura, em milissegundos desde 1970. */
  ts: number;
  /** Dia do jogo (virada às 3h). */
  dia: string;
  /** mg/dL */
  valor: number;
}

/** 1 = caindo rápido, 2 = caindo, 3 = estável, 4 = subindo, 5 = subindo rápido, 0 = sem informação. */
export type Tendencia = 0 | 1 | 2 | 3 | 4 | 5;

export const SETAS: Record<Tendencia, string> = { 0: "", 1: "↓", 2: "↘", 3: "→", 4: "↗", 5: "↑" };
export const NOMES_TENDENCIA: Record<Tendencia, string> = {
  0: "sem tendência",
  1: "caindo rápido",
  2: "caindo",
  3: "estável",
  4: "subindo",
  5: "subindo rápido",
};

export interface PacoteSensor {
  tendencia: Tendencia;
  /** O serviço do app Glicose estava ligado no momento em que você puxou. */
  servicoLigado: boolean;
  /** Última vez que o app Glicose conseguiu consultar a nuvem (ms), se houver. */
  ultimaConsulta?: number;
  atual?: { ts: number; valor: number };
  leituras: { ts: number; valor: number }[];
}

export type ResultadoPacote = { ok: true; pacote: PacoteSensor } | { ok: false; motivo: "sem-app" | "erro" | "invalido" };

const valorValido = (v: number) => Number.isInteger(v) && v >= 20 && v <= 600;

/**
 * Lê o texto que vem depois de "#sensor=" no endereço. Formato (igual ao GameLifeExport.kt do app Glicose):
 *   v1.T.R.S.B.C.L
 * T tendência, R serviço ligado (0/1), S última consulta (s), B horário base (s),
 * C atual "seg:mgdl", L histórico "seg:mgdl,seg:mgdl,...". Os "seg" contam a partir de B.
 * Descarta leituras com valor absurdo ou horário no futuro/mais de 2 dias atrás.
 */
export function lerPacote(texto: string, agora = Date.now()): ResultadoPacote {
  if (texto === "sem-app") return { ok: false, motivo: "sem-app" };
  if (texto === "erro") return { ok: false, motivo: "erro" };
  const partes = texto.split(".");
  if (partes.length !== 7 || partes[0] !== "v1") return { ok: false, motivo: "invalido" };
  const [, t, r, s, b, c, l] = partes;
  const base = Number(b);
  const tendencia = Number(t);
  if (!Number.isFinite(base) || !Number.isInteger(tendencia) || tendencia < 0 || tendencia > 5) return { ok: false, motivo: "invalido" };

  const minimo = agora - 2 * 24 * 60 * 60 * 1000;
  const maximo = agora + 5 * 60 * 1000;
  const item = (x: string) => {
    const [seg, mg] = x.split(":").map(Number);
    const ts = (base + seg) * 1000;
    return Number.isFinite(ts) && ts >= minimo && ts <= maximo && valorValido(mg) ? { ts, valor: mg } : null;
  };
  const leituras = (l ? l.split(",") : []).map(item).filter((x): x is { ts: number; valor: number } => x !== null);
  const atual = c ? item(c) ?? undefined : undefined;
  const ultima = Number(s) * 1000;
  return {
    ok: true,
    pacote: {
      tendencia: tendencia as Tendencia,
      servicoLigado: r === "1",
      ultimaConsulta: ultima > 0 ? ultima : undefined,
      atual,
      leituras,
    },
  };
}

/** Junta histórico e leitura atual, sem horários repetidos, já com o dia do jogo de cada uma. */
export function paraGuardar(p: PacoteSensor): LeituraSensor[] {
  const porTs = new Map<number, number>();
  for (const x of [...p.leituras, ...(p.atual ? [p.atual] : [])]) porTs.set(x.ts, x.valor);
  return [...porTs].sort((a, b) => a[0] - b[0]).map(([ts, valor]) => ({ ts, valor, dia: diaLogico(new Date(ts)) }));
}

/**
 * Link do botão "Puxar do sensor". O Android abre o app Glicose (pacote br.gleite.glicose),
 * que devolve os dados abrindo o Game Life em `voltarPara#sensor=...`.
 * Se o app Glicose não estiver instalado, o Chrome abre `voltarPara#sensor=sem-app`.
 */
export function linkPuxarDoSensor(voltarPara: string): string {
  const fallback = encodeURIComponent(`${voltarPara}#sensor=sem-app`);
  return `intent://exportar#Intent;scheme=glicoserelogio;package=br.gleite.glicose;S.browser_fallback_url=${fallback};end`;
}

/** A leitura mais nova, se tiver no máximo `maxMin` minutos. */
export function leituraRecente(leituras: LeituraSensor[], agora = Date.now(), maxMin = LEITURA_RECENTE_MIN): LeituraSensor | undefined {
  const ultima = leituras.reduce<LeituraSensor | undefined>((m, x) => (!m || x.ts > m.ts ? x : m), undefined);
  return ultima && agora - ultima.ts <= maxMin * 60 * 1000 && ultima.ts <= agora + 5 * 60 * 1000 ? ultima : undefined;
}

export interface TempoNoAlvo {
  /** % do período com dados do sensor. */
  coberturaPct: number;
  /** Só é confiável com cobertura de pelo menos COBERTURA_MINIMA_PCT. */
  suficiente: boolean;
  noAlvoPct: number | null;
  abaixoPct: number | null;
  acimaPct: number | null;
  media: number | null;
  leituras: number;
}

/**
 * Tempo no alvo de verdade (por tempo, não por número de medições):
 * cada leitura vale até a próxima, por no máximo 15 min. Intervalos sem leitura são buracos e não contam.
 */
export function tempoNoAlvo(leituras: LeituraSensor[], inicio: number, fim: number, min = ALVO_SENSOR_MIN, max = ALVO_SENSOR_MAX): TempoNoAlvo {
  const xs = leituras.filter((x) => x.ts >= inicio && x.ts < fim).sort((a, b) => a.ts - b.ts);
  let coberto = 0;
  let alvo = 0;
  let abaixo = 0;
  let acima = 0;
  let soma = 0;
  xs.forEach((x, i) => {
    const proxima = i + 1 < xs.length ? xs[i + 1].ts : fim;
    const dur = Math.max(0, Math.min(proxima, x.ts + VALIDADE_LEITURA_MS, fim) - x.ts);
    coberto += dur;
    soma += x.valor * dur;
    if (x.valor < min) abaixo += dur;
    else if (x.valor > max) acima += dur;
    else alvo += dur;
  });
  const total = fim - inicio;
  const coberturaPct = total > 0 ? Math.round((coberto / total) * 100) : 0;
  const pct = (v: number) => (coberto > 0 ? Math.round((v / coberto) * 100) : null);
  return {
    coberturaPct,
    suficiente: coberturaPct >= COBERTURA_MINIMA_PCT,
    noAlvoPct: pct(alvo),
    abaixoPct: pct(abaixo),
    acimaPct: pct(acima),
    media: coberto > 0 ? Math.round(soma / coberto) : null,
    leituras: xs.length,
  };
}

/** Início do dia do jogo (virada às 3h da manhã) em ms. "dia" no formato AAAA-MM-DD. */
export function inicioDoDiaDoJogo(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d, HORA_DE_VIRADA, 0, 0, 0).getTime();
}

/** Tempo no alvo de um dia do jogo. Se for hoje, conta só até agora. */
export function tempoNoAlvoDoDia(leituras: LeituraSensor[], dia: string, agora = Date.now()): TempoNoAlvo {
  const inicio = inicioDoDiaDoJogo(dia);
  const fim = Math.min(inicio + 24 * 60 * 60 * 1000, agora);
  return tempoNoAlvo(leituras, inicio, fim);
}

export interface EpisodioAbaixo {
  inicio: number;
  fim: number;
  minimo: number;
}

/**
 * Episódios abaixo de `limite` que duraram pelo menos `minimoMin` minutos (padrão do consenso: 15 min).
 * Um buraco de mais de 15 min sem leitura encerra o episódio.
 */
export function episodiosAbaixo(leituras: LeituraSensor[], limite = ALVO_SENSOR_MIN, minimoMin = 15): EpisodioAbaixo[] {
  const xs = [...leituras].sort((a, b) => a.ts - b.ts);
  const episodios: EpisodioAbaixo[] = [];
  let atual: EpisodioAbaixo | null = null;
  const fechar = () => {
    if (atual && atual.fim - atual.inicio >= minimoMin * 60 * 1000) episodios.push(atual);
    atual = null;
  };
  for (const x of xs) {
    if (atual && x.ts - atual.fim > VALIDADE_LEITURA_MS) fechar();
    if (x.valor < limite) {
      if (!atual) atual = { inicio: x.ts, fim: x.ts, minimo: x.valor };
      else {
        atual.fim = x.ts;
        atual.minimo = Math.min(atual.minimo, x.valor);
      }
    } else fechar();
  }
  fechar();
  return episodios;
}
