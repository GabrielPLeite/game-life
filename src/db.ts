// Banco de dados local (IndexedDB, via Dexie). Tudo fica só neste aparelho.
// Regra geral: nada é apagado de verdade. Desfazer marca o registro com "excluidoEm".
import Dexie, { type EntityTable } from "dexie";
import type { LeituraSensor, Tendencia } from "./sensor";
import { META_AGUA_PADRAO_ML, diaLogico, turnoDoHorario, type LimitesGlicose, type ResultadoChecagem } from "./regras";

/** De onde veio um registro. Hoje é sempre manual; relógio e sensor entram depois. */
export type Origem = "manual" | "relogio" | "sensor";

interface Registro {
  id: number;
  /** Dia do jogo (AAAA-MM-DD), já considerando a virada às 3h. */
  dia: string;
  /** Momento exato do registro, em formato ISO. */
  criadoEm: string;
  origem: Origem;
  excluidoEm?: string;
}

export interface RegistroAgua extends Registro {
  ml: number;
}

export type MomentoGlicose = "jejum" | "antes_refeicao" | "depois_refeicao" | "antes_treino" | "antes_dormir" | "outro";

export interface RegistroGlicose extends Registro {
  /** mg/dL */
  valor: number;
  momento: MomentoGlicose;
}

export type TipoTreino = "esteira" | "musculacao" | "abdomen" | "outro";

export interface RegistroTreino extends Registro {
  turno: "manha" | "noite";
  /** Medição feita na checagem antes do treino (se houve). */
  glicoseId?: number;
  checagem: ResultadoChecagem | "sem_checagem";
  /** Preenchido quando o treino termina. Vazio = em andamento. */
  concluidoEm?: string;
  /** Preenchido quando o treino foi adiado por causa da glicose. */
  adiadoEm?: string;
  tipo?: TipoTreino;
  duracaoMin?: number;
}

export type MotivoPausa = "hipo" | "glicose_fora" | "doente" | "lesao";

/** Pausa legítima ou descanso planejado: dias que contam para a sequência sem treino. */
export interface Marcacao extends Registro {
  tipo: "pausa" | "descanso";
  motivo?: MotivoPausa;
}

// ---------- Hábitos (fase 2) ----------

export type ContextoRefeicao = "normal" | "antes_treino" | "depois_treino";

/** Um registro de hábito. O campo "tipo" diz qual dos formatos abaixo ele segue. */
export type Habito =
  | (Registro & { tipo: "refeicao"; descricao: string; carboidratosG?: number; contexto: ContextoRefeicao })
  | (Registro & { tipo: "caminhada"; minutos: number; refeicaoId?: number })
  | (Registro & { tipo: "sono"; horas: number })
  | (Registro & { tipo: "medida"; pesoKg?: number; cinturaCm?: number })
  // Insulina: só registro do que você aplicou. O app nunca sugere dose.
  | (Registro & { tipo: "insulina"; insulina: "basal" | "rapida"; unidades?: number });

export type TipoHabito = Habito["tipo"];
/** Omit que funciona em cada formato da união separadamente. */
type OmitirEmCada<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Um hábito novo, sem os campos que o app preenche sozinho. */
export type NovoHabito = OmitirEmCada<Habito, keyof Registro>;

/** Recompensa real que você define e libera ao chegar num nível. */
export interface Recompensa {
  id: number;
  nome: string;
  nivel: number;
  /** Preço em ouro. Se existir, a recompensa é comprada com ouro em vez de liberada por nível. */
  custoOuro?: number;
  criadoEm: string;
  resgatadaEm?: string;
  excluidoEm?: string;
}

/** Compra feita na loja do jogo com ouro. */
export interface CompraLoja {
  id: number;
  itemId: string;
  dia: string;
  criadoEm: string;
  excluidoEm?: string;
}

export interface Dia {
  dia: string;
  /** Meta de água que valia naquele dia. Mudar a meta depois não altera o passado. */
  metaAguaMl: number;
}

/** Cada vez que você puxou dados do app Glicose. Serve para o XP do dia e para mostrar a seta atual. */
export interface SincronizacaoSensor {
  id: number;
  dia: string;
  criadoEm: string;
  /** Quantas leituras vieram no pacote. */
  leituras: number;
  tendencia: Tendencia;
  /** Horário (ms) e valor da leitura atual no momento em que você puxou. */
  atualTs?: number;
  atualValor?: number;
  servicoLigado: boolean;
}

export interface Configuracoes extends LimitesGlicose {
  id: "unica";
  metaAguaMl: number;
  descansosPorSemana: number;
  /** Faixa-alvo do médico, só para informação (não pontua). */
  alvoMinimo: number;
  alvoMaximo: number;
  /** Minutos de esteira na primeira semana do plano progressivo. */
  esteiraBaseMin: number;
  /** Herói do jogo. Vazio até você criar o personagem. */
  heroiNome?: string;
  heroiClasse?: "guerreiro" | "patrulheiro" | "clerigo" | "mago";
}

/** Valores iniciais, informados pelo Gabriel. Todos editáveis na tela de configurações. */
export const CONFIG_PADRAO: Configuracoes = {
  id: "unica",
  metaAguaMl: META_AGUA_PADRAO_ML,
  limiteBaixoTreino: 70,
  limiteComerAntes: 80,
  limiteAltoTreino: null,
  descansosPorSemana: 1,
  alvoMinimo: 70,
  alvoMaximo: 160,
  esteiraBaseMin: 30,
};

class Banco extends Dexie {
  agua!: EntityTable<RegistroAgua, "id">;
  glicose!: EntityTable<RegistroGlicose, "id">;
  treinos!: EntityTable<RegistroTreino, "id">;
  marcacoes!: EntityTable<Marcacao, "id">;
  habitos!: EntityTable<Habito, "id">;
  recompensas!: EntityTable<Recompensa, "id">;
  compras!: EntityTable<CompraLoja, "id">;
  sensor!: EntityTable<LeituraSensor, "ts">;
  sincronizacoes!: EntityTable<SincronizacaoSensor, "id">;
  dias!: EntityTable<Dia, "dia">;
  configuracoes!: EntityTable<Configuracoes, "id">;

  constructor() {
    super("game-life");
    this.version(1).stores({ agua: "++id, dia", dias: "dia", configuracoes: "id" });
    // Versão 2: treinos, glicose e marcações. Os dados da versão 1 continuam intactos.
    this.version(2).stores({
      agua: "++id, dia",
      glicose: "++id, dia",
      treinos: "++id, dia",
      marcacoes: "++id, dia",
      dias: "dia",
      configuracoes: "id",
    });
    // Versão 3: hábitos e recompensas.
    this.version(3).stores({
      agua: "++id, dia",
      glicose: "++id, dia",
      treinos: "++id, dia",
      marcacoes: "++id, dia",
      habitos: "++id, dia, tipo",
      recompensas: "++id",
      dias: "dia",
      configuracoes: "id",
    });
    // Versão 4: compras da loja do RPG.
    this.version(4).stores({
      agua: "++id, dia",
      glicose: "++id, dia",
      treinos: "++id, dia",
      marcacoes: "++id, dia",
      habitos: "++id, dia, tipo",
      recompensas: "++id",
      compras: "++id, itemId",
      dias: "dia",
      configuracoes: "id",
    });
    // Versão 5: leituras do sensor vindas do app Glicose (chave = horário, então puxar de novo não duplica).
    this.version(5).stores({
      agua: "++id, dia",
      glicose: "++id, dia",
      treinos: "++id, dia",
      marcacoes: "++id, dia",
      habitos: "++id, dia, tipo",
      recompensas: "++id",
      compras: "++id, itemId",
      sensor: "ts, dia",
      sincronizacoes: "++id, dia",
      dias: "dia",
      configuracoes: "id",
    });
  }
}

export const db = new Banco();

const agoraIso = () => new Date().toISOString();
/** Campos comuns a todo registro novo feito agora, à mão. */
const novo = () => ({ dia: diaLogico(), criadoEm: agoraIso(), origem: "manual" as const });
/** Remove o campo id para o Dexie gerar um novo. */
type Novo<T> = Omit<T, "id">;

export async function lerConfiguracoes(): Promise<Configuracoes> {
  return { ...CONFIG_PADRAO, ...(await db.configuracoes.get("unica")) };
}

export async function salvarConfiguracoes(mudancas: Partial<Configuracoes>): Promise<void> {
  const atual = await lerConfiguracoes();
  await db.configuracoes.put({ ...atual, ...mudancas, id: "unica" });
  if (mudancas.metaAguaMl !== undefined) {
    await db.dias.put({ dia: diaLogico(), metaAguaMl: mudancas.metaAguaMl });
  }
}

/** Garante que o dia de hoje existe, com a meta atual "fotografada". */
export async function garantirDia(dia: string = diaLogico()): Promise<Dia> {
  const existente = await db.dias.get(dia);
  if (existente) return existente;
  const registro: Dia = { dia, metaAguaMl: (await lerConfiguracoes()).metaAguaMl };
  await db.dias.put(registro);
  return registro;
}

/** Marca como excluído o último registro ativo de hoje numa tabela. */
async function desfazerUltimo(tabela: EntityTable<Registro, "id">, filtro: (r: Registro) => boolean = () => true) {
  const hoje = await tabela.where("dia").equals(diaLogico()).toArray();
  const ultimo = hoje.filter((r) => !r.excluidoEm && filtro(r)).at(-1);
  if (ultimo) await tabela.update(ultimo.id, { excluidoEm: agoraIso() });
}

// ---------- Água ----------

export async function registrarAgua(ml: number): Promise<void> {
  await garantirDia();
  await db.agua.add({ ...novo(), ml } as Novo<RegistroAgua> as RegistroAgua);
}

export const desfazerUltimaAgua = () => desfazerUltimo(db.agua as never);

// ---------- Glicose ----------

/** origem "sensor" = valor confirmado a partir da leitura do sensor (na checagem do treino). */
export async function registrarGlicose(valor: number, momento: MomentoGlicose, origem: Origem = "manual"): Promise<number> {
  await garantirDia();
  return db.glicose.add({ ...novo(), origem, valor, momento } as Novo<RegistroGlicose> as RegistroGlicose);
}

export const desfazerUltimaGlicose = () => desfazerUltimo(db.glicose as never);

// ---------- Treino ----------

/** Começa um treino. A glicose da checagem (se houve) é registrada junto. */
export async function iniciarTreino(checagem: RegistroTreino["checagem"], glicose?: number, origem: Origem = "manual"): Promise<void> {
  const glicoseId = glicose === undefined ? undefined : await registrarGlicose(glicose, "antes_treino", origem);
  await db.treinos.add({ ...novo(), turno: turnoDoHorario(), glicoseId, checagem } as Novo<RegistroTreino> as RegistroTreino);
}

/** Registra a checagem e o adiamento do treino por glicose fora da faixa. Vale como pausa legítima. */
export async function adiarTreino(glicose: number, checagem: ResultadoChecagem, origem: Origem = "manual"): Promise<void> {
  const glicoseId = await registrarGlicose(glicose, "antes_treino", origem);
  await db.treinos.add({
    ...novo(),
    turno: turnoDoHorario(),
    glicoseId,
    checagem,
    adiadoEm: agoraIso(),
  } as Novo<RegistroTreino> as RegistroTreino);
  await marcarDia("pausa", checagem === "baixa" ? "hipo" : "glicose_fora");
}

export async function concluirTreino(id: number, tipo: TipoTreino, duracaoMin: number): Promise<void> {
  await db.treinos.update(id, { concluidoEm: agoraIso(), tipo, duracaoMin });
}

export async function cancelarTreino(id: number): Promise<void> {
  await db.treinos.update(id, { excluidoEm: agoraIso() });
}

export const desfazerUltimoTreino = () =>
  desfazerUltimo(db.treinos as never, (r) => !!(r as RegistroTreino).concluidoEm);

// ---------- Pausa e descanso ----------

export async function marcarDia(tipo: Marcacao["tipo"], motivo?: MotivoPausa): Promise<void> {
  await garantirDia();
  await db.marcacoes.add({ ...novo(), tipo, motivo } as Novo<Marcacao> as Marcacao);
}

export const desfazerMarcacao = () => desfazerUltimo(db.marcacoes as never);

// ---------- Hábitos ----------

export async function registrarHabito(h: NovoHabito): Promise<number> {
  await garantirDia();
  return db.habitos.add({ ...novo(), ...h } as Habito);
}

export async function excluirHabito(id: number): Promise<void> {
  await db.habitos.update(id, { excluidoEm: agoraIso() });
}

// ---------- Recompensas ----------

export async function criarRecompensa(nome: string, nivel: number, custoOuro?: number): Promise<void> {
  await db.recompensas.add({ nome, nivel, custoOuro, criadoEm: agoraIso() } as Recompensa);
}

// ---------- Loja ----------

export async function comprarItem(itemId: string): Promise<void> {
  await db.compras.add({ itemId, dia: diaLogico(), criadoEm: agoraIso() } as CompraLoja);
}

export async function resgatarRecompensa(id: number): Promise<void> {
  await db.recompensas.update(id, { resgatadaEm: agoraIso() });
}

export async function excluirRecompensa(id: number): Promise<void> {
  await db.recompensas.update(id, { excluidoEm: agoraIso() });
}

// ---------- Sensor (app Glicose) ----------

/** Guarda o que veio do app Glicose. Leituras com o mesmo horário são substituídas, nunca duplicadas. */
export async function guardarPacoteSensor(leituras: LeituraSensor[], info: Omit<SincronizacaoSensor, "id" | "dia" | "criadoEm" | "leituras">): Promise<number> {
  await garantirDia();
  await db.transaction("rw", db.sensor, db.sincronizacoes, async () => {
    await db.sensor.bulkPut(leituras);
    await db.sincronizacoes.add({ dia: diaLogico(), criadoEm: agoraIso(), leituras: leituras.length, ...info } as SincronizacaoSensor);
  });
  return leituras.length;
}

/** Leituras do sensor a partir de um horário (ms). */
export const leiturasDoSensorDesde = (ts: number) => db.sensor.where("ts").aboveOrEqual(ts).toArray();

// ---------- Backup ----------

/** Junta todos os dados em um objeto, para o backup em arquivo. */
export async function exportarTudo() {
  return {
    app: "game-life",
    versao: 5,
    exportadoEm: agoraIso(),
    configuracoes: await lerConfiguracoes(),
    dias: await db.dias.toArray(),
    agua: await db.agua.toArray(),
    glicose: await db.glicose.toArray(),
    treinos: await db.treinos.toArray(),
    marcacoes: await db.marcacoes.toArray(),
    habitos: await db.habitos.toArray(),
    recompensas: await db.recompensas.toArray(),
    compras: await db.compras.toArray(),
    sensor: await db.sensor.toArray(),
    sincronizacoes: await db.sincronizacoes.toArray(),
  };
}

export type Backup = Awaited<ReturnType<typeof exportarTudo>>;

/**
 * Restaura um backup: apaga os dados atuais deste aparelho e grava os do arquivo.
 * Aceita backups das versões 1 a 4 (tabelas que não existiam ficam vazias).
 */
export async function restaurarBackup(dados: Partial<Backup> & { app?: string }): Promise<void> {
  if (dados.app !== "game-life") throw new Error("Este arquivo não é um backup do Game Life.");
  const tabelas = [db.agua, db.glicose, db.treinos, db.marcacoes, db.habitos, db.recompensas, db.compras, db.sensor, db.sincronizacoes, db.dias, db.configuracoes];
  await db.transaction("rw", tabelas, async () => {
    await Promise.all(tabelas.map((t) => t.clear()));
    await db.agua.bulkPut(dados.agua ?? []);
    await db.glicose.bulkPut(dados.glicose ?? []);
    await db.treinos.bulkPut(dados.treinos ?? []);
    await db.marcacoes.bulkPut(dados.marcacoes ?? []);
    await db.habitos.bulkPut(dados.habitos ?? []);
    await db.recompensas.bulkPut(dados.recompensas ?? []);
    await db.compras.bulkPut(dados.compras ?? []);
    await db.sensor.bulkPut(dados.sensor ?? []);
    await db.sincronizacoes.bulkPut(dados.sincronizacoes ?? []);
    await db.dias.bulkPut(dados.dias ?? []);
    if (dados.configuracoes) await db.configuracoes.put({ ...CONFIG_PADRAO, ...dados.configuracoes, id: "unica" });
  });
}
