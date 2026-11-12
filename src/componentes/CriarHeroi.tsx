import { useState } from "react";
import { salvarConfiguracoes } from "../db";
import { CLASSES, type Classe } from "../rpg";
import { desenhoDoHeroi } from "../sprites";
import Sprite from "./Sprite";

/** Primeira tela do jogo: dar nome ao herói e escolher a classe. */
export default function CriarHeroi() {
  const [nome, setNome] = useState("");
  const [classe, setClasse] = useState<Classe>("guerreiro");
  return (
    <div className="tela-cheia" role="dialog" aria-modal="true" aria-labelledby="criar-titulo">
      <form
        className="cartao criar"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim()) void salvarConfiguracoes({ heroiNome: nome.trim(), heroiClasse: classe });
        }}
      >
        <h1 id="criar-titulo">Crie seu herói</h1>
        <p className="situacao">Cada treino, copo de água e medição vira um golpe nos monstros. Seu herói cresce com o que você faz de verdade.</p>
        <input className="texto" aria-label="Nome do herói" placeholder="Nome do herói" maxLength={20} value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="classes">
          {(Object.keys(CLASSES) as Classe[]).map((c) => (
            <button type="button" key={c} className={`classe ${c === classe ? "ativa" : ""}`} aria-pressed={c === classe} onClick={() => setClasse(c)}>
              <Sprite desenho={desenhoDoHeroi(c)} tamanho={64} />
              <strong>{CLASSES[c].nome}</strong>
              <span className="nota">{CLASSES[c].descricao}</span>
            </button>
          ))}
        </div>
        <p className="nota">A classe dá um bônus pequeno e muda o visual. Todas ganham o mesmo XP; nenhuma depende do valor da glicose.</p>
        <button className="principal" type="submit" disabled={!nome.trim()}>
          Começar a aventura
        </button>
      </form>
    </div>
  );
}
