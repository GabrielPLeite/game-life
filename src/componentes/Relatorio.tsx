import { useState } from "react";
import { estatisticasGlicose } from "../analises";
import { diaLogico } from "../regras";
import type { Resumo } from "../resumo";
import { diasDoPeriodo, type DadosBrutos } from "./Analises";
import { useSensorDoPeriodo } from "./Sensor";
import { ALVO_SENSOR_MAX, ALVO_SENSOR_MIN } from "../sensor";

const ativos = <T extends { excluidoEm?: string }>(xs: T[]) => xs.filter((x) => !x.excluidoEm);
const data = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const MOMENTO: Record<string, string> = { jejum: "jejum", antes_refeicao: "antes ref.", depois_refeicao: "após ref.", antes_treino: "pré-treino", antes_dormir: "ao deitar", outro: "" };
const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Relatório para levar ao médico. Usa a impressão do navegador ("Salvar como PDF"). */
export default function Relatorio({ dados, onFechar }: { dados: DadosBrutos; resumo: Resumo; onFechar: () => void }) {
  const [periodo, setPeriodo] = useState(30);
  const hoje = diaLogico();
  const dias = diasDoPeriodo(hoje, periodo);
  const dentro = <T extends { dia: string }>(xs: T[]) => xs.filter((x) => x.dia >= dias[0] && x.dia <= hoje);
  const c = dados.configuracoes;
  const sensor = useSensorDoPeriodo(dias);
  const horaMs = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const glicose = dentro(ativos(dados.glicose)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const est = estatisticasGlicose(glicose.map((g) => g.valor), c.alvoMinimo, c.alvoMaximo);
  const hipos = glicose.filter((g) => g.valor < c.alvoMinimo);
  const treinos = dentro(ativos(dados.treinos));
  const concluidos = treinos.filter((t) => t.concluidoEm);
  const adiados = treinos.filter((t) => t.adiadoEm);
  const habitos = dentro(ativos(dados.habitos));
  const sonos = habitos.flatMap((h) => (h.tipo === "sono" ? [h.horas] : []));
  const medidas = habitos.flatMap((h) => (h.tipo === "medida" ? [h] : []));
  const diasComBasal = new Set(habitos.filter((h) => h.tipo === "insulina" && h.insulina === "basal").map((h) => h.dia)).size;
  const caminhadas = habitos.filter((h) => h.tipo === "caminhada").length;
  const porDia = dias
    .map((d) => ({ dia: d, gs: glicose.filter((g) => g.dia === d) }))
    .filter((x) => x.gs.length > 0)
    .reverse();

  return (
    <div className="relatorio">
      <div className="nao-imprimir linha">
        <button className="discreto" onClick={onFechar}>
          Voltar
        </button>
        <div className="chips">
          {[14, 30, 90].map((p) => (
            <button key={p} className={p === periodo ? "chip ativo" : "chip"} onClick={() => setPeriodo(p)}>
              {p} dias
            </button>
          ))}
        </div>
      </div>
      <button className="principal habito nao-imprimir" onClick={() => window.print()}>
        Imprimir ou salvar em PDF
      </button>

      <article className="folha">
        <h1>Relatório de acompanhamento</h1>
        <p>
          Período: {data(dias[0])} a {data(hoje)} ({periodo} dias) · Gerado pelo app pessoal Game Life com registros manuais{sensor.leituras.length > 0 && " e leituras do sensor FreeStyle Libre"}.
        </p>
        <p>Paciente: ____________________________</p>

        <h2>Glicose (glicosímetro, ponta de dedo)</h2>
        <table>
          <tbody>
            <tr>
              <th>Medições</th>
              <td>{est.leituras}</td>
              <th>Média</th>
              <td>{est.media ?? "—"} mg/dL</td>
            </tr>
            <tr>
              <th>Desvio padrão</th>
              <td>{est.desvioPadrao ?? "—"} mg/dL</td>
              <th>Coef. de variação</th>
              <td>{est.cv ?? "—"}%</td>
            </tr>
            <tr>
              <th>
                Na faixa {c.alvoMinimo}–{c.alvoMaximo}
              </th>
              <td>{est.noAlvoPct ?? "—"}% das medições</td>
              <th>Abaixo / acima</th>
              <td>
                {est.abaixo} / {est.acima}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="obs">Percentuais calculados sobre medições pontuais, não sobre tempo contínuo.</p>

        {sensor.leituras.length > 0 && (
          <>
            <h2>Sensor contínuo (FreeStyle Libre 2 Plus, via LibreLinkUp)</h2>
            <table>
              <tbody>
                <tr>
                  <th>
                    Tempo no alvo {ALVO_SENSOR_MIN}–{ALVO_SENSOR_MAX}
                  </th>
                  <td>{sensor.total.noAlvoPct ?? "—"}%</td>
                  <th>Média</th>
                  <td>{sensor.total.media ?? "—"} mg/dL</td>
                </tr>
                <tr>
                  <th>Abaixo de {ALVO_SENSOR_MIN}</th>
                  <td>{sensor.total.abaixoPct ?? "—"}%</td>
                  <th>Acima de {ALVO_SENSOR_MAX}</th>
                  <td>{sensor.total.acimaPct ?? "—"}%</td>
                </tr>
                <tr>
                  <th>Tempo com dados</th>
                  <td>{sensor.total.coberturaPct}% do período</td>
                  <th>Episódios abaixo de {ALVO_SENSOR_MIN} (15 min+)</th>
                  <td>{sensor.episodios.length}</td>
                </tr>
              </tbody>
            </table>
            {sensor.episodios.length > 0 && (
              <p className="obs">
                Episódios: {sensor.episodios.map((e) => `${data(diaLogico(new Date(e.inicio)))} ${horaMs(e.inicio)}–${horaMs(e.fim)} (mín. ${e.minimo})`).join(" · ")}
              </p>
            )}
            <p className="obs">
              Percentuais por tempo, considerando só os períodos com leitura. Leituras do LibreLinkUp coletadas por app próprio; podem ter atraso ou lacunas em relação ao app oficial.
            </p>
          </>
        )}

        <h2>Hipoglicemias registradas (abaixo de {c.alvoMinimo} mg/dL)</h2>
        {hipos.length === 0 ? (
          <p>Nenhuma registrada no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Hora</th>
                <th>Valor</th>
                <th>Momento</th>
              </tr>
            </thead>
            <tbody>
              {hipos.map((g) => (
                <tr key={g.id}>
                  <td>{data(g.dia)}</td>
                  <td>{hora(g.criadoEm)}</td>
                  <td>{g.valor} mg/dL</td>
                  <td>{MOMENTO[g.momento]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Atividade e hábitos</h2>
        <table>
          <tbody>
            <tr>
              <th>Treinos concluídos</th>
              <td>
                {concluidos.length} ({concluidos.reduce((s, t) => s + (t.duracaoMin ?? 0), 0)} min no total)
              </td>
            </tr>
            <tr>
              <th>Treinos adiados por glicose</th>
              <td>{adiados.length}</td>
            </tr>
            <tr>
              <th>Caminhadas pós-refeição</th>
              <td>{caminhadas}</td>
            </tr>
            <tr>
              <th>Sono médio</th>
              <td>{sonos.length ? `${num(sonos.reduce((s, h) => s + h, 0) / sonos.length)} h (${sonos.length} noites)` : "—"}</td>
            </tr>
            <tr>
              <th>Peso</th>
              <td>{medidas.some((m) => m.pesoKg) ? medidas.filter((m) => m.pesoKg).map((m) => `${num(m.pesoKg!)} kg (${data(m.dia)})`).join(" → ") : "—"}</td>
            </tr>
            <tr>
              <th>Dias com insulina basal registrada</th>
              <td>
                {diasComBasal} de {periodo}
              </td>
            </tr>
          </tbody>
        </table>

        <h2>Medições por dia</h2>
        <table className="compacta">
          <thead>
            <tr>
              <th>Data</th>
              <th>Medições (mg/dL)</th>
            </tr>
          </thead>
          <tbody>
            {porDia.map(({ dia, gs }) => (
              <tr key={dia}>
                <td>{data(dia)}</td>
                <td>{gs.map((g) => `${hora(g.criadoEm)} ${g.valor}${MOMENTO[g.momento] ? ` (${MOMENTO[g.momento]})` : ""}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
