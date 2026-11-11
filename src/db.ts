// Banco de dados local (IndexedDB, via Dexie). Tudo fica só neste aparelho.
import Dexie, { type EntityTable } from "dexie";
import { META_AGUA_PADRAO_ML, diaLogico } from "./regras";

/** De onde veio um registro. Hoje é sempre manual; relógio e sensor entram depois. */
export type Origem = "manual" | "relogio" | "sensor";

export interface RegistroAgua {
  id: number;
  /** Dia do jogo (AAAA-MM-DD), já considerando a virada às 3h. */
  dia: string;
  /** Momento exato do registro, em formato ISO. */
  criadoEm: string;
  ml: number;
  origem: Origem;
  /** Preenchido quando o registro é desfeito. Nada é apagado de verdade. */
  excluidoEm?: string;
}

export interface Dia {
  dia: string;
  /** Meta de água que valia naquele dia. Mudar a meta depois não altera o passado. */
  metaAguaMl: number;
}

export interface Configuracoes {
  id: "unica";
  metaAguaMl: number;
}

class Banco extends Dexie {
  agua!: EntityTable<RegistroAgua, "id">;
  dias!: EntityTable<Dia, "dia">;
  configuracoes!: EntityTable<Configuracoes, "id">;

  constructor() {
    super("game-life");
    this.version(1).stores({
      agua: "++id, dia",
      dias: "dia",
      configuracoes: "id",
    });
  }
}

export const db = new Banco();

export async function lerConfiguracoes(): Promise<Configuracoes> {
  return (await db.configuracoes.get("unica")) ?? { id: "unica", metaAguaMl: META_AGUA_PADRAO_ML };
}

/** Garante que o dia de hoje existe, com a meta atual "fotografada". */
export async function garantirDia(dia: string = diaLogico()): Promise<Dia> {
  const existente = await db.dias.get(dia);
  if (existente) return existente;
  const novo: Dia = { dia, metaAguaMl: (await lerConfiguracoes()).metaAguaMl };
  await db.dias.put(novo);
  return novo;
}

export async function registrarAgua(ml: number): Promise<void> {
  const dia = diaLogico();
  await garantirDia(dia);
  await db.agua.add({ dia, criadoEm: new Date().toISOString(), ml, origem: "manual" } as RegistroAgua);
}

/** Desfaz o último registro de água de hoje (marca como excluído). */
export async function desfazerUltimaAgua(): Promise<void> {
  const hoje = await db.agua.where("dia").equals(diaLogico()).toArray();
  const ultimo = hoje.filter((r) => !r.excluidoEm).at(-1);
  if (ultimo) await db.agua.update(ultimo.id, { excluidoEm: new Date().toISOString() });
}

/** Muda a meta de água daqui para a frente (e a de hoje). */
export async function definirMetaAgua(metaAguaMl: number): Promise<void> {
  const dia = diaLogico();
  await db.configuracoes.put({ id: "unica", metaAguaMl });
  await db.dias.put({ dia, metaAguaMl });
}

/** Junta todos os dados em um objeto, para o backup em arquivo. */
export async function exportarTudo() {
  return {
    app: "game-life",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    configuracoes: await lerConfiguracoes(),
    dias: await db.dias.toArray(),
    agua: await db.agua.toArray(),
  };
}
