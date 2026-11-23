// Brasa: a companheira do jogo. Lógica pura (sem tela e sem banco), para dar para testar.
//
// Ideia central: o estado físico dela espelha o seu dia (sono, água, treino, comida),
// mas o carinho dela por você nunca diminui. Faltar não deixa a Brasa triste nem brava:
// só faz ela não crescer naquele dia.

export type Refeicao = "manha" | "almoco" | "noite";

export interface RefeicaoBrasa {
  /** `${dia}-${refeicao}`: uma por refeição em cada dia. */
  id: string;
  dia: string;
  refeicao: Refeicao;
  criadoEm: string;
}

/** Horários em que dá para alimentar a Brasa (hora local, início incluído, fim não). */
export const JANELAS: Record<Refeicao, { inicio: number; fim: number; nome: string }> = {
  manha: { inicio: 5, fim: 11, nome: "Café da manhã" },
  almoco: { inicio: 11, fim: 15, nome: "Almoço" },
  noite: { inicio: 17, fim: 22, nome: "Jantar" },
};

export function janelaAberta(agora: Date): Refeicao | null {
  const h = agora.getHours();
  for (const [r, j] of Object.entries(JANELAS) as [Refeicao, (typeof JANELAS)[Refeicao]][]) if (h >= j.inicio && h < j.fim) return r;
  return null;
}

/** Próxima refeição do dia depois de agora (para mostrar "próxima às 17h"). */
export function proximaJanela(agora: Date): Refeicao | null {
  const h = agora.getHours();
  for (const [r, j] of Object.entries(JANELAS) as [Refeicao, (typeof JANELAS)[Refeicao]][]) if (h < j.inicio) return r;
  return null;
}

// ---------- Crescimento ----------

/** Dias com treino concluído para chegar a cada estágio. O crescimento nunca volta. */
export const ESTAGIOS = [
  { n: 1, nome: "Pequena Brasa", aPartirDe: 0 },
  { n: 2, nome: "Chama Crescente", aPartirDe: 21 },
  { n: 3, nome: "Salamandra Ardente", aPartirDe: 60 },
] as const;
export type NumeroEstagio = 1 | 2 | 3;

export function estagioDe(diasCumpridos: number) {
  let atual: (typeof ESTAGIOS)[number] = ESTAGIOS[0];
  for (const e of ESTAGIOS) if (diasCumpridos >= e.aPartirDe) atual = e;
  const proximo = ESTAGIOS.find((e) => e.aPartirDe > diasCumpridos);
  return {
    n: atual.n as NumeroEstagio,
    nome: atual.nome,
    proximo: proximo ? { nome: proximo.nome, faltam: proximo.aPartirDe - diasCumpridos, progresso: (diasCumpridos - atual.aPartirDe) / (proximo.aPartirDe - atual.aPartirDe) } : null,
  };
}

// ---------- Humor / pose ----------

export type Humor =
  | "feliz"
  | "animada"
  | "energia"
  | "cansada"
  | "dormindo"
  | "fome"
  | "satisfeita"
  | "sede"
  | "hidratada"
  | "fraca"
  | "doente"
  | "curiosa"
  | "carinhosa"
  | "irritada";

export interface EntradaBrasa {
  agora: Date;
  treinouHoje: boolean;
  /** Dias desde o último treino concluído (0 = hoje). Sem treino nenhum ainda: undefined. */
  diasSemTreino?: number;
  /** Marcou pausa legítima hoje (doente, lesão...). */
  pausaHoje: boolean;
  /** Horas da última noite (do relógio ou registro). */
  sonoHoras?: number;
  aguaMl: number;
  metaAguaMl: number;
  refeicoesHoje: Refeicao[];
  /** Quando foi a última vez que você alimentou a Brasa (ISO). */
  ultimaRefeicaoEm?: string;
}

/** Escolhe o humor de agora. A ordem importa: o primeiro que valer ganha. */
export function humorDe(e: EntradaBrasa): Humor {
  const h = e.agora.getHours();
  if (e.pausaHoje) return "doente";
  if (h >= 23 || h < 5) return "dormindo";
  const janela = janelaAberta(e.agora);
  if (janela && !e.refeicoesHoje.includes(janela)) return "fome";
  if (e.ultimaRefeicaoEm && e.agora.getTime() - new Date(e.ultimaRefeicaoEm).getTime() < 30 * 60_000) return "satisfeita";
  if (e.treinouHoje) return "animada";
  const meta = e.metaAguaMl || 1;
  if ((h >= 13 && e.aguaMl < meta * 0.35) || (h >= 18 && e.aguaMl < meta * 0.6)) return "sede";
  if (e.sonoHoras !== undefined && e.sonoHoras < 6 && h < 15) return "cansada";
  if ((e.diasSemTreino ?? 0) >= 3) return "fraca";
  if (e.aguaMl >= meta) return "hidratada";
  if (e.sonoHoras !== undefined && e.sonoHoras >= 7) return "energia";
  return "feliz";
}

/**
 * Imagem de cada humor em cada estágio (arquivos em public/brasa).
 * Nos estágios 2 e 3 não há desenho de fome e sede: usa outra pose e mostra um balãozinho.
 */
const POSES: Record<NumeroEstagio, Record<Humor, string>> = {
  1: {
    feliz: "e1-feliz",
    animada: "e1-animada",
    energia: "e1-com-energia",
    cansada: "e1-cansada",
    dormindo: "e1-dormindo",
    fome: "e1-com-fome",
    satisfeita: "e1-satisfeita",
    sede: "e1-com-sede",
    hidratada: "e1-bem-hidratada",
    fraca: "e1-fraca",
    doente: "e1-doente",
    curiosa: "e1-curiosa",
    carinhosa: "e1-carinhosa",
    irritada: "e1-irritada",
  },
  2: {
    feliz: "e2-feliz",
    animada: "e2-animada",
    energia: "e2-brincando",
    cansada: "e2-cansada",
    dormindo: "e2-cansada",
    fome: "e2-curiosa",
    satisfeita: "e2-feliz",
    sede: "e2-curiosa",
    hidratada: "e2-feliz",
    fraca: "e2-cansada",
    doente: "e2-cansada",
    curiosa: "e2-curiosa",
    carinhosa: "e2-feliz",
    irritada: "e2-bufando",
  },
  3: {
    feliz: "e3-feliz",
    animada: "e3-rugindo",
    energia: "e3-pronta",
    cansada: "e3-dormindo",
    dormindo: "e3-dormindo",
    fome: "e3-base",
    satisfeita: "e3-carinhosa",
    sede: "e3-base",
    hidratada: "e3-feliz",
    fraca: "e3-dormindo",
    doente: "e3-dormindo",
    curiosa: "e3-base",
    carinhosa: "e3-carinhosa",
    irritada: "e3-irritada",
  },
};

export function poseDe(estagio: NumeroEstagio, humor: Humor): { arquivo: string; balao?: string } {
  const arquivo = POSES[estagio][humor];
  const balao = estagio > 1 ? ({ fome: "🍖", sede: "💧", doente: "🤒" } as Partial<Record<Humor, string>>)[humor] : undefined;
  return { arquivo, balao };
}

// ---------- Falas ----------
// Curtas, carinhosas, sem cobrança. Nunca chamam você de preguiçoso nem dizem que ela sofre.

export type Situacao = Humor | "toque" | "toqueDemais" | "alimentou" | "semJanela";

export const FALAS: Record<Situacao, string[]> = {
  feliz: [
    "Olá, companheiro! Como está nossa aventura?",
    "Hoje estou especialmente brilhante. Não precisa agradecer.",
    "Ei, estou aqui. Vamos enfrentar esse dia juntos?",
    "Tenho quase certeza de que aquela almofada está escondendo alguma coisa.",
  ],
  animada: [
    "ISSO! MAIS UMA VITÓRIA PARA NOSSA GUILDA!",
    "Você está ficando mais forte! Consigo sentir daqui!",
    "Treinamento concluído! Isso merece uma dança da vitória!",
    "Seus músculos estão evoluindo. Minha cauda também está!",
  ],
  energia: [
    "BOM DIA! Sua chama está brilhando muito hoje!",
    "Descansamos muito bem. Estou cheia de energia!",
    "Hoje parece um ótimo dia para uma aventura!",
    "Até minhas escamas estão mais brilhantes!",
  ],
  cansada: [
    "Uaaah... acho que nenhum de nós descansou direito.",
    "Talvez hoje seja um dia para pegar mais leve, companheiro.",
    "Não dá para enfrentar todos os dragões depois de uma noite ruim.",
    "Vamos tentar recuperar nossas forças hoje?",
  ],
  dormindo: [
    "Zzz... prometo guardar nossa chama enquanto você dorme.",
    "Minha chama está baixinha... hora de descansar.",
    "Uma boa aventura precisa de uma boa noite de sono!",
  ],
  fome: [
    "Ei, ei! Minha barriga está roncando que nem um ogro.",
    "Acho que temos uma missão: encontrar comida quentinha!",
    "Hora de comer! Algo assado, de preferência.",
    "Pelas chamas antigas, que fome!",
  ],
  satisfeita: [
    "Ahhh, que delícia. Obrigada, parceiro!",
    "Barriguinha cheia, chama acesa.",
    "Acho que vou derreter de felicidade... e olha que sou feita de fogo!",
  ],
  sede: [
    "Ei, companheiro... que tal uma pausa para beber água?",
    "Você cuida de mim e eu cuido de você. Combinado?",
    "Pelas chamas antigas! Até eu estou lembrando de beber água!",
    "Acho que está na hora de uma pequena reposição de energia!",
  ],
  hidratada: [
    "Muito bem! Tudo em equilíbrio por aqui.",
    "Você está cuidando direitinho da nossa aventura!",
    "Eu também quero uma gotinha! Mas só uma... ou três.",
  ],
  fraca: [
    "Faz um tempinho que não visitamos o campo de treinamento.",
    "Que tal movimentar um pouquinho o corpo hoje?",
    "Não precisa ser um treino lendário. Um pequeno começo já vale!",
    "Estou ficando entediada sem nossas aventuras!",
  ],
  doente: [
    "Hoje é dia de cobertor. Até os maiores guerreiros precisam descansar.",
    "Nem toda aventura precisa de batalha. Fica quietinho, eu fico aqui.",
    "Descansar não é fraqueza, é parte do treinamento.",
  ],
  curiosa: ["Humm... suspeito.", "O que é aquilo ali? Parece um monstro pequeno."],
  carinhosa: ["Gosto quando passamos um tempo juntos.", "Você é um bom companheiro."],
  irritada: ["Ei! Minha cauda não é um botão!", "Vou começar a cobrar por essas cócegas!"],
  toque: ["Hehehe! Isso faz cócegas!", "Mais carinho! Mais carinho!", "Você parece muito interessado nas minhas escamas.", "Sou uma salamandra elemental! Não uma lagartixa comum!"],
  toqueDemais: ["Ei! Minha cauda não é um botão!", "Hehehe! Já entendi!", "Vou começar a cobrar por essas cócegas!"],
  alimentou: ["Nham! Isso merece uma comemoração!", "Que delícia! Você é o melhor chefe de cozinha da guilda.", "Barriguinha cheia, chama acesa!"],
  semJanela: ["Ainda estou de barriguinha cheia. Volta na próxima refeição!"],
};

/** Número estável a partir de um texto, para variar a fala sem mudar a cada segundo. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Fala da situação. A mesma semente dá a mesma fala; mudar a semente (outro toque, outra hora) troca. */
export function falaDe(situacao: Situacao, semente: string): string {
  const lista = FALAS[situacao];
  return lista[hash(situacao + semente) % lista.length];
}
