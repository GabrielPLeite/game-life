import type { Resumo } from "../resumo";
import { MAX_CONGELAMENTOS } from "../regras";

/** Nível, barra de XP e números da sequência. */
export default function Cabecalho({ resumo }: { resumo: Resumo }) {
  const { nivel, xpNoNivel, xpParaProximo } = resumo.nivel;
  const s = resumo.sequencia;
  return (
    <header>
      <div className="linha">
        <h1>Game Life</h1>
        <span className="xp-dia">+{resumo.xpHoje.total} XP hoje</span>
      </div>
      <div className="nivel-linha">
        <strong>Nível {nivel}</strong>
        <span className="xp-texto">
          {xpNoNivel} / {xpParaProximo} XP
        </span>
      </div>
      <div className="barra" role="progressbar" aria-label="Progresso do nível" aria-valuenow={xpNoNivel} aria-valuemax={xpParaProximo}>
        <div className="barra-cheia xp" style={{ width: `${(xpNoNivel / xpParaProximo) * 100}%` }} />
      </div>
      <dl className="numeros">
        <div>
          <dt>Sequência</dt>
          <dd>{s.atual} {s.atual === 1 ? "dia" : "dias"}</dd>
        </div>
        <div>
          <dt>Recorde</dt>
          <dd>{s.recorde}</dd>
        </div>
        <div>
          <dt>Congelamentos</dt>
          <dd>
            {s.congelamentos} de {MAX_CONGELAMENTOS}
          </dd>
        </div>
      </dl>
    </header>
  );
}
