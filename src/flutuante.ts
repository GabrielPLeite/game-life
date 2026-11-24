// Brasa fora do app: bolinha flutuante no celular (app Android br.gleite.glicose) e janelinha no PC.
// Lógica pura: o que mandar para a bolinha do celular.

import { poseDe, type Humor, type NumeroEstagio, type Refeicao } from "./brasa";

export interface EstadoBolinha {
  estagio: NumeroEstagio;
  humor: Humor;
  refeicoesHoje: Refeicao[];
  /** Dia do jogo (AAAA-MM-DD). A bolinha só confia nas refeições se for o mesmo dia dela. */
  dia: string;
}

/**
 * Link que liga (ou atualiza) a bolinha da Brasa no celular.
 * Manda a pose de agora e as poses de fome e de sono, para a bolinha trocar sozinha
 * quando abrir uma janela de refeição ou chegar a noite, mesmo com o Game Life fechado.
 * Se o app do celular não estiver instalado, o Chrome volta para `voltarPara#bolinha=sem-app`.
 */
export function linkBolinha(voltarPara: string, s: EstadoBolinha): string {
  const q = new URLSearchParams({
    e: String(s.estagio),
    p: poseDe(s.estagio, s.humor).arquivo,
    pf: poseDe(s.estagio, "fome").arquivo,
    pd: poseDe(s.estagio, "dormindo").arquivo,
    pb: poseDe(s.estagio, "feliz").arquivo,
    r: s.refeicoesHoje.join(","),
    d: s.dia,
  });
  const fallback = encodeURIComponent(`${voltarPara}#bolinha=sem-app`);
  return `intent://brasa?${q}#Intent;scheme=glicoserelogio;package=br.gleite.glicose;S.browser_fallback_url=${fallback};end`;
}

export const ehAndroid = (ua: string) => /Android/i.test(ua);
