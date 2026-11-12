// Tudo o que a tela mostra sobre o sensor (dados vindos do app Glicose).
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { guardarPacoteSensor, leiturasDoSensorDesde } from "../db";
import type { Resumo } from "../resumo";
import { diaLogico } from "../regras";
import {
  ALVO_SENSOR_MAX,
  ALVO_SENSOR_MIN,
  COBERTURA_MINIMA_PCT,
  NOMES_TENDENCIA,
  SETAS,
  episodiosAbaixo,
  inicioDoDiaDoJogo,
  lerPacote,
  linkPuxarDoSensor,
  paraGuardar,
  tempoNoAlvo,
  tempoNoAlvoDoDia,
  type LeituraSensor,
  type Tendencia,
} from "../sensor";

const PREFIXO = "#sensor=";
const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const minutosAtras = (ms: number, agora = Date.now()) => Math.max(0, Math.round((agora - ms) / 60000));

/** Endereço do próprio Game Life, para o app Glicose devolver os dados. */
const enderecoDoApp = () => `${location.origin}${import.meta.env.BASE_URL}`;

/**
 * Recebe os dados quando o app Glicose abre o Game Life com "#sensor=..." no endereço.
 * Funciona tanto com o app abrindo do zero quanto já aberto (evento hashchange).
 * Devolve a mensagem para mostrar no topo da tela.
 */
export function useImportarSensor(): [string | null, () => void] {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    const importar = async () => {
      if (!location.hash.startsWith(PREFIXO)) return;
      const texto = decodeURIComponent(location.hash.slice(PREFIXO.length));
      // Limpa o endereço para não importar de novo ao recarregar.
      history.replaceState(null, "", location.pathname + location.search);
      const r = lerPacote(texto);
      if (!r.ok) {
        setAviso(
          r.motivo === "sem-app"
            ? "Não encontrei o app Glicose neste celular. Registre a glicose à mão por enquanto."
            : "O app Glicose não conseguiu entregar os dados. Tente de novo ou registre à mão.",
        );
        return;
      }
      const { pacote } = r;
      const leituras = paraGuardar(pacote);
      if (leituras.length === 0) {
        setAviso("O app Glicose ainda não tem leituras guardadas. Ligue o monitoramento nele ou registre à mão.");
        return;
      }
      await guardarPacoteSensor(leituras, {
        tendencia: pacote.tendencia,
        atualTs: pacote.atual?.ts,
        atualValor: pacote.atual?.valor,
        servicoLigado: pacote.servicoLigado,
      });
      const ultima = pacote.atual ?? leituras.at(-1)!;
      const idade = minutosAtras(ultima.ts);
      setAviso(
        `${leituras.length} leituras recebidas. Última: ${ultima.valor} mg/dL ${SETAS[pacote.tendencia]} (há ${idade} min).` +
          (pacote.servicoLigado ? "" : " O monitoramento do app Glicose está desligado."),
      );
    };
    void importar();
    const aoMudar = () => void importar();
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return [aviso, () => setAviso(null)];
}

/** Faixa no topo com o resultado da importação. Toque para fechar. */
export function AvisoSensor({ texto, onFechar }: { texto: string | null; onFechar: () => void }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(onFechar, 6000);
    return () => clearTimeout(t);
  }, [texto, onFechar]);
  if (!texto) return null;
  return (
    <button className="aviso-sensor" onClick={onFechar} aria-live="polite">
      {texto}
    </button>
  );
}

/** Leituras do sensor desde um horário, sempre atualizadas. */
export function useLeiturasSensor(desdeMs: number): LeituraSensor[] | undefined {
  // Arredonda para o minuto, para a consulta não refazer a cada render.
  const desde = Math.floor(desdeMs / 60000) * 60000;
  return useLiveQuery(() => leiturasDoSensorDesde(desde), [desde]);
}

/** Botão que abre o app Glicose para puxar as leituras. É um link porque o Android trata "intent://". */
export function BotaoPuxar({ texto = "Puxar do sensor" }: { texto?: string }) {
  return (
    <a className="botao-link" href={linkPuxarDoSensor(enderecoDoApp())}>
      📡 {texto}
    </a>
  );
}

/** Bloco do sensor dentro do cartão de glicose: leitura atual, tempo no alvo de hoje e botão de puxar. */
export function BlocoSensor({ resumo }: { resumo: Resumo }) {
  const leituras = useLeiturasSensor(Date.now() - 26 * 60 * 60 * 1000) ?? [];
  const hoje = diaLogico();
  const sinc = resumo.ultimaSincronizacao;
  const ultima = leituras.at(-1);
  const tir = tempoNoAlvoDoDia(leituras, hoje);
  // A seta só vale para a leitura atual do momento em que você puxou.
  const tendencia: Tendencia = sinc && ultima && sinc.atualTs === ultima.ts ? sinc.tendencia : 0;

  return (
    <div className="sensor">
      {ultima ? (
        <div className="linha">
          <span>
            Sensor: <strong>{ultima.valor}</strong> mg/dL {SETAS[tendencia]}
          </span>
          <span className="suave">
            {hora(ultima.ts)} · há {minutosAtras(ultima.ts)} min
          </span>
        </div>
      ) : (
        <p className="situacao">Com o app Glicose ligado, puxe as leituras do sensor em um toque. Sem ele, registre à mão abaixo.</p>
      )}
      {ultima && (
        <p className="situacao">
          {tir.suficiente
            ? `Hoje: ${tir.noAlvoPct}% do tempo entre ${ALVO_SENSOR_MIN} e ${ALVO_SENSOR_MAX} · ${tir.abaixoPct}% abaixo · ${tir.acimaPct}% acima.`
            : `Hoje: poucos dados do sensor ainda (${tir.coberturaPct}% do dia). O tempo no alvo aparece a partir de ${COBERTURA_MINIMA_PCT}%.`}
          {tendencia > 0 && ` Tendência: ${NOMES_TENDENCIA[tendencia]}.`}
        </p>
      )}
      <BotaoPuxar texto={resumo.hoje.sensorHoje ? "Puxar de novo" : "Puxar do sensor"} />
    </div>
  );
}

const dataCurta = (dia: string) => dia.slice(8, 10) + "/" + dia.slice(5, 7);

/** Dados do sensor de um período (lista de dias do jogo, do mais antigo a hoje). */
export function useSensorDoPeriodo(dias: string[]) {
  const inicio = inicioDoDiaDoJogo(dias[0]);
  const leituras = useLeiturasSensor(inicio) ?? [];
  const agora = Date.now();
  // Antes da primeira leitura o sensor ainda não estava em uso: esses dias não entram na conta nem na lista.
  const primeiroDia = leituras.length ? leituras.reduce((m, x) => (x.dia < m ? x.dia : m), leituras[0].dia) : dias.at(-1)!;
  const diasComSensor = dias.filter((d) => d >= primeiroDia);
  const total = tempoNoAlvo(leituras, Math.max(inicio, inicioDoDiaDoJogo(primeiroDia)), agora);
  const porDia = diasComSensor.map((dia) => ({ dia, t: tempoNoAlvoDoDia(leituras, dia, agora) }));
  const episodios = episodiosAbaixo(leituras);
  return { leituras, total, porDia, episodios };
}

/** Cartão da aba Análises: tempo no alvo de verdade, só com os dados do sensor. */
export function CartaoSensor({ dias }: { dias: string[] }) {
  const { leituras, total, porDia, episodios } = useSensorDoPeriodo(dias);
  const v = (n: number | null) => (n === null ? "—" : `${n}%`);
  return (
    <section className="cartao">
      <h2>Sensor (tempo no alvo)</h2>
      {leituras.length === 0 ? (
        <>
          <p className="situacao">Sem leituras do sensor neste período. Elas chegam quando você toca em "Puxar do sensor".</p>
          <BotaoPuxar />
        </>
      ) : (
        <>
          <dl className="numeros">
            <div>
              <dt>
                No alvo ({ALVO_SENSOR_MIN}–{ALVO_SENSOR_MAX})
              </dt>
              <dd>{v(total.noAlvoPct)}</dd>
            </div>
            <div>
              <dt>Abaixo de {ALVO_SENSOR_MIN}</dt>
              <dd>{v(total.abaixoPct)}</dd>
            </div>
            <div>
              <dt>Acima de {ALVO_SENSOR_MAX}</dt>
              <dd>{v(total.acimaPct)}</dd>
            </div>
            <div>
              <dt>Média</dt>
              <dd>{total.media ?? "—"} mg/dL</dd>
            </div>
            <div>
              <dt>Com dados</dt>
              <dd>{total.coberturaPct}% do tempo</dd>
            </div>
            <div>
              <dt>Hipos (15 min+)</dt>
              <dd>{episodios.length}</dd>
            </div>
          </dl>
          <ul className="barras-alvo" aria-label="Tempo no alvo por dia">
            {porDia.map(({ dia, t }) => (
              <li key={dia}>
                <span className="suave">{dataCurta(dia)}</span>
                {t.leituras === 0 ? (
                  <span className="barra-alvo vazia">sem dados</span>
                ) : (
                  <span className="barra-alvo" title={`${t.noAlvoPct}% no alvo · ${t.coberturaPct}% do dia com dados`}>
                    <span className="abaixo" style={{ width: `${t.abaixoPct}%` }} />
                    <span className="no-alvo" style={{ width: `${t.noAlvoPct}%` }} />
                    <span className="acima" style={{ width: `${t.acimaPct}%` }} />
                  </span>
                )}
                <span className="numero-pequeno">{t.leituras === 0 ? "" : t.suficiente ? `${t.noAlvoPct}%` : "poucos"}</span>
              </li>
            ))}
          </ul>
          <p className="nota">
            Vermelho abaixo de {ALVO_SENSOR_MIN}, verde no alvo, amarelo acima de {ALVO_SENSOR_MAX}. Dias com menos de {COBERTURA_MINIMA_PCT}% de dados aparecem como "poucos". O app
            Glicose guarda só 24 h: puxe ao menos uma vez por dia para não ficar buraco. Esses números não dão nem tiram XP.
          </p>
        </>
      )}
    </section>
  );
}
