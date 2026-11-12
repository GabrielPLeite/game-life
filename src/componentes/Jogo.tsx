import { useState } from "react";
import { criarRecompensa, excluirRecompensa, resgatarRecompensa, salvarConfiguracoes } from "../db";
import { DANO, VIDA_DO_CHEFE, XP_CHEFE, XP_POR_MISSAO } from "../jogo";
import type { Resumo } from "../resumo";
import { CLASSES, INIMIGOS, OURO_POR_CHEFE, OURO_POR_MISSAO } from "../rpg";
import { CHEFES_ARTE, INIMIGOS_ARTE } from "../sprites";
import Batalha, { type Golpe } from "./Batalha";
import Loja from "./Loja";
import Sprite from "./Sprite";

const dataCurta = (dia: string) => dia.slice(8, 10) + "/" + dia.slice(5, 7);
const comSinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Aba Aventura: ficha, batalha, chefe, missões, loja, recompensas, bestiário e conquistas. */
export default function Jogo({ resumo, golpe }: { resumo: Resumo; golpe: Golpe | null }) {
  const { missoes, chefe, conquistas, plano, recompensas } = resumo.jogo;
  const r = resumo.rpg;
  return (
    <>
      <section className="cartao">
        <div className="cartao-topo">
          <h2>Ficha do herói</h2>
          <button
            className="link"
            onClick={() => {
              const novo = window.prompt("Nome do herói", r.nome ?? "");
              if (novo?.trim()) void salvarConfiguracoes({ heroiNome: novo.trim().slice(0, 20) });
            }}
          >
            renomear
          </button>
        </div>
        <ul className="atributos">
          {r.atributos.map((a) => (
            <li key={a.sigla} title={a.origem}>
              <span className="sigla">{a.sigla}</span>
              <strong>{a.valor}</strong>
              <span className="mod">{comSinal(a.mod)}</span>
            </li>
          ))}
        </ul>
        <p className="nota">
          Os atributos sobem com a vida real: FOR com treinos, DES com caminhadas, CON com dias de meta de água, INT com refeições registradas, SAB com dias medindo a glicose, CAR com sono e
          recorde de sequência. {r.classe ? CLASSES[r.classe].descricao : ""}
        </p>
      </section>

      <Batalha resumo={resumo} golpe={golpe} />

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Chefe da semana</h2>
          <span className="xp-dia">
            +{XP_CHEFE} XP · 🪙 {OURO_POR_CHEFE}
          </span>
        </div>
        <div className="chefe-palco">
          <Sprite desenho={CHEFES_ARTE[chefe.id]} tamanho={128} className={chefe.derrotado ? "caido" : "flutua"} rotulo={chefe.nome} />
        </div>
        <p className="total pequeno">{chefe.nome}</p>
        <div className="barra grande" role="progressbar" aria-label="Vida do chefe" aria-valuenow={chefe.vida} aria-valuemax={VIDA_DO_CHEFE}>
          <div className="barra-cheia chefe" style={{ width: `${(chefe.vida / VIDA_DO_CHEFE) * 100}%` }} />
        </div>
        <p className="situacao">{chefe.derrotado ? "Derrotado nesta semana. Outro chefe chega na segunda." : `Vida: ${chefe.vida} de ${VIDA_DO_CHEFE}. Um chefe novo aparece toda segunda.`}</p>
        <p className="nota">
          Dano no chefe: treino {DANO.treino}, caminhada pós-refeição {DANO.caminhada}, meta de água {DANO.metaAgua}, dia garantido {DANO.diaGarantido}. Pausa legítima não causa dano no chefe, mas
          também não atrapalha.
        </p>
      </section>

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Missões da semana</h2>
          <span className="xp-dia">
            +{XP_POR_MISSAO} XP · 🪙 {OURO_POR_MISSAO}
          </span>
        </div>
        <ul className="lista">
          {missoes.map((m) => (
            <li key={m.id} className="coluna">
              <div className="linha">
                <span className={m.concluida ? "feito" : ""}>
                  {m.concluida ? "✓ " : "📜 "}
                  {m.titulo}
                </span>
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

      <Loja resumo={resumo} />

      <Recompensas recompensas={recompensas} nivelAtual={resumo.nivel.nivel} />

      <section className="cartao">
        <div className="cartao-topo">
          <h2>Bestiário</h2>
          <span className="suave">{r.batalha.totalDerrotados} derrotados</span>
        </div>
        <ul className="bestiario">
          {INIMIGOS.map((i) => {
            const vezes = r.batalha.derrotados[i.id] ?? 0;
            const visto = vezes > 0 || r.batalha.inimigo.id === i.id;
            return (
              <li key={i.id} className={visto ? "" : "oculto"}>
                <Sprite desenho={INIMIGOS_ARTE[i.id]} tamanho={56} />
                <strong>{visto ? i.nome : "???"}</strong>
                <span className="nota">{vezes > 0 ? `derrotado ${vezes}×` : visto ? "em combate" : "ainda não visto"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="cartao">
        <h2>Conquistas</h2>
        <ul className="conquistas">
          {conquistas.map((c) => (
            <li key={c.id} className={c.obtida ? "obtida" : ""}>
              <strong>
                {c.obtida ? "🏅 " : "🔒 "}
                {c.titulo}
              </strong>
              <span>{c.descricao}</span>
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
    </>
  );
}

function Recompensas({ recompensas, nivelAtual }: { recompensas: Resumo["jogo"]["recompensas"]; nivelAtual: number }) {
  const [nome, setNome] = useState("");
  const [porOuro, setPorOuro] = useState(true);
  const [nivel, setNivel] = useState(nivelAtual + 2);
  const [custo, setCusto] = useState(300);
  return (
    <section className="cartao">
      <h2>Tesouros reais</h2>
      <p className="nota">Prêmios da vida real que você mesmo define: compre com ouro ou libere ao chegar num nível.</p>
      {recompensas.length > 0 && (
        <ul className="lista">
          {recompensas.map((r) => (
            <li key={r.id}>
              <span className={r.resgatadaEm ? "feito" : ""}>
                🎁 {r.nome} <span className="suave">· {r.custoOuro ? `🪙 ${r.custoOuro}` : `nível ${r.nivel}`}</span>
              </span>
              {r.resgatadaEm ? (
                <span className="suave">resgatada</span>
              ) : r.liberada ? (
                <button
                  className="chip ativo"
                  onClick={() => {
                    if (!r.custoOuro || window.confirm(`Gastar ${r.custoOuro} de ouro em "${r.nome}"?`)) void resgatarRecompensa(r.id);
                  }}
                >
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
          void criarRecompensa(nome.trim(), porOuro ? 1 : nivel, porOuro ? custo : undefined);
          setNome("");
        }}
      >
        <input className="texto" aria-label="Nome da recompensa" placeholder="Ex.: tênis novo de corrida" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="chips">
          <button type="button" className={`chip ${porOuro ? "ativo" : ""}`} aria-pressed={porOuro} onClick={() => setPorOuro(true)}>
            Pagar com ouro
          </button>
          <button type="button" className={`chip ${porOuro ? "" : "ativo"}`} aria-pressed={!porOuro} onClick={() => setPorOuro(false)}>
            Liberar por nível
          </button>
        </div>
        <div className="ajuste">
          <div className="passos">
            <button type="button" aria-label="Menos" disabled={porOuro ? custo <= 50 : nivel <= nivelAtual + 1} onClick={() => (porOuro ? setCusto(custo - 50) : setNivel(nivel - 1))}>
              −
            </button>
            <strong>{porOuro ? `🪙 ${custo}` : `nível ${nivel}`}</strong>
            <button type="button" aria-label="Mais" onClick={() => (porOuro ? setCusto(custo + 50) : setNivel(nivel + 1))}>
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
