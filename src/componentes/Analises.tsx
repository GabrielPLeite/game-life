import { useState } from "react";
import { compararGrupos, estatisticasGlicose, paraCsv, type EstatisticasGlicose } from "../analises";
import type { Configuracoes, Habito, RegistroAgua, RegistroGlicose, RegistroTreino } from "../db";
import { diaLogico, inicioDaSemana, somarDias } from "../regras";
import type { Resumo } from "../resumo";
import Relatorio from "./Relatorio";

export interface DadosBrutos {
  configuracoes: Configuracoes;
  glicose: RegistroGlicose[];
  treinos: RegistroTreino[];
  habitos: Habito[];
  agua: RegistroAgua[];
}

const ativos = <T extends { excluidoEm?: string }>(xs: T[]) => xs.filter((x) => !x.excluidoEm);
const dataCurta = (dia: string) => dia.slice(8, 10) + "/" + dia.slice(5, 7);
const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

/** Lista de dias do período, do mais antigo a hoje. */
export function diasDoPeriodo(hoje: string, n: number) {
  return Array.from({ length: n }, (_, i) => somarDias(hoje, i - n + 1));
}

/** Baixa um texto como arquivo. */
export function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Analises({ dados, resumo }: { dados: DadosBrutos; resumo: Resumo }) {
  const [periodo, setPeriodo] = useState(14);
  const [relatorio, setRelatorio] = useState(false);
  const hoje = diaLogico();
  const c = dados.configuracoes;
  const glicose = ativos(dados.glicose);
  const dias = diasDoPeriodo(hoje, periodo);
  const noPeriodo = glicose.filter((g) => g.dia >= dias[0]);
  const est = estatisticasGlicose(noPeriodo.map((g) => g.valor), c.alvoMinimo, c.alvoMaximo);

  if (relatorio) return <Relatorio dados={dados} resumo={resumo} onFechar={() => setRelatorio(false)} />;

  return (
    <>
      <section className="cartao">
        <div className="cartao-topo">
          <h2>Glicose</h2>
          <div className="chips" role="group" aria-label="Período">
            {[7, 14, 30].map((p) => (
              <button key={p} className={p === periodo ? "chip ativo" : "chip"} aria-pressed={p === periodo} onClick={() => setPeriodo(p)}>
                {p} dias
              </button>
            ))}
          </div>
        </div>
        <Numeros est={est} />
        <GraficoGlicose dias={dias} glicose={noPeriodo} alvoMin={c.alvoMinimo} alvoMax={c.alvoMaximo} />
        <p className="nota">
          Com medições na ponta do dedo, "no alvo" é a porcentagem das medições entre {c.alvoMinimo} e {c.alvoMaximo} mg/dL, não do tempo real do dia. Variação (CV) abaixo de 36% costuma
          indicar glicose estável.
        </p>
      </section>

      <Correlacoes dados={dados} hoje={hoje} />
      <RevisaoSemanal resumo={resumo} glicose={glicose} hoje={hoje} c={c} />

      <section className="cartao">
        <h2>Relatório e exportação</h2>
        <button className="principal habito" onClick={() => setRelatorio(true)}>
          Relatório para o médico
        </button>
        <button className="discreto" onClick={() => exportarCsv(dados)}>
          Exportar tudo em CSV (planilha)
        </button>
      </section>
    </>
  );
}

function Numeros({ est }: { est: EstatisticasGlicose }) {
  const item = (rotulo: string, valor: string) => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
  const v = (n: number | null, sufixo = "") => (n === null ? "—" : `${n}${sufixo}`);
  return (
    <dl className="numeros">
      {item("Média", v(est.media, " mg/dL"))}
      {item("No alvo", v(est.noAlvoPct, "%"))}
      {item("Variação", v(est.cv, "%"))}
      {item("Medições", `${est.leituras}`)}
      {item("Abaixo", `${est.abaixo}`)}
      {item("Acima", `${est.acima}`)}
    </dl>
  );
}

/** Por dia: ponto na média e traço do menor ao maior valor. A faixa clara é o alvo. */
function GraficoGlicose({ dias, glicose, alvoMin, alvoMax }: { dias: string[]; glicose: RegistroGlicose[]; alvoMin: number; alvoMax: number }) {
  const L = 320,
    A = 180,
    m = { e: 30, d: 6, t: 8, b: 20 };
  const valores = glicose.map((g) => g.valor);
  const max = Math.max(250, ...valores);
  const min = Math.min(40, ...valores);
  const y = (v: number) => m.t + (1 - (v - min) / (max - min)) * (A - m.t - m.b);
  const passo = (L - m.e - m.d) / dias.length;
  const x = (i: number) => m.e + passo * (i + 0.5);
  const marcas = [alvoMin, alvoMax, ...(max > 250 ? [Math.round(max / 50) * 50] : [250])];
  const rotuloACada = dias.length > 14 ? 7 : dias.length > 7 ? 2 : 1;

  if (glicose.length === 0) return <p className="situacao">Sem medições neste período ainda.</p>;
  return (
    <svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Glicose por dia: média, mínimo e máximo">
      <rect x={m.e} width={L - m.e - m.d} y={y(alvoMax)} height={y(alvoMin) - y(alvoMax)} className="faixa-alvo" />
      {marcas.map((v) => (
        <g key={v}>
          <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="grade" />
          <text x={m.e - 4} y={y(v) + 3} className="eixo" textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {dias.map((d, i) => {
        const vs = glicose.filter((g) => g.dia === d).map((g) => g.valor);
        // Rótulo a cada N dias, sempre no último, sem encostar no penúltimo rótulo.
        const ultimo = i === dias.length - 1;
        const rot = ultimo || (i % rotuloACada === 0 && dias.length - 1 - i >= rotuloACada);
        return (
          <g key={d}>
            {rot && (
              <text x={x(i)} y={A - 6} className="eixo" textAnchor="middle">
                {dataCurta(d)}
              </text>
            )}
            {vs.length > 0 && (
              <g className="ponto">
                <title>
                  {dataCurta(d)}: média {media(vs)} mg/dL, de {Math.min(...vs)} a {Math.max(...vs)} ({vs.length} {vs.length === 1 ? "medição" : "medições"})
                </title>
                <rect x={x(i) - passo / 2} width={passo} y={0} height={A} fill="transparent" />
                {vs.length > 1 && <line x1={x(i)} x2={x(i)} y1={y(Math.max(...vs))} y2={y(Math.min(...vs))} className="bigode" />}
                <circle cx={x(i)} cy={y(media(vs)!)} r={4} className="marca" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Correlacoes({ dados, hoje }: { dados: DadosBrutos; hoje: string }) {
  const dias = diasDoPeriodo(hoje, 60);
  const glicose = ativos(dados.glicose);
  const treinos = ativos(dados.treinos).filter((t) => t.concluidoEm);
  const habitos = ativos(dados.habitos);
  const mediaDoDia = (d: string, filtro: (g: RegistroGlicose) => boolean = () => true) => media(glicose.filter((g) => g.dia === d && filtro(g)).map((g) => g.valor));

  const comparacoes = [
    {
      titulo: "Glicose média em dias com treino e sem treino",
      r: compararGrupos(dias.map((d) => ({ grupo: treinos.some((t) => t.dia === d), valor: mediaDoDia(d) }))),
      rotulos: ["com treino", "sem treino"],
    },
    {
      titulo: "Glicose depois de refeição, com e sem caminhada no dia",
      r: compararGrupos(dias.map((d) => ({ grupo: habitos.some((h) => h.tipo === "caminhada" && h.dia === d), valor: mediaDoDia(d, (g) => g.momento === "depois_refeicao") }))),
      rotulos: ["com caminhada", "sem caminhada"],
    },
    {
      titulo: "Glicose em jejum depois de dormir 7 h ou mais",
      r: compararGrupos(
        dias.map((d) => {
          const sono = habitos.find((h) => h.tipo === "sono" && h.dia === d);
          return { grupo: !!sono && sono.tipo === "sono" && sono.horas >= 7, valor: sono ? mediaDoDia(d, (g) => g.momento === "jejum") : null };
        }),
      ),
      rotulos: ["7 h ou mais", "menos de 7 h"],
    },
  ];

  return (
    <section className="cartao">
      <h2>O que parece influenciar sua glicose</h2>
      <ul className="lista">
        {comparacoes.map(({ titulo, r, rotulos }) => (
          <li key={titulo} className="coluna">
            <span>{titulo}</span>
            {r.suficiente ? (
              <span className="suave">
                <strong className="texto-forte">{r.comMedia}</strong> mg/dL {rotulos[0]} ({r.diasCom} dias) · <strong className="texto-forte">{r.semMedia}</strong> mg/dL {rotulos[1]} ({r.diasSem}{" "}
                dias)
              </span>
            ) : (
              <span className="suave">
                Ainda faltam dados: precisa de 3 dias em cada grupo (tem {r.diasCom} e {r.diasSem}).
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="nota">Últimos 60 dias. Mostra uma associação, não uma causa: leve para conversar com seu médico.</p>
    </section>
  );
}

function RevisaoSemanal({ resumo, glicose, hoje, c }: { resumo: Resumo; glicose: RegistroGlicose[]; hoje: string; c: Configuracoes }) {
  const esta = inicioDaSemana(hoje);
  const passada = somarDias(esta, -7);
  const linha = (inicio: string) => {
    const fim = somarDias(inicio, 6);
    const ds = resumo.diasResumidos.filter((d) => d.dia >= inicio && d.dia <= fim);
    const est = estatisticasGlicose(
      glicose.filter((g) => g.dia >= inicio && g.dia <= fim).map((g) => g.valor),
      c.alvoMinimo,
      c.alvoMaximo,
    );
    return {
      garantidos: ds.filter((d) => d.garantido).length,
      treinos: ds.reduce((s, d) => s + d.treinos, 0),
      agua: ds.filter((d) => d.metaAgua).length,
      caminhadas: ds.reduce((s, d) => s + d.caminhadas, 0),
      media: est.media,
      alvo: est.noAlvoPct,
    };
  };
  const a = linha(esta);
  const b = linha(passada);
  const v = (n: number | null, s = "") => (n === null ? "—" : `${n}${s}`);
  const linhas: [string, string, string][] = [
    ["Dias garantidos", v(a.garantidos), v(b.garantidos)],
    ["Treinos", v(a.treinos), v(b.treinos)],
    ["Dias com meta de água", v(a.agua), v(b.agua)],
    ["Caminhadas pós-refeição", v(a.caminhadas), v(b.caminhadas)],
    ["Glicose média (mg/dL)", v(a.media), v(b.media)],
    ["Medições no alvo", v(a.alvo, "%"), v(b.alvo, "%")],
  ];
  return (
    <section className="cartao">
      <h2>Revisão da semana</h2>
      <table className="tabela">
        <thead>
          <tr>
            <th></th>
            <th>Esta semana</th>
            <th>Semana passada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([r, x, y]) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              <td>{x}</td>
              <td>{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">Missões concluídas nesta semana: {resumo.jogo.missoes.filter((m) => m.concluida).length} de {resumo.jogo.missoes.length}.</p>
    </section>
  );
}

function exportarCsv(dados: DadosBrutos) {
  const linhas = [
    ...ativos(dados.glicose).map((g) => ({ registro: "glicose", dia: g.dia, horario: g.criadoEm, valor: g.valor, unidade: "mg/dL", detalhe: g.momento })),
    ...ativos(dados.treinos).map((t) => ({
      registro: t.adiadoEm ? "treino adiado" : "treino",
      dia: t.dia,
      horario: t.criadoEm,
      valor: t.duracaoMin,
      unidade: "min",
      detalhe: [t.tipo, t.turno, t.checagem].filter(Boolean).join(" "),
    })),
    ...ativos(dados.agua).map((x) => ({ registro: "agua", dia: x.dia, horario: x.criadoEm, valor: x.ml, unidade: "ml", detalhe: "" })),
    ...ativos(dados.habitos).map((h) => {
      const base = { registro: h.tipo, dia: h.dia, horario: h.criadoEm };
      switch (h.tipo) {
        case "refeicao":
          return { ...base, valor: h.carboidratosG, unidade: "g carbo", detalhe: `${h.descricao} (${h.contexto})` };
        case "caminhada":
          return { ...base, valor: h.minutos, unidade: "min", detalhe: "pós-refeição" };
        case "sono":
          return { ...base, valor: h.horas, unidade: "h", detalhe: "" };
        case "medida":
          return { ...base, valor: h.pesoKg, unidade: "kg", detalhe: h.cinturaCm !== undefined ? `cintura ${h.cinturaCm} cm` : "" };
        case "insulina":
          return { ...base, valor: h.unidades, unidade: "U", detalhe: h.insulina };
      }
    }),
  ].sort((a, b) => a.horario.localeCompare(b.horario));
  baixar(`game-life-${diaLogico()}.csv`, paraCsv(linhas), "text/csv;charset=utf-8");
}
