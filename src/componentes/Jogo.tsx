import { useState } from "react";
import { criarRecompensa, excluirRecompensa, resgatarRecompensa } from "../db";
import { DANO, VIDA_DO_CHEFE, XP_CHEFE, XP_POR_MISSAO } from "../jogo";
import type { Resumo } from "../resumo";

const dataCurta = (dia: string) => dia.slice(8, 10) + "/" + dia.slice(5, 7);

export default function Jogo({ resumo }: { resumo: Resumo }) {
  const { missoes, chefe, conquistas, plano, recompensas } = resumo.jogo;
  return (
    <>
      <section className="cartao">
        <div className="cartao-topo">
          <h2>Chefe da semana</h2>
          <span className="xp-dia">+{XP_CHEFE} XP</span>
        </div>
        <p className="total pequeno">{chefe.nome}</p>
        <div className="barra grande" role="progressbar" aria-label="Vida do chefe" aria-valuenow={chefe.vida} aria-valuemax={VIDA_DO_CHEFE}>
          <div className="barra-cheia chefe" style={{ width: `${(chefe.vida / VIDA_DO_CHEFE) * 100}%` }} />
        </div>
        <p className="situacao">
          {chefe.derrotado ? "Derrotado nesta semana." : `Vida: ${chefe.vida} de ${VIDA_DO_CHEFE}. Ele volta mais forte toda segunda.`}
        </p>
        <p className="nota">
          Dano: treino {DANO.treino}, caminhada pós-refeição {DANO.caminhada}, meta de água {DANO.metaAgua}, dia garantido {DANO.diaGarantido}. Pausa legítima não causa dano, mas também não
          atrapalha.
        </p>
      </section>

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Missões da semana</h2>
          <span className="xp-dia">+{XP_POR_MISSAO} XP cada</span>
        </div>
        <ul className="lista">
          {missoes.map((m) => (
            <li key={m.id} className="coluna">
              <div className="linha">
                <span className={m.concluida ? "feito" : ""}>{m.titulo}</span>
                <strong className="numero-pequeno">
                  {m.progresso}/{m.meta}
                </strong>
              </div>
              <div className="barra">
                <div className="barra-cheia xp" style={{ width: `${(m.progresso / m.meta) * 100}%` }} />
              </div>
              <span className="nota">Cuidado: {m.risco}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Plano de esteira</h2>
          <span className="suave">semana {plano.semanaDoCiclo} de 4</span>
        </div>
        <p className="total pequeno">{plano.metaMin} min por treino</p>
        <p className="situacao">
          {plano.deload
            ? "Semana leve (deload): menos tempo para o corpo se recuperar. Ela faz parte do plano."
            : `Sobe 5 min por semana e alivia na 4ª. Próxima mudança em ${dataCurta(plano.inicioDaProxima)}.`}
        </p>
        <p className="nota">É uma meta de referência, não dá XP extra. A checagem de glicose continua valendo antes de cada treino.</p>
      </section>

      <Recompensas recompensas={recompensas} nivelAtual={resumo.nivel.nivel} />

      <section className="cartao">
        <h2>Conquistas</h2>
        <ul className="conquistas">
          {conquistas.map((c) => (
            <li key={c.id} className={c.obtida ? "obtida" : ""}>
              <strong>{c.titulo}</strong>
              <span>{c.descricao}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Recompensas({ recompensas, nivelAtual }: { recompensas: Resumo["jogo"]["recompensas"]; nivelAtual: number }) {
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState(nivelAtual + 2);
  return (
    <section className="cartao">
      <h2>Recompensas reais</h2>
      <p className="nota">Coisas que você só se dá ao chegar num nível. Você define; o app libera.</p>
      {recompensas.length > 0 && (
        <ul className="lista">
          {recompensas.map((r) => (
            <li key={r.id}>
              <span className={r.resgatadaEm ? "feito" : ""}>
                {r.nome} <span className="suave">· nível {r.nivel}</span>
              </span>
              {r.resgatadaEm ? (
                <span className="suave">resgatada</span>
              ) : r.liberada ? (
                <button className="chip ativo" onClick={() => void resgatarRecompensa(r.id)}>
                  Resgatar
                </button>
              ) : (
                <button className="link" onClick={() => void excluirRecompensa(r.id)}>
                  excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="etapa"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          void criarRecompensa(nome.trim(), nivel);
          setNome("");
        }}
      >
        <input className="texto" aria-label="Nome da recompensa" placeholder="Ex.: tênis novo de corrida" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="ajuste">
          <div className="passos">
            <button type="button" aria-label="Nível menor" disabled={nivel <= nivelAtual + 1} onClick={() => setNivel(nivel - 1)}>
              −
            </button>
            <strong>nível {nivel}</strong>
            <button type="button" aria-label="Nível maior" onClick={() => setNivel(nivel + 1)}>
              +
            </button>
          </div>
          <button className="principal habito" type="submit" disabled={!nome.trim()}>
            Adicionar
          </button>
        </div>
      </form>
    </section>
  );
}
