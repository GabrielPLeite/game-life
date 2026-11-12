import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, garantirDia, lerConfiguracoes } from "./db";
import { diaLogico } from "./regras";
import { montarResumo } from "./resumo";
import Cabecalho from "./componentes/Cabecalho";
import EmJogo from "./componentes/EmJogo";
import Treino from "./componentes/Treino";
import Agua from "./componentes/Agua";
import Glicose from "./componentes/Glicose";
import Habitos from "./componentes/Habitos";
import Jogo from "./componentes/Jogo";
import Analises from "./componentes/Analises";
import Configuracoes from "./componentes/Configuracoes";
import Batalha, { AvisoDeGolpe, useGolpe } from "./componentes/Batalha";
import CriarHeroi from "./componentes/CriarHeroi";
import { tituloDoNivel } from "./rpg";

/** Atualiza o "dia do jogo" a cada minuto, para o app virar o dia sozinho às 3h. */
function useDiaLogico() {
  const [dia, setDia] = useState(diaLogico());
  useEffect(() => {
    const t = setInterval(() => setDia(diaLogico()), 60_000);
    return () => clearInterval(t);
  }, []);
  return dia;
}

const ABAS = [
  { id: "hoje", nome: "Hoje", icone: "⚔️" },
  { id: "habitos", nome: "Hábitos", icone: "📜" },
  { id: "jogo", nome: "Aventura", icone: "🗺️" },
  { id: "analises", nome: "Análises", icone: "📊" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

/** Lembra a última aba aberta neste aparelho (só conveniência; pode falhar sem problema). */
function useAba(): [Aba, (a: Aba) => void] {
  const [aba, setAba] = useState<Aba>(() => {
    try {
      const salva = localStorage.getItem("aba");
      return ABAS.some((a) => a.id === salva) ? (salva as Aba) : "hoje";
    } catch {
      return "hoje";
    }
  });
  const trocar = (a: Aba) => {
    setAba(a);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem("aba", a);
    } catch {
      /* sem armazenamento: tudo bem */
    }
  };
  return [aba, trocar];
}

export default function App() {
  const hoje = useDiaLogico();
  const [aba, setAba] = useAba();

  // Cria o registro do dia assim que o app abre.
  useEffect(() => {
    void garantirDia(hoje);
  }, [hoje]);

  // useLiveQuery relê o banco sozinho sempre que algo muda.
  const dados = useLiveQuery(async () => {
    const [configuracoes, dias, agua, glicose, treinos, marcacoes, habitos, recompensas, compras] = await Promise.all([
      lerConfiguracoes(),
      db.dias.toArray(),
      db.agua.toArray(),
      db.glicose.toArray(),
      db.treinos.toArray(),
      db.marcacoes.toArray(),
      db.habitos.toArray(),
      db.recompensas.toArray(),
      db.compras.toArray(),
    ]);
    return { configuracoes, dias, agua, glicose, treinos, marcacoes, habitos, recompensas, compras };
  });

  const resumo = dados ? montarResumo(dados, hoje) : undefined;

  // Subida de nível: mostra uma comemoração quando o nível aumenta com o app aberto.
  const nivelAtual = resumo?.nivel.nivel;
  const nivelAnterior = useRef<number | undefined>(undefined);
  const [subiu, setSubiu] = useState<number | null>(null);
  useEffect(() => {
    if (nivelAtual === undefined) return;
    if (nivelAnterior.current !== undefined && nivelAtual > nivelAnterior.current) setSubiu(nivelAtual);
    nivelAnterior.current = nivelAtual;
  }, [nivelAtual]);
  useEffect(() => {
    if (subiu === null) return;
    const t = setTimeout(() => setSubiu(null), 3500);
    return () => clearTimeout(t);
  }, [subiu]);

  const golpe = useGolpe(resumo);

  if (!dados || !resumo) return null;
  if (!dados.configuracoes.heroiNome) return <CriarHeroi />;

  return (
    <>
      <AvisoDeGolpe golpe={golpe} resumo={resumo} />
      <main>
        {aba !== "analises" && <Cabecalho resumo={resumo} />}
        {aba === "hoje" && (
          <>
            <Batalha resumo={resumo} golpe={golpe} compacta />
            <EmJogo resumo={resumo} />
            <Treino resumo={resumo} configuracoes={dados.configuracoes} />
            <Agua resumo={resumo} />
            <Glicose resumo={resumo} configuracoes={dados.configuracoes} />
          </>
        )}
        {aba === "habitos" && <Habitos resumo={resumo} />}
        {aba === "jogo" && <Jogo resumo={resumo} golpe={golpe} />}
        {aba === "analises" && <Analises dados={dados} resumo={resumo} />}
        {aba !== "analises" && (
          <>
            <Configuracoes configuracoes={dados.configuracoes} metaAguaHoje={resumo.hoje.metaAguaMl} />
            <p className="nota versao">Versão {__VERSAO__}</p>
          </>
        )}
      </main>
      {subiu !== null && (
        <button className="tela-cheia subiu" onClick={() => setSubiu(null)} aria-live="assertive">
          <span className="brilho" aria-hidden>
            ✨
          </span>
          <strong>Nível {subiu}!</strong>
          <span>Você agora é {tituloDoNivel(subiu)}.</span>
          <span className="nota">toque para continuar</span>
        </button>
      )}
      <nav className="abas nao-imprimir" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} className={a.id === aba ? "ativa" : ""} aria-current={a.id === aba ? "page" : undefined} onClick={() => setAba(a.id)}>
            <span aria-hidden>{a.icone}</span>
            {a.nome}
          </button>
        ))}
      </nav>
    </>
  );
}
