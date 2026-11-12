import { useState } from "react";
import { desfazerUltimaGlicose, registrarGlicose, type Configuracoes, type MomentoGlicose } from "../db";
import { MAX_GLICOSES, XP_POR_GLICOSE } from "../regras";
import type { Resumo } from "../resumo";
import { BlocoSensor } from "./Sensor";

const NOMES_MOMENTO: Record<MomentoGlicose, string> = {
  jejum: "Jejum",
  antes_refeicao: "Antes de refeição",
  depois_refeicao: "Depois de refeição",
  antes_treino: "Antes do treino",
  antes_dormir: "Antes de dormir",
  outro: "Outro",
};
const MOMENTOS_RAPIDOS: MomentoGlicose[] = ["jejum", "antes_refeicao", "depois_refeicao", "antes_dormir", "outro"];

/** Sugere o momento mais provável pelo horário, para economizar um toque. */
function momentoProvavel(): MomentoGlicose {
  const h = new Date().getHours();
  if (h >= 4 && h < 9) return "jejum";
  if (h >= 22 || h < 4) return "antes_dormir";
  return "outro";
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Registro de glicose. O valor nunca muda o XP: só o ato de registrar pontua,
 * para não existir motivo para esconder um pico.
 */
export default function Glicose({ resumo, configuracoes }: { resumo: Resumo; configuracoes: Configuracoes }) {
  const [texto, setTexto] = useState("");
  const [momento, setMomento] = useState<MomentoGlicose>(momentoProvavel());
  const valor = Number(texto);
  const valido = texto !== "" && valor >= 20 && valor <= 600;
  const registros = resumo.hoje.glicoses;
  // Puxar do sensor no dia vale como uma medição.
  const xp = Math.min(registros.length + (resumo.hoje.sensorHoje ? 1 : 0), MAX_GLICOSES) * XP_POR_GLICOSE;

  // Faixa-alvo só para informação (não pontua).
  const faixa = (v: number) => (v < configuracoes.alvoMinimo ? "abaixo do alvo" : v > configuracoes.alvoMaximo ? "acima do alvo" : "no alvo");

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Glicose</h2>
        <span className="xp-dia">
          +{xp} de {MAX_GLICOSES * XP_POR_GLICOSE} XP
        </span>
      </div>
      <BlocoSensor resumo={resumo} />
      <form
        className="etapa"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          void registrarGlicose(valor, momento);
          setTexto("");
        }}
      >
        <div className="linha">
          <input
            aria-label="Glicose em mg/dL"
            className="numero"
            inputMode="numeric"
            pattern="[0-9]*"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
            placeholder="mg/dL"
          />
          <button className="principal glicose" type="submit" disabled={!valido}>
            Registrar
          </button>
        </div>
        <div className="chips" role="group" aria-label="Momento">
          {MOMENTOS_RAPIDOS.map((m) => (
            <button type="button" key={m} className={m === momento ? "chip ativo" : "chip"} aria-pressed={m === momento} onClick={() => setMomento(m)}>
              {NOMES_MOMENTO[m]}
            </button>
          ))}
        </div>
      </form>
      {registros.length > 0 && (
        <>
          <ul className="lista">
            {registros.map((g) => (
              <li key={g.id}>
                <span>
                  <strong>{g.valor}</strong> mg/dL · {NOMES_MOMENTO[g.momento]}
                  {g.origem === "sensor" && " · sensor"}
                </span>
                <span className="suave">
                  {hora(g.criadoEm)} · {faixa(g.valor)}
                </span>
              </li>
            ))}
          </ul>
          <button className="discreto" onClick={() => void desfazerUltimaGlicose()}>
            Desfazer último registro
          </button>
        </>
      )}
      <p className="nota">Registrar dá XP, qualquer que seja o valor. Puxar do sensor vale como uma medição por dia.</p>
    </section>
  );
}
