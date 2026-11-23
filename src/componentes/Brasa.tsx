import { useEffect, useRef, useState } from "react";
import { alimentarBrasa } from "../db";
import { estagioDe, falaDe, humorDe, janelaAberta, JANELAS, poseDe, proximaJanela, type Humor, type Refeicao, type RefeicaoBrasa, type Situacao } from "../brasa";
import type { Resumo } from "../resumo";

const BASE = import.meta.env.BASE_URL;

/** Relógio que anda a cada minuto, para a Brasa mudar de humor sozinha (fome, sono...). */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const ROTULO_HUMOR: Record<Humor, string> = {
  feliz: "feliz",
  animada: "animada",
  energia: "com energia",
  cansada: "cansada",
  dormindo: "dormindo",
  fome: "com fome",
  satisfeita: "satisfeita",
  sede: "com sede",
  hidratada: "bem hidratada",
  fraca: "fraquinha",
  doente: "de cobertor",
  curiosa: "curiosa",
  carinhosa: "carinhosa",
  irritada: "fingindo estar brava",
};

/** A Brasa no topo do app: pose, fala, crescimento e as refeições do dia. */
export default function Brasa({ resumo, refeicoes, hoje }: { resumo: Resumo; refeicoes: RefeicaoBrasa[]; hoje: string }) {
  const agora = useAgora();
  const [reacao, setReacao] = useState<{ situacao: Situacao; humor?: Humor; n: number } | null>(null);
  const toques = useRef<number[]>([]);

  // A reação a um toque ou à comida dura alguns segundos e some.
  useEffect(() => {
    if (!reacao) return;
    const t = setTimeout(() => setReacao(null), 4500);
    return () => clearTimeout(t);
  }, [reacao]);

  const dias = resumo.sequencia.dias;
  const diasCumpridos = dias.filter((d) => d.resultado === "cumprido").length;
  const ultimoTreino = dias.map((d) => d.resultado).lastIndexOf("cumprido");
  const treinouHoje = resumo.hoje.treinosConcluidos.length > 0;
  const deHoje = refeicoes.filter((r) => r.dia === hoje);
  const comidas = deHoje.map((r) => r.refeicao);
  const ultimaRefeicaoEm = [...refeicoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).at(-1)?.criadoEm;
  const sono = resumo.habitosHoje.filter((h) => h.tipo === "sono" && !h.excluidoEm).at(-1);

  const humorDoDia = humorDe({
    agora,
    treinouHoje,
    diasSemTreino: ultimoTreino < 0 ? undefined : dias.length - 1 - ultimoTreino,
    pausaHoje: !!resumo.hoje.pausa,
    sonoHoras: sono && "horas" in sono ? sono.horas : undefined,
    aguaMl: resumo.hoje.aguaMl,
    metaAguaMl: resumo.hoje.metaAguaMl,
    refeicoesHoje: comidas,
    ultimaRefeicaoEm,
  });
  const humor = reacao?.humor ?? humorDoDia;
  const estagio = estagioDe(diasCumpridos);
  const pose = poseDe(estagio.n, humor);
  // A fala do humor muda a cada hora; a de um toque muda a cada toque.
  const fala = reacao ? falaDe(reacao.situacao, `${hoje}-${reacao.n}`) : falaDe(humorDoDia, `${hoje}-${agora.getHours()}`);

  const janela = janelaAberta(agora);
  const podeComer = janela !== null && !comidas.includes(janela);
  const proxima = proximaJanela(agora);

  const tocar = () => {
    const t = Date.now();
    toques.current = [...toques.current.filter((x) => t - x < 6000), t];
    const muitos = toques.current.length >= 5;
    setReacao({ situacao: muitos ? "toqueDemais" : "toque", humor: muitos ? "irritada" : "carinhosa", n: t });
  };

  const alimentar = async () => {
    if (!janela) return;
    await alimentarBrasa(janela);
    setReacao({ situacao: "alimentou", humor: "satisfeita", n: Date.now() });
  };

  return (
    <section className="cartao brasa" aria-label="Brasa">
      <div className="cartao-topo">
        <h2>Brasa</h2>
        <span className="suave">{estagio.nome}</span>
      </div>

      <div className="brasa-palco">
        <p className="brasa-fala" aria-live="polite">
          {fala}
        </p>
        <button className={`brasa-corpo ${reacao ? "pula" : "respira"}`} onClick={tocar} aria-label={`Brasa está ${ROTULO_HUMOR[humor]}. Toque para fazer carinho.`}>
          <img key={pose.arquivo} src={`${BASE}brasa/${pose.arquivo}.webp`} alt="" draggable={false} />
          {pose.balao && (
            <span className="brasa-balao" aria-hidden>
              {pose.balao}
            </span>
          )}
        </button>
        <span className="suave brasa-humor">{ROTULO_HUMOR[humor]}</span>
      </div>

      <div className="brasa-refeicoes">
        {(Object.keys(JANELAS) as Refeicao[]).map((r) => {
          const comeu = comidas.includes(r);
          const aberta = janela === r;
          return (
            <span key={r} className={`chip ${comeu ? "feito" : aberta ? "aberta" : ""}`}>
              {comeu ? "✓" : aberta ? "🍖" : "·"} {JANELAS[r].nome}
              <small className="suave"> {String(JANELAS[r].inicio).padStart(2, "0")}h</small>
            </span>
          );
        })}
      </div>
      {podeComer ? (
        <button className="principal" onClick={() => void alimentar()}>
          🍖 Alimentar a Brasa ({JANELAS[janela!].nome.toLowerCase()})
        </button>
      ) : (
        <p className="nota">
          {janela ? "Ela já comeu nesta refeição." : proxima ? `Próxima refeição dela: ${JANELAS[proxima].nome.toLowerCase()}, a partir das ${JANELAS[proxima].inicio}h.` : "As refeições de hoje acabaram. Amanhã tem mais."}
        </p>
      )}

      <div className="brasa-crescimento">
        {estagio.proximo ? (
          <>
            <div className="barra" role="progressbar" aria-label={`Crescimento até ${estagio.proximo.nome}`} aria-valuenow={Math.round(estagio.proximo.progresso * 100)} aria-valuemax={100}>
              <div className="barra-cheia xp" style={{ width: `${estagio.proximo.progresso * 100}%` }} />
            </div>
            <p className="nota">
              Faltam {estagio.proximo.faltam} {estagio.proximo.faltam === 1 ? "dia" : "dias"} de treino para ela virar {estagio.proximo.nome}.{" "}
              {treinouHoje ? "🔥 Hoje ela já cresceu." : resumo.hoje.pausa ? "Hoje é pausa: ela não cresce, mas também não perde nada." : "Se faltar hoje, ela não cresce hoje."}
            </p>
          </>
        ) : (
          <p className="nota">Ela chegou ao maior tamanho. Cada treino agora é mais uma história de vocês dois.</p>
        )}
      </div>
    </section>
  );
}
