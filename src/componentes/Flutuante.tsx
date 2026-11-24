// Janelinha da Brasa sempre por cima das outras janelas, no PC (Chrome e Edge).
// Usa a "Picture-in-Picture de documento": é uma janela de verdade do Game Life, com os mesmos dados,
// então dá para alimentar e fazer carinho por ela. Fecha junto quando o Game Life é fechado.

import { useState } from "react";

type PipApi = { requestWindow(o: { width: number; height: number }): Promise<Window> };
const api = () => (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** Copia o CSS do app para a janelinha (ela nasce em branco). */
function copiarEstilos(destino: Document) {
  for (const folha of Array.from(document.styleSheets)) {
    try {
      const st = destino.createElement("style");
      st.textContent = Array.from(folha.cssRules, (r) => r.cssText).join("\n");
      destino.head.appendChild(st);
    } catch {
      if (!folha.href) continue;
      const l = destino.createElement("link");
      l.rel = "stylesheet";
      l.href = folha.href;
      destino.head.appendChild(l);
    }
  }
}

export function useJanelinha() {
  const [janela, setJanela] = useState<Window | null>(null);
  const suportado = typeof window !== "undefined" && !!api();
  const abrir = async () => {
    const pip = api();
    if (!pip) return;
    if (janela) return janela.focus();
    const w = await pip.requestWindow({ width: 230, height: 300 });
    copiarEstilos(w.document);
    w.document.title = "Brasa";
    w.document.body.className = "janelinha-corpo";
    w.addEventListener("pagehide", () => setJanela(null));
    setJanela(w);
  };
  const fechar = () => janela?.close();
  return { suportado, janela, abrir, fechar };
}

export function MiniBrasa(p: {
  imagem: string;
  fala: string;
  legenda: string;
  balao?: string;
  noite: boolean;
  podeComer: boolean;
  onTocar: () => void;
  onAlimentar: () => void;
}) {
  return (
    <div className={`janelinha ${p.noite ? "noite" : ""}`}>
      <p className="janelinha-fala" key={p.fala}>
        {p.fala}
      </p>
      <button className="janelinha-brasa" onClick={p.onTocar} aria-label="Fazer carinho na Brasa">
        <img src={p.imagem} alt="" draggable={false} />
        {p.balao && <span className="brasa-balao">{p.balao}</span>}
      </button>
      <span className="janelinha-legenda">{p.legenda}</span>
      {p.podeComer && (
        <button className="janelinha-comer" onClick={p.onAlimentar}>
          🍖 Alimentar
        </button>
      )}
    </div>
  );
}
