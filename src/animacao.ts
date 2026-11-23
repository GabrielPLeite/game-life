// Animações da Brasa por quadros (folhas em public/brasa/anim, geradas por ferramentas/brasa_video.py).
// Lógica pura: qual animação tocar agora. A tela só reproduz.
//
// Camadas, da mais forte para a mais fraca:
//   1. reação (comemorar, carinho...) — toca até o fim, não é interrompida
//   2. gesto espontâneo (piscar, olhar em volta) — só por cima do repouso
//   3. base do humor (repouso, cansada, dormindo...) — em loop, nunca some
// Se não houver animação para o humor de agora, a tela usa a pose parada de sempre.

import type { Humor, NumeroEstagio } from "./brasa";

export interface Animacao {
  arquivo: string;
  quadros: number;
  fps: number;
  loop: boolean;
  largura: number;
  altura: number;
  /** Quadros ficam em grade, da esquerda para a direita e de cima para baixo. */
  colunas?: number;
  linhas?: number;
}
/** { e1: { idle: {...}, piscar: {...} }, e2: {...} } */
export type Catalogo = Record<string, Record<string, Animacao>>;

/**
 * Animação de base para cada humor, em ordem de preferência.
 * Humores de necessidade (fome, sede, doente) só usam animação própria: o repouso
 * comum esconderia o balãozinho que avisa o que ela precisa.
 */
const BASE: Record<Humor, string[]> = {
  feliz: ["feliz", "idle"],
  animada: ["animada", "feliz", "idle"],
  energia: ["animada", "idle"],
  hidratada: ["feliz", "idle"],
  curiosa: ["curiosa", "idle"],
  carinhosa: ["carinho", "feliz", "idle"],
  satisfeita: ["feliz", "idle"],
  cansada: ["cansada"],
  fraca: ["cansada"],
  dormindo: ["dormindo"],
  doente: ["dormindo"],
  fome: ["fome"],
  sede: ["sede"],
  irritada: ["irritada"],
};

/** Bases sobre as quais os gestos espontâneos (piscar, olhar) podem aparecer. */
const ACEITA_GESTOS = new Set(["idle", "feliz", "curiosa"]);

export type Evento = "toque" | "alimentou" | "treinou" | "evoluiu";
const REACOES: Record<Evento, string[]> = {
  toque: ["carinho", "feliz"],
  alimentou: ["feliz", "comemorar"],
  treinou: ["comemorar", "feliz"],
  evoluiu: ["evoluir", "comemorar"],
};
/** Reações que não podem ser cortadas por outra no meio. */
export const NAO_INTERROMPE = new Set(["comemorar", "evoluir"]);

const doEstagio = (cat: Catalogo | undefined, estagio: NumeroEstagio) => cat?.[`e${estagio}`] ?? {};
const primeira = (nomes: string[], disponiveis: Record<string, Animacao>) => nomes.find((n) => n in disponiveis) ?? null;

export function animacaoBase(cat: Catalogo | undefined, estagio: NumeroEstagio, humor: Humor): string | null {
  return primeira(BASE[humor], doEstagio(cat, estagio));
}

export function reacaoPara(cat: Catalogo | undefined, estagio: NumeroEstagio, evento: Evento): string | null {
  return primeira(REACOES[evento], doEstagio(cat, estagio));
}

/** Gesto espontâneo para agora, se a base aceitar: piscar quase sempre, às vezes olhar em volta. */
export function gestoEspontaneo(cat: Catalogo | undefined, estagio: NumeroEstagio, base: string, sorte: number): string | null {
  if (!ACEITA_GESTOS.has(base)) return null;
  const d = doEstagio(cat, estagio);
  if (sorte < 0.25 && "olhar" in d) return "olhar";
  return "piscar" in d ? "piscar" : null;
}

/** Espera até o próximo gesto: de 3 a 7 segundos, sorteado para não parecer robô. */
export const esperaGesto = (sorte: number) => 3000 + sorte * 4000;
