// Regras do jogo. São funções "puras": recebem números e devolvem números,
// sem tocar no banco de dados. Assim é fácil testar e mudar uma regra depois.

/** Hora em que o dia "vira". Antes das 3h ainda conta como o dia anterior. */
export const HORA_DE_VIRADA = 3;

/** Tamanho do copo usado para pontuar a água. */
export const ML_POR_COPO = 250;
export const XP_POR_COPO = 2;
export const XP_META_AGUA = 10;

/** Meta de água inicial (o usuário pode mudar nas configurações). */
export const META_AGUA_PADRAO_ML = 2500;

/** Devolve o dia do jogo no formato AAAA-MM-DD, respeitando a virada às 3h. */
export function diaLogico(agora: Date = new Date()): string {
  const d = new Date(agora.getTime() - HORA_DE_VIRADA * 60 * 60 * 1000);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

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
