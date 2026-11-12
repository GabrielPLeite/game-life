import { comprarItem } from "../db";
import { MAX_CONGELAMENTOS } from "../regras";
import type { Resumo } from "../resumo";
import { ITENS, POCAO_DE_GELO, type Item, type Slot } from "../rpg";

const SECOES: [Slot, string][] = [
  ["arma", "Armas"],
  ["armadura", "Armaduras"],
  ["companheiro", "Companheiros"],
  ["consumivel", "Poções"],
];

/** Loja do jogo: o ouro vem de derrotar inimigos, missões e chefes. */
export default function Loja({ resumo }: { resumo: Resumo }) {
  const { ouro, itensComprados } = resumo.rpg;
  const nivel = resumo.nivel.nivel;

  // Devolve o motivo de não poder comprar, ou nada se puder.
  const bloqueio = (i: Item): string | undefined => {
    if (i.id === POCAO_DE_GELO) {
      if (resumo.sequencia.congelamentos >= MAX_CONGELAMENTOS) return "gelo cheio";
    } else if (itensComprados.includes(i.id)) return "comprado";
    if (nivel < i.nivel) return `nível ${i.nivel}`;
    if (ouro < i.preco) return `faltam ${i.preco - ouro}`;
  };

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Loja do ferreiro</h2>
        <span className="ouro">🪙 {ouro}</span>
      </div>
      {SECOES.map(([slot, titulo]) => (
        <div key={slot} className="etapa">
          <h3>{titulo}</h3>
          <ul className="itens">
            {ITENS.filter((i) => i.slot === slot).map((i) => {
              const motivo = bloqueio(i);
              const comprado = motivo === "comprado";
              return (
                <li key={i.id} className={comprado ? "comprado" : ""}>
                  <span className="icone" aria-hidden>
                    {i.icone}
                  </span>
                  <span className="item-texto">
                    <strong>{i.nome}</strong>
                    <span className="nota">{i.descricao}</span>
                  </span>
                  {motivo ? (
                    <span className="suave item-preco">{comprado ? "✓ seu" : motivo}</span>
                  ) : (
                    <button
                      className="chip ativo"
                      onClick={() => {
                        if (window.confirm(`Comprar ${i.nome} por ${i.preco} de ouro?`)) void comprarItem(i.id);
                      }}
                    >
                      🪙 {i.preco}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="nota">
        Vale o melhor item de cada tipo. O bônus só conta em treinos e caminhadas feitos depois da compra. A Poção de Gelo protege a sequência num dia de falta, como o congelamento normal.
      </p>
    </section>
  );
}
