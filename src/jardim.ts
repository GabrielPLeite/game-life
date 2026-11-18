// Jardim: cada vaso é uma planta que cresce a cada dia de rega seguido.
// Função pura: recebe as regas e devolve quantos dias seguidos, o recorde e o estágio da planta.
import { somarDias } from "./regras";

/** Plantas que podem ir para um vaso. O nome do vaso é o nome da planta. */
export const ESPECIES = ["Samambaia", "Cacto", "Hera", "Lavanda", "Bonsai", "Alecrim"] as const;

/** Estágios da planta pelo número de dias seguidos. */
export const ESTAGIOS = [
  { desde: 0, nome: "Semente" },
  { desde: 1, nome: "Broto" },
  { desde: 3, nome: "Muda" },
  { desde: 7, nome: "Planta" },
  { desde: 14, nome: "Arbusto" },
  { desde: 30, nome: "Árvore" },
  { desde: 90, nome: "Árvore em flor" },
] as const;

export function estagio(dias: number): { indice: number; nome: string; proximo?: number } {
  let indice = 0;
  ESTAGIOS.forEach((e, i) => {
    if (dias >= e.desde) indice = i;
  });
  return { indice, nome: ESTAGIOS[indice].nome, proximo: ESTAGIOS[indice + 1]?.desde };
}

export interface RegaNoDia {
  dia: string;
  regou: boolean;
}

/**
 * Conta os dias seguidos desde o início do vaso ou desde o último "não reguei".
 * Dia sem resposta conta como regado: esquecer de responder não derruba a planta.
 * Hoje só entra na conta depois de você responder "reguei".
 * O recorde é a maior sequência já feita neste vaso, incluindo a atual.
 */
export function contarJardim(inicio: string, regas: RegaNoDia[], hoje: string) {
  // Se houver mais de uma resposta no mesmo dia, vale a última da lista.
  const resposta = new Map<string, boolean>();
  for (const r of regas) resposta.set(r.dia, r.regou);
  let atual = 0;
  let recorde = 0;
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, 1)) {
    const r = resposta.get(dia);
    if (r === false) atual = 0;
    else if (dia < hoje || r === true) atual += 1;
    recorde = Math.max(recorde, atual);
  }
  return { dias: atual, recorde, hoje: resposta.get(hoje), ontem: resposta.get(somarDias(hoje, -1)) };
}
