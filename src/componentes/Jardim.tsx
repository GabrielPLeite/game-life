// Jardim: vasos que crescem a cada dia de rega seguido. Uma pergunta por dia: reguei ou não.
import { useState } from "react";
import { desfazerRega, guardarVaso, plantarVaso, regar, type Rega, type Vaso } from "../db";
import { ESPECIES, contarJardim, estagio } from "../jardim";
import { MAX_VASOS_COM_XP, XP_POR_REGA, somarDias } from "../regras";

const TINTA = "#2b1d0e";

/** Desenho da planta no vaso, do estágio 0 (semente) ao 6 (árvore em flor). */
export function Planta({ estagio: e, tamanho = 64 }: { estagio: number; tamanho?: number }) {
  const folha = (x: number, y: number, lado: 1 | -1, t = 1) =>
    `<path d="M${x} ${y} q${8 * lado * t} ${-6 * t} ${14 * lado * t} ${-2 * t} q${-6 * lado * t} ${6 * t} ${-14 * lado * t} ${2 * t}z" fill="#4f6b3a"/>`;
  const alturas = [0, 8, 14, 22, 28, 34, 34];
  const h = alturas[e];
  const topo = 46 - h;
  let corpo = "";
  if (e === 0) corpo = `<ellipse cx="32" cy="44" rx="4" ry="2.6" fill="#6b4a2a"/>`;
  else if (e >= 5) {
    corpo =
      `<path d="M32 46 L32 ${topo + 8}" stroke-width="3.2"/>` +
      `<circle cx="32" cy="${topo + 2}" r="13" fill="#3f5a2e"/>` +
      `<circle cx="22" cy="${topo + 8}" r="8" fill="#4f6b3a"/>` +
      `<circle cx="42" cy="${topo + 8}" r="8" fill="#4f6b3a"/>`;
    if (e === 6)
      corpo += [
        [26, topo - 2],
        [37, topo - 4],
        [32, topo + 6],
        [20, topo + 9],
        [44, topo + 7],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#9a2f2f" stroke-width="1.2"/>`)
        .join("");
  } else {
    corpo = `<path d="M32 46 L32 ${topo}" stroke-width="2"/>`;
    const pares = Math.min(e, 4);
    for (let i = 0; i < pares; i++) {
      const y = 44 - (i + 1) * (h / (pares + 0.5));
      corpo += folha(32, y, i % 2 === 0 ? 1 : -1, e >= 3 ? 1 : 0.7);
      if (e >= 3) corpo += folha(32, y + 3, i % 2 === 0 ? -1 : 1, 0.8);
    }
    corpo += `<path d="M32 ${topo} q-3 -5 0 -8 q3 3 0 8z" fill="#5e7d44"/>`;
    // Arbusto: dois galhos laterais com folhas, para ficar visivelmente mais cheio que a planta.
    if (e === 4)
      corpo +=
        `<path d="M32 38 q-8 -2 -12 -10 M32 34 q8 -2 12 -10"/>` +
        folha(20, 28, -1, 0.8) +
        folha(44, 24, 1, 0.8) +
        `<circle cx="20" cy="27" r="3" fill="#4f6b3a"/><circle cx="44" cy="23" r="3" fill="#4f6b3a"/>`;
  }
  const vaso = `<path d="M18 46 h28 l-3 14 h-22z" fill="#8a5434"/><path d="M16 43 h32 v4 h-32z" fill="#a0643c"/>`;
  return (
    <svg
      className="planta"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 64"
      aria-hidden
      fill="none"
      stroke={TINTA}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      dangerouslySetInnerHTML={{ __html: corpo + vaso }}
    />
  );
}

export default function Jardim({ vasos, regas, hoje }: { vasos: Vaso[]; regas: Rega[]; hoje: string }) {
  const ativos = vasos.filter((v) => !v.arquivadoEm).sort((a, b) => a.ordem - b.ordem);
  const [cuidando, setCuidando] = useState(false);
  return (
    <section className="cartao jardim">
      <div className="cartao-topo">
        <h2>Jardim</h2>
        {ativos.length > 0 && (
          <button className="link" onClick={() => setCuidando(!cuidando)}>
            {cuidando ? "Pronto" : "Cuidar"}
          </button>
        )}
      </div>
      {ativos.map((v) => (
        <VasoNoDia key={v.id} vaso={v} regas={regas.filter((r) => r.vasoId === v.id && !r.excluidoEm)} hoje={hoje} cuidando={cuidando} />
      ))}
      {(ativos.length === 0 || cuidando) && <Plantar usados={ativos.map((v) => v.nome)} vazio={ativos.length === 0} />}
      {ativos.length > 0 && (
        <p className="nota">
          Cada vaso respondido vale {XP_POR_REGA} XP no dia, com "reguei" ou com "não"{ativos.length > MAX_VASOS_COM_XP ? ` (até ${MAX_VASOS_COM_XP} vasos)` : ""}.
        </p>
      )}
    </section>
  );
}

function VasoNoDia({ vaso, regas, hoje, cuidando }: { vaso: Vaso; regas: Rega[]; hoje: string; cuidando: boolean }) {
  const ordenadas = [...regas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const c = contarJardim(vaso.desde, ordenadas, hoje);
  const e = estagio(c.dias);
  const ontem = somarDias(hoje, -1);
  const perguntarOntem = c.ontem === undefined && vaso.desde <= ontem;
  return (
    <div className="vaso">
      <Planta estagio={e.indice} />
      <div className="vaso-texto">
        <strong>{vaso.nome}</strong>
        <span>
          {c.dias === 1 ? "1 dia" : `${c.dias} dias`} · {e.nome}
          {c.recorde > c.dias ? ` · recorde ${c.recorde}` : ""}
        </span>
        {e.proximo !== undefined && c.hoje !== false && (
          <small className="suave">
            {e.proximo - c.dias === 1 ? "Falta 1 dia" : `Faltam ${e.proximo - c.dias} dias`} para virar {estagio(e.proximo).nome.toLowerCase()}.
          </small>
        )}

        {perguntarOntem && (
          <div className="rega-ontem">
            <small>Ontem sem resposta:</small>
            <button className="link" onClick={() => void regar(vaso.id, ontem, true)}>
              reguei
            </button>
            <button className="link" onClick={() => void regar(vaso.id, ontem, false)}>
              não reguei
            </button>
          </div>
        )}

        {c.hoje === undefined ? (
          <>
            <div className="botoes">
              <button className="principal" onClick={() => void regar(vaso.id, hoje, true)}>
                Reguei hoje
              </button>
              <button className="discreto" onClick={() => void regar(vaso.id, hoje, false)}>
                Hoje não
              </button>
            </div>
            {c.dias > 0 && <small className="perda">Se faltar hoje, volta a ser semente e perde {c.dias === 1 ? "1 dia" : `${c.dias} dias`} de crescimento.</small>}
          </>
        ) : (
          <small>
            {c.hoje ? `Regado hoje, +${XP_POR_REGA} XP.` : `Hoje ficou sem rega. Responder valeu +${XP_POR_REGA} XP, e amanhã ela começa a brotar de novo.`}{" "}
            <button className="link" onClick={() => void desfazerRega(vaso.id, hoje)}>
              Mudar
            </button>
          </small>
        )}

        {cuidando && (
          <button
            className="link"
            onClick={() => {
              if (window.confirm(`Tirar ${vaso.nome} do jardim? O histórico fica guardado.`)) void guardarVaso(vaso.id);
            }}
          >
            Tirar do jardim
          </button>
        )}
      </div>
    </div>
  );
}

function Plantar({ usados, vazio }: { usados: string[]; vazio: boolean }) {
  const livres = ESPECIES.filter((n) => !usados.includes(n));
  if (livres.length === 0) return null;
  return (
    <div className="etapa">
      <p className="nota">{vazio ? "Plante um vaso e responda uma vez por dia se regou. Cada dia seguido faz a planta crescer." : "Plantar outro vaso:"}</p>
      <div className="chips">
        {livres.map((n) => (
          <button key={n} className="chip" onClick={() => void plantarVaso(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
