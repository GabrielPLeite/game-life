import { useEffect, useState } from "react";
import {
  adiarTreino,
  cancelarTreino,
  concluirTreino,
  desfazerMarcacao,
  desfazerUltimoTreino,
  iniciarTreino,
  marcarDia,
  type Configuracoes,
  type MotivoPausa,
  type Origem,
  type TipoTreino,
} from "../db";
import { classificarGlicose, type ResultadoChecagem } from "../regras";
import type { Resumo } from "../resumo";
import { LEITURA_RECENTE_MIN, NOMES_TENDENCIA, SETAS, leituraRecente, type Tendencia } from "../sensor";
import { BotaoPuxar, minutosAtras, useLeiturasSensor } from "./Sensor";

export const NOMES_TIPO: Record<TipoTreino, string> = {
  esteira: "Esteira",
  musculacao: "Musculação",
  abdomen: "Abdômen",
  outro: "Outro",
};
const NOMES_TURNO = { manha: "manhã", noite: "noite" };
const NOMES_MOTIVO: Record<MotivoPausa, string> = {
  hipo: "Hipo",
  glicose_fora: "Glicose fora da faixa",
  doente: "Doente",
  lesao: "Lesão",
};

/** Minutos desde um horário ISO. */
const minutosDesde = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000);
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Atualiza a tela a cada 30 s para o cronômetro do treino andar. */
function useRelogio() {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
}

type Etapa = { tipo: "inicio" } | { tipo: "checando" } | { tipo: "resultado"; valor: number; resultado: ResultadoChecagem; origem: Origem } | { tipo: "sem_treino" };

/** Leitura do sensor boa para a checagem (até 15 min), com a seta se ela for a leitura atual de quando você puxou. */
export interface LeituraParaChecagem {
  valor: number;
  ts: number;
  tendencia: Tendencia;
}

export default function Treino({ resumo, configuracoes }: { resumo: Resumo; configuracoes: Configuracoes }) {
  useRelogio();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "inicio" });
  const { hoje } = resumo;
  const emAndamento = hoje.treinoEmAndamento;
  const voltar = () => setEtapa({ tipo: "inicio" });
  const recentes = useLeiturasSensor(Date.now() - (LEITURA_RECENTE_MIN + 5) * 60 * 1000) ?? [];
  const recente = leituraRecente(recentes);
  const sinc = resumo.ultimaSincronizacao;
  const doSensor: LeituraParaChecagem | undefined = recente && {
    valor: recente.valor,
    ts: recente.ts,
    tendencia: sinc && sinc.atualTs === recente.ts ? sinc.tendencia : 0,
  };

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Treino</h2>
        <span className="xp-dia">{hoje.treinosConcluidos.length} de 2 hoje</span>
      </div>

      {hoje.treinosConcluidos.length > 0 && (
        <ul className="lista">
          {hoje.treinosConcluidos.map((t) => (
            <li key={t.id}>
              <span>
                {NOMES_TIPO[t.tipo ?? "outro"]} · {NOMES_TURNO[t.turno]}
              </span>
              <span className="suave">
                {t.duracaoMin} min{t.glicoseId !== undefined && ` · ${resumo.valorGlicose.get(t.glicoseId)} mg/dL`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {emAndamento ? (
        <EmAndamento
          key={emAndamento.id}
          id={emAndamento.id}
          iniciadoEm={emAndamento.criadoEm}
          turno={emAndamento.turno}
          glicose={emAndamento.glicoseId !== undefined ? resumo.valorGlicose.get(emAndamento.glicoseId) : undefined}
          tipoSugerido={resumo.ultimoTipo[emAndamento.turno] ?? (emAndamento.turno === "manha" ? "esteira" : "musculacao")}
        />
      ) : etapa.tipo === "checando" ? (
        <Checagem
          sensor={doSensor}
          onCancelar={voltar}
          onChecar={(valor, origem) => {
            const resultado = classificarGlicose(valor, configuracoes);
            if (resultado === "liberado") {
              void iniciarTreino("liberado", valor, origem);
              voltar();
            } else {
              setEtapa({ tipo: "resultado", valor, resultado, origem });
            }
          }}
          onSemChecar={() => {
            void iniciarTreino("sem_checagem");
            voltar();
          }}
        />
      ) : etapa.tipo === "resultado" ? (
        <ResultadoForaDaFaixa etapa={etapa} configuracoes={configuracoes} onFim={voltar} />
      ) : etapa.tipo === "sem_treino" ? (
        <SemTreino descansosRestantes={resumo.descansosRestantes} onFim={voltar} />
      ) : (
        <>
          <button className="principal" onClick={() => setEtapa({ tipo: "checando" })}>
            Vou treinar
          </button>
          {!hoje.garantido && (
            <button className="discreto" onClick={() => setEtapa({ tipo: "sem_treino" })}>
              Hoje não vou treinar
            </button>
          )}
        </>
      )}

      {(hoje.pausa || hoje.descanso) && hoje.treinosConcluidos.length === 0 && (
        <p className="situacao">
          {hoje.pausa ? `Pausa legítima: ${NOMES_MOTIVO[hoje.pausa.motivo ?? "doente"]}.` : "Descanso planejado."}{" "}
          <button className="link" onClick={() => void desfazerMarcacao()}>
            Desfazer
          </button>
        </p>
      )}

      {hoje.treinosConcluidos.length > 0 && !emAndamento && etapa.tipo === "inicio" && (
        <button className="discreto" onClick={() => void desfazerUltimoTreino()}>
          Desfazer último treino
        </button>
      )}
    </section>
  );
}

/**
 * Passo 1: pergunta a glicose antes de treinar.
 * Se o sensor tem leitura de até 15 min, o campo já vem preenchido e você só confirma (ou corrige).
 */
function Checagem({
  sensor,
  onChecar,
  onCancelar,
  onSemChecar,
}: {
  sensor?: LeituraParaChecagem;
  onChecar: (v: number, origem: Origem) => void;
  onCancelar: () => void;
  onSemChecar: () => void;
}) {
  const [texto, setTexto] = useState(sensor ? String(sensor.valor) : "");
  const valor = Number(texto);
  const valido = texto !== "" && valor >= 20 && valor <= 600;
  // Só conta como "do sensor" se você não mudou o número.
  const origem: Origem = sensor && valor === sensor.valor ? "sensor" : "manual";
  const caindo = sensor && origem === "sensor" && (sensor.tendencia === 1 || sensor.tendencia === 2);
  return (
    <form
      className="etapa"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) onChecar(valor, origem);
      }}
    >
      <label htmlFor="glicose-treino">Qual sua glicose agora? (mg/dL)</label>
      {sensor ? (
        <p className="situacao">
          Preenchido com o sensor: {sensor.valor} mg/dL {SETAS[sensor.tendencia]} há {minutosAtras(sensor.ts)} min
          {sensor.tendencia > 0 && ` (${NOMES_TENDENCIA[sensor.tendencia]})`}. Confirme ou corrija.
        </p>
      ) : (
        <p className="situacao">
          Sem leitura do sensor nos últimos {LEITURA_RECENTE_MIN} min. Digite a medição ou <BotaoPuxar texto="puxe do sensor" />
        </p>
      )}
      {caindo && (
        <div className="aviso atencao">
          <strong>A glicose está caindo.</strong>
          <span>Com seta para baixo, o valor pode estar menor daqui a pouco. Siga a orientação do seu médico; na dúvida, confira na ponta do dedo.</span>
        </div>
      )}
      <input id="glicose-treino" className="numero" inputMode="numeric" pattern="[0-9]*" autoFocus value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))} placeholder="ex.: 120" />
      <button className="principal" type="submit" disabled={!valido}>
        Checar
      </button>
      <div className="linha">
        <button type="button" className="link" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="link" onClick={onSemChecar}>
          Treinar sem checar (sem XP de checagem)
        </button>
      </div>
    </form>
  );
}

/** Passo 2 quando a glicose não está liberada: avisa e deixa a decisão com você. */
function ResultadoForaDaFaixa({ etapa, configuracoes, onFim }: { etapa: { valor: number; resultado: ResultadoChecagem; origem: Origem }; configuracoes: Configuracoes; onFim: () => void }) {
  const { valor, resultado, origem } = etapa;
  const adiar = () => {
    void adiarTreino(valor, resultado, origem);
    onFim();
  };

  if (resultado === "comer_antes") {
    return (
      <div className="etapa aviso atencao">
        <strong>{valor} mg/dL: coma algo antes de treinar.</strong>
        <p>Está entre {configuracoes.limiteBaixoTreino} e {configuracoes.limiteComerAntes} mg/dL, a faixa em que você definiu comer antes. Siga a orientação do seu médico.</p>
        <button
          className="principal"
          onClick={() => {
            void iniciarTreino("comer_antes", valor, origem);
            onFim();
          }}
        >
          Já comi, começar treino
        </button>
        <button className="discreto" onClick={adiar}>
          Adiar treino (conta como dia garantido)
        </button>
      </div>
    );
  }

  const texto =
    resultado === "baixa"
      ? `Abaixo de ${configuracoes.limiteBaixoTreino} mg/dL. Não treine agora: trate a hipo seguindo a orientação do seu médico.`
      : `Acima de ${configuracoes.limiteAltoTreino} mg/dL, o limite que você configurou. Siga a orientação do seu médico antes de treinar.`;
  return (
    <div className="etapa aviso perigo">
      <strong>{valor} mg/dL: melhor adiar.</strong>
      <p>{texto}</p>
      <p className="nota">Adiar vale o mesmo XP que treinar e não quebra a sequência.</p>
      <button className="principal" onClick={adiar}>
        Adiar treino
      </button>
      <button className="discreto" onClick={onFim}>
        Voltar
      </button>
    </div>
  );
}

const DURACOES = [20, 30, 45, 60];

/** Passo 3: treino em andamento. Ao concluir, a duração vem do cronômetro. */
function EmAndamento(p: { id: number; iniciadoEm: string; turno: "manha" | "noite"; glicose?: number; tipoSugerido: TipoTreino }) {
  const [tipo, setTipo] = useState<TipoTreino>(p.tipoSugerido);
  const decorrido = minutosDesde(p.iniciadoEm);
  // Se o treino foi registrado depois de feito (menos de 5 min no cronômetro), você escolhe a duração.
  const precisaEscolherDuracao = decorrido < 5;
  const [duracao, setDuracao] = useState<number | null>(null);

  return (
    <div className="etapa">
      <p className="situacao">
        Treino da {NOMES_TURNO[p.turno]} em andamento desde {hora(p.iniciadoEm)}
        {p.glicose !== undefined && ` · glicose ${p.glicose} mg/dL`}
        {!precisaEscolherDuracao && ` · ${decorrido} min`}
      </p>
      <div className="chips" role="group" aria-label="Tipo de treino">
        {(Object.keys(NOMES_TIPO) as TipoTreino[]).map((t) => (
          <button key={t} className={t === tipo ? "chip ativo" : "chip"} aria-pressed={t === tipo} onClick={() => setTipo(t)}>
            {NOMES_TIPO[t]}
          </button>
        ))}
      </div>
      {precisaEscolherDuracao && (
        <div className="chips" role="group" aria-label="Duração">
          {DURACOES.map((m) => (
            <button key={m} className={m === duracao ? "chip ativo" : "chip"} aria-pressed={m === duracao} onClick={() => setDuracao(m)}>
              {m} min
            </button>
          ))}
        </div>
      )}
      <button
        className="principal"
        disabled={precisaEscolherDuracao && duracao === null}
        onClick={() => void concluirTreino(p.id, tipo, precisaEscolherDuracao ? duracao! : decorrido)}
      >
        Concluir treino
      </button>
      <button className="discreto" onClick={() => void cancelarTreino(p.id)}>
        Cancelar treino
      </button>
    </div>
  );
}

/** Pausa legítima ou descanso planejado. */
function SemTreino({ descansosRestantes, onFim }: { descansosRestantes: number; onFim: () => void }) {
  const marcar = (tipo: "pausa" | "descanso", motivo?: MotivoPausa) => {
    void marcarDia(tipo, motivo);
    onFim();
  };
  return (
    <div className="etapa">
      <p className="situacao">Pausa legítima (vale o mesmo XP de um treino e não quebra a sequência):</p>
      <div className="chips">
        {(Object.keys(NOMES_MOTIVO) as MotivoPausa[]).map((m) => (
          <button key={m} className="chip" onClick={() => marcar("pausa", m)}>
            {NOMES_MOTIVO[m]}
          </button>
        ))}
      </div>
      <button className="discreto" disabled={descansosRestantes === 0} onClick={() => marcar("descanso")}>
        Descanso planejado ({descansosRestantes} {descansosRestantes === 1 ? "restante" : "restantes"} na semana)
      </button>
      <button className="link" onClick={onFim}>
        Voltar
      </button>
    </div>
  );
}

