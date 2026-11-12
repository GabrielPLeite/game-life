import { useEffect, useRef, useState } from "react";
import type { Resumo } from "../resumo";
import { NOME_DO_GOLPE, inimigoNumero } from "../rpg";
import { INIMIGOS_ARTE, desenhoDoHeroi } from "../sprites";
import Sprite from "./Sprite";

export interface Golpe { id: number; dano: number; d20: number; critico: boolean; derrotou?: { nome: string; ouro: number }; }

/** Avisa quando o dano total sobe (um registro novo), para animar o golpe. Não dispara na abertura do app. */
export function useGolpe(resumo: Resumo | undefined): Golpe | null {
  const batalha = resumo?.rpg.batalha;
  const anterior = useRef<{ dano: number; indice: number } | null>(null);
  const [golpe, setGolpe] = useState<Golpe | null>(null);
  useEffect(() => {
    if (!batalha) return;
    const antes = anterior.current;
    anterior.current = { dano: batalha.danoTotal, indice: batalha.indice };
    if (!antes || batalha.danoTotal <= antes.dano) return;
    const caiu = batalha.indice > antes.indice ? inimigoNumero(batalha.indice - 1) : undefined;
    setGolpe({
      id: Date.now(),
      dano: batalha.danoTotal - antes.dano,
      d20: batalha.ultimo?.d20 ?? 10,
      critico: batalha.ultimo?.critico ?? false,
      derrotou: caiu && { nome: caiu.nome, ouro: caiu.ouro },
    });
    const t = setTimeout(() => setGolpe(null), 1800);
    return () => clearTimeout(t);
  }, [batalha?.danoTotal, batalha?.indice]); // eslint-disable-line react-hooks/exhaustive-deps
  return golpe;
}

/** Aviso flutuante no topo: mostra o golpe mesmo quando a arena está fora da tela. */
export function AvisoDeGolpe({ golpe, resumo }: { golpe: Golpe | null; resumo: Resumo }) {
  if (!golpe) return null;
  const inimigo = resumo.rpg.batalha.inimigo;
  return (
    <div className="aviso-golpe nao-imprimir" key={golpe.id} role="status">
      <span className={`dado pequeno ${golpe.critico ? "critico" : ""}`}>{golpe.d20}</span>
      <span>
        {golpe.derrotou ? (
          <>
            <strong>{golpe.derrotou.nome} derrotado!</strong> <span className="ouro">+{golpe.derrotou.ouro} 🪙</span>
          </>
        ) : (
          <>
            <strong className={golpe.critico ? "critico" : ""}>{golpe.critico ? "Crítico! " : ""}−{golpe.dano}</strong> em {inimigo.nome}
          </>
        )}
      </span>
      <Sprite desenho={INIMIGOS_ARTE[inimigo.id]} tamanho={32} className="apanha" />
    </div>
  );
}

/**
 * Arena: o herói contra o inimigo atual da campanha.
 * Cada registro real (treino, água, glicose, hábito) vira um golpe animado.
 */
export default function Batalha({ resumo, golpe, compacta = false }: { resumo: Resumo; golpe: Golpe | null; compacta?: boolean }) {
  const { batalha, ataquesHoje, classe } = resumo.rpg;

  const inimigo = batalha.inimigo;
  const danoHoje = ataquesHoje.reduce((s, a) => s + a.dano, 0);
  return (
    <section className="cartao arena-cartao">
      <div className="cartao-topo">
        <h2>Batalha</h2>
        <span className="suave">inimigo nº {batalha.indice + 1}</span>
      </div>
      <div className={`arena ${golpe ? "em-golpe" : ""}`}>
        <div className="lutador" key={golpe ? `h${golpe.id}` : "h"}>
          <Sprite desenho={desenhoDoHeroi(classe ?? "guerreiro")} tamanho={88} className={golpe ? "avanca" : "respira"} />
        </div>
        <div className="centro" aria-hidden>
          {golpe ? (
            <span key={golpe.id} className={`dado rola ${golpe.critico ? "critico" : ""}`}>
              {golpe.d20}
            </span>
          ) : (
            <span className="versus">VS</span>
          )}
        </div>
        <div className="lutador" key={golpe ? `i${golpe.id}` : `i${batalha.indice}`}>
          <Sprite desenho={INIMIGOS_ARTE[inimigo.id]} tamanho={88} className={golpe ? "apanha" : "flutua"} rotulo={inimigo.nome} />
          {golpe && (
            <span className={`dano-flutuante ${golpe.critico ? "critico" : ""}`}>
              −{golpe.dano}
              {golpe.critico ? "!" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="linha">
        <strong>{inimigo.nome}</strong>
        <span className="numero-pequeno suave">
          ❤️ {batalha.hp}/{inimigo.hp} · 🪙 {inimigo.ouro}
        </span>
      </div>
      <div className="barra grande" role="progressbar" aria-label="Vida do inimigo" aria-valuenow={batalha.hp} aria-valuemax={inimigo.hp}>
        <div className="barra-cheia chefe" style={{ width: `${(batalha.hp / inimigo.hp) * 100}%` }} />
      </div>
      <p className="situacao" aria-live="polite">
        {golpe?.derrotou
          ? `${golpe.derrotou.nome} derrotado! +${golpe.derrotou.ouro} de ouro. Um novo inimigo apareceu.`
          : golpe
            ? `${golpe.critico ? "Acerto crítico! " : ""}Você causou ${golpe.dano} de dano.`
            : danoHoje > 0
              ? `Hoje você já causou ${danoHoje} de dano em ${ataquesHoje.length} ${ataquesHoje.length === 1 ? "golpe" : "golpes"}.`
              : "Cada registro seu vira um golpe: treino, água, glicose, hábitos."}
      </p>
      {!compacta && ataquesHoje.length > 0 && (
        <ul className="diario">
          {[...ataquesHoje].reverse().slice(0, 6).map((a) => (
            <li key={a.chave}>
              <span>{NOME_DO_GOLPE[a.tipo]}</span>
              <span className={`numero-pequeno ${a.critico ? "critico" : "suave"}`}>
                🎲 {a.d20} · {a.dano} de dano
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
