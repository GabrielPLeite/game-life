// Banco de dados local (IndexedDB, via Dexie). Tudo fica só neste aparelho.
// Regra geral: nada é apagado de verdade. Desfazer marca o registro com "excluidoEm".
import Dexie, { type EntityTable } from "dexie";
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

export interface Dia {
  dia: string;
  /** Meta de água que valia naquele dia. Mudar a meta depois não altera o passado. */
  metaAguaMl: number;
}

export interface Configuracoes extends LimitesGlicose {
  id: "unica";
  metaAguaMl: number;
  descansosPorSemana: number;
  /** Faixa-alvo do médico, só para informação (não pontua). */
  alvoMinimo: number;
  alvoMaximo: number;
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
};

class Banco extends Dexie {
  agua!: EntityTable<RegistroAgua, "id">;
  glicose!: EntityTable<RegistroGlicose, "id">;
  treinos!: EntityTable<RegistroTreino, "id">;
  marcacoes!: EntityTable<Marcacao, "id">;
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

export async function registrarGlicose(valor: number, momento: MomentoGlicose): Promise<number> {
  await garantirDia();
  return db.glicose.add({ ...novo(), valor, momento } as Novo<RegistroGlicose> as RegistroGlicose);
}

export const desfazerUltimaGlicose = () => desfazerUltimo(db.glicose as never);

// ---------- Treino ----------

/** Começa um treino. A glicose da checagem (se houve) é registrada junto. */
export async function iniciarTreino(checagem: RegistroTreino["checagem"], glicose?: number): Promise<void> {
  const glicoseId = glicose === undefined ? undefined : await registrarGlicose(glicose, "antes_treino");
  await db.treinos.add({ ...novo(), turno: turnoDoHorario(), glicoseId, checagem } as Novo<RegistroTreino> as RegistroTreino);
}

/** Registra a checagem e o adiamento do treino por glicose fora da faixa. Vale como pausa legítima. */
export async function adiarTreino(glicose: number, checagem: ResultadoChecagem): Promise<void> {
  const glicoseId = await registrarGlicose(glicose, "antes_treino");
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

// ---------- Backup ----------

/** Junta todos os dados em um objeto, para o backup em arquivo. */
export async function exportarTudo() {
  return {
    app: "game-life",
    versao: 2,
    exportadoEm: agoraIso(),
    configuracoes: await lerConfiguracoes(),
    dias: await db.dias.toArray(),
    agua: await db.agua.toArray(),
    glicose: await db.glicose.toArray(),
    treinos: await db.treinos.toArray(),
    marcacoes: await db.marcacoes.toArray(),
  };
}
