// Camada de RPG: herói, classes, atributos, combate, inimigos, ouro e loja.
// Tudo aqui é função pura e determinística: o estado do jogo é sempre recalculado
// a partir dos registros reais (treinos, água, glicose...), nunca guardado como saldo.
//
// Princípio de segurança mantido: o dano vem de AGIR e REGISTRAR, nunca do valor medido.
// Glicose alta ou baixa causa o mesmo dano. Pausa legítima golpeia igual a um treino.

// ---------- Classes ----------

export type TipoAtaque = "treino" | "pausa" | "checagem" | "caminhada" | "glicose" | "agua" | "sono" | "refeicao" | "medida" | "insulina";

export type Classe = "guerreiro" | "patrulheiro" | "clerigo" | "mago";

export const CLASSES: Record<Classe, { nome: string; descricao: string; bonus: TipoAtaque[]; }> = {
  guerreiro: { nome: "Guerreiro", descricao: "Mestre da força. +2 de dano em treinos.", bonus: ["treino", "pausa"] },
  patrulheiro: { nome: "Patrulheiro", descricao: "Andarilho incansável. +2 de dano em caminhadas e checagens.", bonus: ["caminhada", "checagem"] },
  clerigo: { nome: "Clérigo", descricao: "Guardião do próprio corpo. +2 de dano ao registrar glicose e insulina.", bonus: ["glicose", "insulina"] },
  mago: { nome: "Mago", descricao: "Disciplina e ritual. +2 de dano com água, sono e refeições.", bonus: ["agua", "sono", "refeicao"] },
};
export const BONUS_DE_CLASSE = 2;

// ---------- Títulos por nível ----------

const TITULOS: [number, string][] = [
  [1, "Aldeão"], [2, "Aprendiz"], [3, "Escudeiro"], [5, "Aventureiro"], [8, "Veterano"], [12, "Campeão"], [16, "Herói"], [20, "Lenda"],
];
export function tituloDoNivel(nivel: number): string {
  return TITULOS.filter(([n]) => nivel >= n).at(-1)![1];
}

// ---------- Atributos ----------

export interface TotaisDeVida {
  treinos: number;
  caminhadas: number;
  diasMetaAgua: number;
  diasComGlicose: number;
  refeicoes: number;
  noitesDeSono: number;
  recordeSequencia: number;
}

export interface Atributo { sigla: string; nome: string; valor: number; mod: number; origem: string; }

/** Atributos de 8 a 20, que crescem com o que você faz na vida real. */
export function atributos(t: TotaisDeVida): Atributo[] {
  const a = (sigla: string, nome: string, total: number, passo: number, origem: string): Atributo => {
    const valor = Math.min(20, 8 + Math.floor(total / passo));
    return { sigla, nome, valor, mod: Math.floor((valor - 10) / 2), origem };
  };
  return [
    a("FOR", "Força", t.treinos, 4, "treinos concluídos"),
    a("DES", "Destreza", t.caminhadas, 3, "caminhadas pós-refeição"),
    a("CON", "Constituição", t.diasMetaAgua, 4, "dias com meta de água"),
    a("INT", "Inteligência", t.refeicoes, 8, "refeições registradas"),
    a("SAB", "Sabedoria", t.diasComGlicose, 4, "dias medindo a glicose"),
    a("CAR", "Carisma", t.noitesDeSono + t.recordeSequencia, 5, "sono registrado e recorde de sequência"),
  ];
}

// ---------- Loja ----------

export type Slot = "arma" | "armadura" | "companheiro" | "consumivel";

export interface Item { id: string; nome: string; slot: Slot; preco: number; bonus: number; nivel: number; icone: string; descricao: string; }

export const POCAO_DE_GELO = "pocao-gelo";

export const ITENS: Item[] = [
  { id: "adaga", nome: "Adaga de Ferro", slot: "arma", preco: 60, bonus: 1, nivel: 1, icone: "🗡️", descricao: "+1 de dano em treinos e caminhadas" },
  { id: "espada-curta", nome: "Espada Curta", slot: "arma", preco: 150, bonus: 2, nivel: 2, icone: "⚔️", descricao: "+2 de dano em treinos e caminhadas" },
  { id: "machado", nome: "Machado de Batalha", slot: "arma", preco: 350, bonus: 3, nivel: 4, icone: "🪓", descricao: "+3 de dano em treinos e caminhadas" },
  { id: "lamina-runica", nome: "Lâmina Rúnica", slot: "arma", preco: 800, bonus: 5, nivel: 7, icone: "🔱", descricao: "+5 de dano em treinos e caminhadas" },
  { id: "espada-flamejante", nome: "Espada Flamejante", slot: "arma", preco: 1600, bonus: 7, nivel: 10, icone: "🔥", descricao: "+7 de dano em treinos e caminhadas" },
  { id: "gibao", nome: "Gibão de Couro", slot: "armadura", preco: 80, bonus: 1, nivel: 1, icone: "🦺", descricao: "+1 de dano em treinos e caminhadas" },
  { id: "cota-de-malha", nome: "Cota de Malha", slot: "armadura", preco: 250, bonus: 2, nivel: 3, icone: "⛓️", descricao: "+2 de dano em treinos e caminhadas" },
  { id: "placas", nome: "Armadura de Placas", slot: "armadura", preco: 700, bonus: 4, nivel: 6, icone: "🛡️", descricao: "+4 de dano em treinos e caminhadas" },
  { id: "egide", nome: "Égide Dracônica", slot: "armadura", preco: 1500, bonus: 6, nivel: 10, icone: "🐲", descricao: "+6 de dano em treinos e caminhadas" },
  { id: "corvo", nome: "Corvo Mensageiro", slot: "companheiro", preco: 120, bonus: 1, nivel: 2, icone: "🐦‍⬛", descricao: "Companheiro. +1 de dano em treinos e caminhadas" },
  { id: "lobo", nome: "Lobo Cinzento", slot: "companheiro", preco: 400, bonus: 2, nivel: 5, icone: "🐺", descricao: "Companheiro. +2 de dano em treinos e caminhadas" },
  { id: "dragaozinho", nome: "Filhote de Dragão", slot: "companheiro", preco: 1200, bonus: 4, nivel: 9, icone: "🐉", descricao: "Companheiro. +4 de dano em treinos e caminhadas" },
  { id: POCAO_DE_GELO, nome: "Poção de Gelo", slot: "consumivel", preco: 200, bonus: 0, nivel: 1, icone: "🧪", descricao: "Vale 1 congelamento de sequência (máximo de 2 guardados)" },
];
export const itemPorId = (id: string) => ITENS.find((i) => i.id === id);

export interface Compra { itemId: string; criadoEm: string; }

/** Bônus de equipamento em um momento: o melhor item de cada tipo que você já tinha comprado. */
export function bonusDeEquipamento(compras: Compra[], quando: string): number {
  const melhor: Partial<Record<Slot, number>> = {};
  for (const c of compras) {
    if (c.criadoEm > quando) continue;
    const item = itemPorId(c.itemId);
    if (item && item.bonus > (melhor[item.slot] ?? 0)) melhor[item.slot] = item.bonus;
  }
  return Object.values(melhor).reduce((s, v) => s + v, 0);
}

// ---------- Inimigos ----------

export interface Arquetipo { id: string; nome: string; hp: number; }

/** A campanha percorre esta lista em ordem e recomeça mais forte a cada volta. */
export const INIMIGOS: Arquetipo[] = [
  { id: "slime", nome: "Gosma Verde", hp: 30 },
  { id: "morcego", nome: "Morcego das Cavernas", hp: 36 },
  { id: "goblin", nome: "Goblin Saqueador", hp: 45 },
  { id: "aranha", nome: "Aranha Gigante", hp: 52 },
  { id: "esqueleto", nome: "Esqueleto Guardião", hp: 60 },
  { id: "lobo", nome: "Lobo Atroz", hp: 68 },
  { id: "fantasma", nome: "Assombração", hp: 76 },
  { id: "orc", nome: "Orc Brutamontes", hp: 90 },
];
const PREFIXOS = ["", "Feroz", "Ancião", "Sombrio", "Lendário"];

export function inimigoNumero(indice: number) {
  const base = INIMIGOS[indice % INIMIGOS.length];
  const volta = Math.floor(indice / INIMIGOS.length);
  const prefixo = PREFIXOS[Math.min(volta, PREFIXOS.length - 1)];
  const hp = Math.round(base.hp * (1 + 0.3 * volta));
  return { id: base.id, nome: prefixo ? `${base.nome} ${prefixo}` : base.nome, hp, ouro: Math.round(hp * 0.8), volta };
}

/** Chefes da semana: um por semana, em rodízio. */
export const CHEFES = [
  { id: "ogro", nome: "Ogro da Preguiça" },
  { id: "lich", nome: "Lich do Sofá" },
  { id: "dragao", nome: "Dragão da Procrastinação" },
  { id: "golem", nome: "Golem do Cansaço" },
  { id: "espectro", nome: "Espectro do Despertador" },
  { id: "hidra", nome: "Hidra das Desculpas" },
];

// ---------- Combate ----------

export interface Evento { chave: string; quando: string; tipo: TipoAtaque; base: number; dia?: string; }

export interface Ataque extends Evento { d20: number; critico: boolean; dano: number; }

/** Dano base de cada ação. Um dia normal soma cerca de 50. */
export const DANO_BASE: Record<TipoAtaque, number> = {
  treino: 12, pausa: 12, checagem: 2, caminhada: 6, glicose: 3, agua: 1, sono: 4, refeicao: 2, medida: 2, insulina: 3,
};
export const NOME_DO_GOLPE: Record<TipoAtaque, string> = {
  treino: "Golpe de treino", pausa: "Postura defensiva", checagem: "Olhar atento", caminhada: "Investida", glicose: "Percepção",
  agua: "Frasco de água", sono: "Descanso longo", refeicao: "Ração de viagem", medida: "Autoconhecimento", insulina: "Ritual de cuidado",
};

/** Número "aleatório" que depende só do texto: o mesmo registro sempre rola o mesmo dado. */
export function d20De(chave: string): number {
  let h = 2166136261;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 20) + 1;
}

const COM_EQUIPAMENTO: TipoAtaque[] = ["treino", "pausa", "caminhada"];

/**
 * Transforma cada ação real em um ataque.
 * d20 natural 20 = crítico (dano dobrado). 15 ou mais = golpe forte (+2). Nunca erra:
 * uma ação real sempre causa pelo menos o dano base.
 */
export function calcularAtaques(eventos: Evento[], compras: Compra[], classe: Classe | undefined): Ataque[] {
  return [...eventos]
    .sort((a, b) => a.quando.localeCompare(b.quando) || a.chave.localeCompare(b.chave))
    .map((e) => {
      const d20 = d20De(e.chave);
      const critico = d20 === 20;
      let dano = e.base;
      if (COM_EQUIPAMENTO.includes(e.tipo)) dano += bonusDeEquipamento(compras, e.quando);
      if (classe && CLASSES[classe].bonus.includes(e.tipo)) dano += BONUS_DE_CLASSE;
      if (d20 >= 15) dano += 2;
      if (critico) dano *= 2;
      return { ...e, d20, critico, dano };
    });
}

/** Aplica os ataques, em ordem, à fila de inimigos da campanha. */
export function campanha(ataques: Ataque[]) {
  let indice = 0;
  let inimigo = inimigoNumero(0);
  let hp = inimigo.hp;
  let ouro = 0;
  let danoTotal = 0;
  const derrotados: Record<string, number> = {};
  for (const a of ataques) {
    danoTotal += a.dano;
    let resto = a.dano;
    // Um golpe forte pode derrubar um inimigo e o que sobra acerta o próximo.
    while (resto >= hp) {
      resto -= hp;
      ouro += inimigo.ouro;
      derrotados[inimigo.id] = (derrotados[inimigo.id] ?? 0) + 1;
      indice += 1;
      inimigo = inimigoNumero(indice);
      hp = inimigo.hp;
    }
    hp -= resto;
  }
  return { indice, inimigo, hp, ouro, danoTotal, derrotados, totalDerrotados: indice, ultimo: ataques.at(-1) };
}

// ---------- Ouro ----------

export const OURO_POR_MISSAO = 25;
export const OURO_POR_CHEFE = 100;
