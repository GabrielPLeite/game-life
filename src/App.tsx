import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, definirMetaAgua, desfazerUltimaAgua, exportarTudo, garantirDia, registrarAgua } from "./db";
import { META_AGUA_PADRAO_ML, ML_POR_COPO, diaLogico, nivelDeXp, xpAgua } from "./regras";

const litros = (ml: number) => (ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " L";

/** Baixa um arquivo JSON com todos os dados do app. */
async function baixarBackup() {
  const dados = await exportarTudo();
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `game-life-backup-${diaLogico()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const hoje = diaLogico();

  // Cria o registro do dia assim que o app abre.
  useEffect(() => {
    void garantirDia(hoje);
  }, [hoje]);

  // useLiveQuery relê o banco sozinho sempre que algo muda.
  const dados = useLiveQuery(async () => {
    const dias = await db.dias.toArray();
    const agua = (await db.agua.toArray()).filter((r) => !r.excluidoEm);

    // Soma a água de cada dia.
    const totalPorDia = new Map<string, number>();
    for (const r of agua) totalPorDia.set(r.dia, (totalPorDia.get(r.dia) ?? 0) + r.ml);

    // O XP total é recalculado a partir dos registros, nunca guardado como saldo.
    const xpTotal = dias.reduce((soma, d) => soma + xpAgua(totalPorDia.get(d.dia) ?? 0, d.metaAguaMl), 0);

    const metaHoje = dias.find((d) => d.dia === hoje)?.metaAguaMl ?? META_AGUA_PADRAO_ML;
    const totalHoje = totalPorDia.get(hoje) ?? 0;
    return { xpTotal, metaHoje, totalHoje, registrosHoje: agua.filter((r) => r.dia === hoje).length };
  }, [hoje]);

  if (!dados) return null;

  const { xpTotal, metaHoje, totalHoje, registrosHoje } = dados;
  const { nivel, xpNoNivel, xpParaProximo } = nivelDeXp(xpTotal);
  const xpHoje = xpAgua(totalHoje, metaHoje);
  const xpMaximoHoje = xpAgua(metaHoje, metaHoje);
  const falta = Math.max(0, metaHoje - totalHoje);
  const porcentagem = Math.min(100, Math.round((totalHoje / metaHoje) * 100));

  return (
    <main>
      <header>
        <h1>Game Life</h1>
        <div className="nivel">
          <div className="nivel-linha">
            <strong>Nível {nivel}</strong>
            <span>
              {xpNoNivel} / {xpParaProximo} XP
            </span>
          </div>
          <div className="barra" role="progressbar" aria-label="Progresso do nível" aria-valuenow={xpNoNivel} aria-valuemax={xpParaProximo}>
            <div className="barra-cheia xp" style={{ width: `${(xpNoNivel / xpParaProximo) * 100}%` }} />
          </div>
        </div>
      </header>

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Água</h2>
          <span className="xp-dia">
            +{xpHoje} de {xpMaximoHoje} XP hoje
          </span>
        </div>

        <p className="total">
          {litros(totalHoje)} <small>de {litros(metaHoje)}</small>
        </p>
        <div className="barra grande" role="progressbar" aria-label="Água de hoje" aria-valuenow={porcentagem} aria-valuemax={100}>
          <div className="barra-cheia agua" style={{ width: `${porcentagem}%` }} />
        </div>
        <p className="situacao">
          {falta > 0
            ? `Faltam ${litros(falta)}. Se parar aqui, deixa ${xpMaximoHoje - xpHoje} XP na mesa hoje.`
            : "Meta do dia atingida. Beber mais não dá XP extra."}
        </p>

        <div className="botoes">
          <button className="principal" onClick={() => void registrarAgua(250)}>
            + 250 ml
          </button>
          <button className="principal" onClick={() => void registrarAgua(500)}>
            + 500 ml
          </button>
        </div>
        <button className="discreto" disabled={registrosHoje === 0} onClick={() => void desfazerUltimaAgua()}>
          Desfazer último registro
        </button>
      </section>

      <section className="cartao">
        <h2>Configurações</h2>
        <div className="ajuste">
          <span>Meta diária de água</span>
          <div className="passos">
            <button aria-label="Diminuir meta" disabled={metaHoje <= ML_POR_COPO} onClick={() => void definirMetaAgua(metaHoje - ML_POR_COPO)}>
              −
            </button>
            <strong>{litros(metaHoje)}</strong>
            <button aria-label="Aumentar meta" disabled={metaHoje >= 6000} onClick={() => void definirMetaAgua(metaHoje + ML_POR_COPO)}>
              +
            </button>
          </div>
        </div>
        <button className="discreto" onClick={() => void baixarBackup()}>
          Baixar backup dos meus dados
        </button>
        <p className="rodape">
          Regras: 2 XP a cada 250 ml até a meta e 10 XP ao atingir a meta. O dia vira às 3h da manhã. Seus dados ficam só neste aparelho.
        </p>
      </section>
    </main>
  );
}
