import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, garantirDia, lerConfiguracoes } from "./db";
import { diaLogico } from "./regras";
import { montarResumo } from "./resumo";
import Cabecalho from "./componentes/Cabecalho";
import EmJogo from "./componentes/EmJogo";
import Treino from "./componentes/Treino";
import Agua from "./componentes/Agua";
import Glicose from "./componentes/Glicose";
import Configuracoes from "./componentes/Configuracoes";

/** Atualiza o "dia do jogo" a cada minuto, para o app virar o dia sozinho às 3h. */
function useDiaLogico() {
  const [dia, setDia] = useState(diaLogico());
  useEffect(() => {
    const t = setInterval(() => setDia(diaLogico()), 60_000);
    return () => clearInterval(t);
  }, []);
  return dia;
}

export default function App() {
  const hoje = useDiaLogico();

  // Cria o registro do dia assim que o app abre.
  useEffect(() => {
    void garantirDia(hoje);
  }, [hoje]);

  // useLiveQuery relê o banco sozinho sempre que algo muda.
  const dados = useLiveQuery(async () => {
    const [configuracoes, dias, agua, glicose, treinos, marcacoes] = await Promise.all([
      lerConfiguracoes(),
      db.dias.toArray(),
      db.agua.toArray(),
      db.glicose.toArray(),
      db.treinos.toArray(),
      db.marcacoes.toArray(),
    ]);
    return { configuracoes, dias, agua, glicose, treinos, marcacoes };
  });

  if (!dados) return null;
  const resumo = montarResumo(dados, hoje);

  return (
    <main>
      <Cabecalho resumo={resumo} />
      <EmJogo resumo={resumo} />
      <Treino resumo={resumo} configuracoes={dados.configuracoes} />
      <Agua resumo={resumo} />
      <Glicose resumo={resumo} configuracoes={dados.configuracoes} />
      <Configuracoes configuracoes={dados.configuracoes} metaAguaHoje={resumo.hoje.metaAguaMl} />
    </main>
  );
}
