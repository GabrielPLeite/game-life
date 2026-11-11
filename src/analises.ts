// Estatísticas para a aba de análises e o relatório. Funções puras.
// Atenção: com medições de ponta de dedo, "tempo no alvo" é a porcentagem das MEDIÇÕES no alvo,
// não do tempo real (isso só um sensor contínuo mede).

export interface EstatisticasGlicose {
  leituras: number;
  media: number | null;
  desvioPadrao: number | null;
  /** Coeficiente de variação, em %. Abaixo de 36% costuma ser considerado estável. */
  cv: number | null;
  noAlvoPct: number | null;
  abaixo: number;
  acima: number;
}

export function estatisticasGlicose(valores: number[], alvoMin: number, alvoMax: number): EstatisticasGlicose {
  const n = valores.length;
  if (n === 0) return { leituras: 0, media: null, desvioPadrao: null, cv: null, noAlvoPct: null, abaixo: 0, acima: 0 };
  const media = valores.reduce((s, v) => s + v, 0) / n;
  const dp = n > 1 ? Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)) : 0;
  const abaixo = valores.filter((v) => v < alvoMin).length;
  const acima = valores.filter((v) => v > alvoMax).length;
  return {
    leituras: n,
    media: Math.round(media),
    desvioPadrao: Math.round(dp),
    cv: Math.round((dp / media) * 100),
    noAlvoPct: Math.round(((n - abaixo - acima) / n) * 100),
    abaixo,
    acima,
  };
}

export const MINIMO_DE_DIAS_POR_GRUPO = 3;

/**
 * Compara a média de um valor entre dois grupos de dias (ex.: com e sem treino).
 * Só responde quando cada grupo tem pelo menos 3 dias. Correlação não é causa.
 */
export function compararGrupos(dias: { grupo: boolean; valor: number | null }[]) {
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);
  const sim = dias.filter((d) => d.grupo && d.valor !== null).map((d) => d.valor!);
  const nao = dias.filter((d) => !d.grupo && d.valor !== null).map((d) => d.valor!);
  const suficiente = sim.length >= MINIMO_DE_DIAS_POR_GRUPO && nao.length >= MINIMO_DE_DIAS_POR_GRUPO;
  return { suficiente, comMedia: media(sim), semMedia: media(nao), diasCom: sim.length, diasSem: nao.length };
}

/** Transforma linhas em texto CSV (separador ";" e vírgula decimal, como o Excel em português abre). */
export function paraCsv(linhas: Record<string, string | number | undefined | null>[]): string {
  if (linhas.length === 0) return "";
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const celula = (v: unknown) => {
    if (v === undefined || v === null) return "";
    const t = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(";"))].join("\n");
}
