import { desfazerUltimaAgua, registrarAgua } from "../db";
import { xpAgua } from "../regras";
import type { Resumo } from "../resumo";

export const litros = (ml: number) => (ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " L";

export default function Agua({ resumo }: { resumo: Resumo }) {
  const { aguaMl, metaAguaMl } = resumo.hoje;
  const xpHoje = xpAgua(aguaMl, metaAguaMl);
  const xpMaximo = xpAgua(metaAguaMl, metaAguaMl);
  const falta = Math.max(0, metaAguaMl - aguaMl);
  const porcentagem = Math.min(100, Math.round((aguaMl / metaAguaMl) * 100));

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Água</h2>
        <span className="xp-dia">
          +{xpHoje} de {xpMaximo} XP
        </span>
      </div>
      <p className="total">
        {litros(aguaMl)} <small>de {litros(metaAguaMl)}</small>
      </p>
      <div className="barra grande" role="progressbar" aria-label="Água de hoje" aria-valuenow={porcentagem} aria-valuemax={100}>
        <div className="barra-cheia agua" style={{ width: `${porcentagem}%` }} />
      </div>
      <p className="situacao">{falta > 0 ? `Faltam ${litros(falta)} (${xpMaximo - xpHoje} XP).` : "Meta do dia atingida. Beber mais não dá XP extra."}</p>
      <div className="botoes">
        <button className="principal agua" onClick={() => void registrarAgua(250)}>
          + 250 ml
        </button>
        <button className="principal agua" onClick={() => void registrarAgua(500)}>
          + 500 ml
        </button>
      </div>
      {aguaMl > 0 && (
        <button className="discreto" onClick={() => void desfazerUltimaAgua()}>
          Desfazer último registro
        </button>
      )}
    </section>
  );
}
