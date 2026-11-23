import type { Resumo } from "../resumo";
import { MAX_CONGELAMENTOS } from "../regras";
import { CLASSES, itemPorId, type Slot } from "../rpg";
import { desenhoDoHeroi } from "../sprites";
import Sprite from "./Sprite";

/** Melhor item comprado de cada tipo: é o que o herói "veste". */
export function melhoresItens(ids: string[]) {
  const melhor: Partial<Record<Slot, NonNullable<ReturnType<typeof itemPorId>>>> = {};
  for (const id of ids) {
    const item = itemPorId(id);
    if (item && item.slot !== "consumivel" && item.bonus > (melhor[item.slot]?.bonus ?? 0)) melhor[item.slot] = item;
  }
  return melhor;
}

/** Cartão do herói: personagem, nível, XP, ouro e sequência. */
/** semHeroi: a Brasa está no lugar do herói, então some o retrato, a classe, o ouro e o equipamento. */
export default function Cabecalho({ resumo, semHeroi = false }: { resumo: Resumo; semHeroi?: boolean }) {
  const { nivel, xpNoNivel, xpParaProximo } = resumo.nivel;
  const s = resumo.sequencia;
  const r = resumo.rpg;
  const classe = r.classe ?? "guerreiro";
  const itens = Object.values(melhoresItens(r.itensComprados));
  return (
    <header className="heroi">
      <div className="heroi-topo">
        {!semHeroi && (
          <div className="retrato">
            <Sprite desenho={desenhoDoHeroi(classe)} tamanho={84} className="respira" rotulo={`Herói ${CLASSES[classe].nome}`} />
          </div>
        )}
        <div className="heroi-dados">
          <div className="linha">
            <h1>{semHeroi ? `Nível ${nivel}` : r.nome ?? "Herói sem nome"}</h1>
            <span className="xp-dia">+{resumo.xpHoje.total} XP hoje</span>
          </div>
          <p className="suave">{semHeroi ? r.titulo : `Nível ${nivel} · ${CLASSES[classe].nome} · ${r.titulo}`}</p>
          <div className="barra" role="progressbar" aria-label="Progresso do nível" aria-valuenow={xpNoNivel} aria-valuemax={xpParaProximo}>
            <div className="barra-cheia xp" style={{ width: `${(xpNoNivel / xpParaProximo) * 100}%` }} />
          </div>
          <div className="linha">
            <span className="xp-texto">
              {xpNoNivel} / {xpParaProximo} XP
            </span>
            {!semHeroi && itens.length > 0 && (
              <span className="equipamento" aria-label={`Equipado: ${itens.map((i) => i.nome).join(", ")}`}>
                {itens.map((i) => i.icone).join(" ")}
              </span>
            )}
          </div>
        </div>
      </div>
      <dl className={`numeros quatro${semHeroi ? " tres" : ""}`}>
        {!semHeroi && (
          <div>
            <dt>🪙 Ouro</dt>
            <dd className="ouro">{r.ouro}</dd>
          </div>
        )}
        <div>
          <dt>🔥 Sequência</dt>
          <dd>{s.atual} {s.atual === 1 ? "dia" : "dias"}</dd>
        </div>
        <div>
          <dt>🏆 Recorde</dt>
          <dd>{s.recorde}</dd>
        </div>
        <div>
          <dt>❄️ Gelo</dt>
          <dd>
            {s.congelamentos}/{MAX_CONGELAMENTOS}
          </dd>
        </div>
      </dl>
    </header>
  );
}
