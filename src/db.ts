// Banco de dados local (IndexedDB, via Dexie). Tudo fica só neste aparelho.
// Regra geral: nada é apagado de verdade. Desfazer marca o registro com "excluidoEm".
import Dexie, { type EntityTable } from "dexie";
import type { LeituraSensor, Tendencia } from "./sensor";
import { META_AGUA_PADRAO_ML, diaLogico, somarDias, turnoDoHorario, type LimitesGlicose, type MudancaDeModo, type ResultadoChecagem, type TipoMeta } from "./regras";

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

// ---------- Metas pessoais (versão generalista) ----------

/** Uma meta diária que você cria: tempo de tela, jogos, estudo... Sempre em minutos por dia. */
export interface Meta {
  /** Texto (não número), para o mesmo registro valer em mais de um aparelho no futuro. */
  id: string;
  nome: string;
  icone: string;
  tipo: TipoMeta;
  /** Alvo atual em minutos por dia. Cada lançamento guarda o alvo que valia na hora. */
  alvoMin: number;
  /** Botões rápidos com rótulo (ex.: Leitura, Vídeo/curso). */
  etiquetas?: string[];
  /** Lembrete de onde achar o número ou do que conta. */
  dica?: string;
  ordem: number;
  criadoEm: string;
  /** Meta pausada: some da tela Hoje, mas o histórico fica. */
  arquivadaEm?: string;
}

export interface RegistroMeta {
  id: string;
  metaId: string;
  dia: string;
  criadoEm: string;
  minutos: number;
  /** true = "o total do dia foi este"; vazio = soma ao que já havia. */
  total?: boolean;
  /** Tipo e alvo da meta no momento do lançamento: mudar a meta depois não altera o passado. */
  tipo: TipoMeta;
  alvoMin: number;
  etiqueta?: string;
  excluidoEm?: string;
}

/** Metas que já vêm criadas. Os ids fixos evitam duplicar se isto rodar de novo. */
export const METAS_INICIAIS: Omit<Meta, "criadoEm">[] = [
  { id: "tela-celular", nome: "Tela no celular", icone: "📱", tipo: "limite", alvoMin: 60, ordem: 1, dica: "O número está em Configurações > Bem-estar digital do celular." },
  { id: "tela-pc", nome: "Tela no PC (lazer)", icone: "🖥️", tipo: "limite", alvoMin: 180, ordem: 2, dica: "Conte só o tempo de lazer. Trabalho e estudo ficam de fora." },
  { id: "jogos", nome: "Jogos", icone: "🎮", tipo: "limite", alvoMin: 120, ordem: 3, dica: "Some todos os aparelhos: celular, PC e console." },
  { id: "estudo", nome: "Estudo e leitura", icone: "📚", tipo: "minimo", alvoMin: 30, ordem: 4, etiquetas: ["Leitura", "Vídeo/curso"] },
];

// ---------- Jardim ----------

/** Um vaso do jardim. O nome é o da planta; o que cada vaso representa fica só na sua cabeça. */
export interface Vaso {
  id: string;
  nome: string;
  ordem: number;
  /** Dia em que o vaso foi plantado (a contagem começa aqui). */
  desde: string;
  criadoEm: string;
  arquivadoEm?: string;
}

/** Resposta do dia para um vaso: reguei ou não. */
export interface Rega {
  id: string;
  vasoId: string;
  dia: string;
  regou: boolean;
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
  /**
   * Quando a parte de glicose foi ligada ou desligada. A última entrada diz o estado atual.
   * Vazio = app de antes da versão generalista (glicose ligada).
   */
  glicoseHistorico?: MudancaDeModo[];
}

/** A parte de glicose (medições, sensor, checagem antes do treino, relatório) está ligada agora? */
export const glicoseLigada = (c: Configuracoes) => c.glicoseHistorico?.at(-1)?.ligada ?? true;

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
  metas!: EntityTable<Meta, "id">;
  registrosMeta!: EntityTable<RegistroMeta, "id">;
  vasos!: EntityTable<Vaso, "id">;
  regas!: EntityTable<Rega, "id">;
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
    // Versão 6: metas pessoais (tela, jogos, estudo...). Só acrescenta tabelas; o resto fica como está.
    this.version(6).stores({ metas: "id", registrosMeta: "id, dia, metaId" });
    // Versão 7: jardim. Só acrescenta tabelas.
    this.version(7).stores({ vasos: "id", regas: "id, dia, vasoId" });
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

// ---------- Metas pessoais ----------

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Prepara a versão generalista na primeira vez que ela abre neste aparelho:
 * desliga a parte de glicose (sem apagar nada) e cria as metas iniciais.
 */
export async function prepararVersaoGeneralista(): Promise<void> {
  await db.transaction("rw", db.configuracoes, db.metas, async () => {
    const c = await lerConfiguracoes();
    if (c.glicoseHistorico) return;
    await db.configuracoes.put({ ...c, glicoseHistorico: [{ desde: diaLogico(), ligada: false }], id: "unica" });
    if ((await db.metas.count()) === 0) await db.metas.bulkPut(METAS_INICIAIS.map((m) => ({ ...m, criadoEm: agoraIso() })));
  });
}

/** Liga ou desliga a parte de glicose a partir de hoje. Nada é apagado nos dois sentidos. */
export async function definirGlicose(ligada: boolean): Promise<void> {
  const c = await lerConfiguracoes();
  const hoje = diaLogico();
  // Trocar duas vezes no mesmo dia substitui a entrada do dia em vez de empilhar.
  const historico = [...(c.glicoseHistorico ?? []).filter((m) => m.desde !== hoje), { desde: hoje, ligada }];
  await db.configuracoes.put({ ...c, glicoseHistorico: historico, id: "unica" });
}

/**
 * Lança minutos em uma meta. "ontem" serve para fechar o dia anterior (tempo de tela só fica completo no dia seguinte).
 * total = true quer dizer "o total do dia foi este".
 */
export async function registrarMeta(meta: Meta, minutos: number, opcoes: { ontem?: boolean; total?: boolean; etiqueta?: string } = {}): Promise<void> {
  await garantirDia();
  await db.registrosMeta.add({
    id: novoId(),
    metaId: meta.id,
    dia: opcoes.ontem ? somarDias(diaLogico(), -1) : diaLogico(),
    criadoEm: agoraIso(),
    minutos,
    total: opcoes.total || undefined,
    tipo: meta.tipo,
    alvoMin: meta.alvoMin,
    etiqueta: opcoes.etiqueta,
  });
}

/** Desfaz o último lançamento de uma meta em um dia. */
export async function desfazerUltimoRegistroMeta(metaId: string, dia: string): Promise<void> {
  const doDia = (await db.registrosMeta.where("dia").equals(dia).toArray()).filter((r) => r.metaId === metaId && !r.excluidoEm);
  const ultimo = doDia.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).at(-1);
  if (ultimo) await db.registrosMeta.update(ultimo.id, { excluidoEm: agoraIso() });
}

export async function criarMeta(nome: string, tipo: TipoMeta, alvoMin: number, icone: string): Promise<void> {
  const ordem = (await db.metas.count()) + 1;
  await db.metas.add({ id: novoId(), nome, icone, tipo, alvoMin, ordem, criadoEm: agoraIso() });
}

export async function mudarMeta(id: string, mudancas: Partial<Pick<Meta, "alvoMin" | "nome">>): Promise<void> {
  await db.metas.update(id, mudancas);
}

/** Pausa (ou retoma) uma meta. O histórico continua guardado. */
export async function pausarMeta(id: string, pausar: boolean): Promise<void> {
  await db.metas.update(id, { arquivadaEm: pausar ? agoraIso() : undefined });
}

// ---------- Jardim ----------

export async function plantarVaso(nome: string): Promise<void> {
  const ordem = (await db.vasos.count()) + 1;
  await db.vasos.add({ id: novoId(), nome, ordem, desde: diaLogico(), criadoEm: agoraIso() });
}

/** Guarda a resposta do dia (hoje ou ontem). Responder de novo no mesmo dia substitui a anterior. */
export async function regar(vasoId: string, dia: string, regou: boolean): Promise<void> {
  await db.transaction("rw", db.regas, async () => {
    const antigas = (await db.regas.where("dia").equals(dia).toArray()).filter((r) => r.vasoId === vasoId && !r.excluidoEm);
    for (const r of antigas) await db.regas.update(r.id, { excluidoEm: agoraIso() });
    await db.regas.add({ id: novoId(), vasoId, dia, regou, criadoEm: agoraIso() });
  });
}

/** Apaga a resposta de um dia, para responder de novo. */
export async function desfazerRega(vasoId: string, dia: string): Promise<void> {
  const doDia = (await db.regas.where("dia").equals(dia).toArray()).filter((r) => r.vasoId === vasoId && !r.excluidoEm);
  for (const r of doDia) await db.regas.update(r.id, { excluidoEm: agoraIso() });
}

/** Tira o vaso do jardim. As respostas antigas ficam guardadas. */
export async function guardarVaso(id: string): Promise<void> {
  await db.vasos.update(id, { arquivadoEm: agoraIso() });
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
    versao: 7,
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
    metas: await db.metas.toArray(),
    registrosMeta: await db.registrosMeta.toArray(),
    vasos: await db.vasos.toArray(),
    regas: await db.regas.toArray(),
  };
}

export type Backup = Awaited<ReturnType<typeof exportarTudo>>;

/**
 * Restaura um backup: apaga os dados atuais deste aparelho e grava os do arquivo.
 * Aceita backups de versões antigas (tabelas que não existiam ficam vazias).
 */
export async function restaurarBackup(dados: Partial<Backup> & { app?: string }): Promise<void> {
  if (dados.app !== "game-life") throw new Error("Este arquivo não é um backup do Game Life.");
  const tabelas = [db.agua, db.glicose, db.treinos, db.marcacoes, db.habitos, db.recompensas, db.compras, db.sensor, db.sincronizacoes, db.metas, db.registrosMeta, db.vasos, db.regas, db.dias, db.configuracoes];
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
    await db.metas.bulkPut(dados.metas ?? []);
    await db.registrosMeta.bulkPut(dados.registrosMeta ?? []);
    await db.vasos.bulkPut(dados.vasos ?? []);
    await db.regas.bulkPut(dados.regas ?? []);
    await db.dias.bulkPut(dados.dias ?? []);
    if (dados.configuracoes) await db.configuracoes.put({ ...CONFIG_PADRAO, ...dados.configuracoes, id: "unica" });
  });
  // Backup de antes da versão generalista: aplica a mesma preparação da primeira abertura.
  await prepararVersaoGeneralista();
}
