// Metas pessoais: tempo de tela, jogos, estudo e as que você criar.
// Dois tipos: "ficar abaixo de" (limite) e "fazer pelo menos" (mínimo). Sempre em minutos por dia.
import { useState } from "react";
import { criarMeta, desfazerUltimoRegistroMeta, mudarMeta, pausarMeta, registrarMeta, type Meta } from "../db";
import { MAX_MINUTOS_COM_XP, MINUTOS_POR_BLOCO, XP_DENTRO_DO_LIMITE, XP_POR_BLOCO, XP_REGISTRAR_LIMITE, diaLogico, type TipoMeta } from "../regras";
import type { Resumo } from "../resumo";

type MetaNaTela = Resumo["metas"][number];

/** 90 -> "1 h 30 min"; 45 -> "45 min"; 120 -> "2 h". */
export function duracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function Metas({ resumo }: { resumo: Resumo }) {
  return (
    <>
      {resumo.metas.map((m) => (m.meta.tipo === "limite" ? <Limite key={m.meta.id} m={m} /> : <Minimo key={m.meta.id} m={m} />))}
    </>
  );
}

/** Meta de "ficar abaixo de": o dia fecha no dia seguinte, com o total real. */
function Limite({ m }: { m: MetaNaTela }) {
  const { meta, hoje, ontem } = m;
  const [corrigindo, setCorrigindo] = useState(false);
  const porcentagem = Math.min(100, Math.round((hoje.minutos / Math.max(1, hoje.alvoMin)) * 100));
  const passou = hoje.minutos > hoje.alvoMin;
  const hojeDia = diaLogico();

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>
          <span aria-hidden>{meta.icone}</span> {meta.nome}
        </h2>
        <span className="xp-dia">até {duracao(meta.alvoMin)}</span>
      </div>

      {ontem.registrado && !corrigindo ? (
        <p className="situacao">
          Ontem: <strong>{duracao(ontem.minutos)}</strong>.{" "}
          {ontem.cumprida ? `Dentro do limite, +${ontem.xp} XP.` : `Acima do limite de ${duracao(ontem.alvoMin)}. Registrar valeu +${ontem.xp} XP.`}{" "}
          <button className="link" onClick={() => setCorrigindo(true)}>
            Corrigir
          </button>
        </p>
      ) : (
        <FecharOntem meta={meta} onFim={() => setCorrigindo(false)} cancelavel={corrigindo} />
      )}

      <p className="total">
        {duracao(hoje.minutos)} <small>hoje até agora</small>
      </p>
      <div className="barra grande" role="progressbar" aria-label={`${meta.nome} hoje`} aria-valuenow={porcentagem} aria-valuemax={100}>
        <div className={`barra-cheia ${passou ? "passou" : "meta"}`} style={{ width: `${porcentagem}%` }} />
      </div>
      <div className="botoes">
        <button className="principal meta" onClick={() => void registrarMeta(meta, 30)}>
          + 30 min
        </button>
        <button className="principal meta" onClick={() => void registrarMeta(meta, 60)}>
          + 1 h
        </button>
      </div>
      {hoje.registrado && (
        <button className="discreto" onClick={() => void desfazerUltimoRegistroMeta(meta.id, hojeDia)}>
          Desfazer último registro de hoje
        </button>
      )}
      <p className="nota">
        {meta.dica ? `${meta.dica} ` : ""}O XP de hoje entra amanhã, quando o dia fechar: {XP_REGISTRAR_LIMITE} por registrar e +{XP_DENTRO_DO_LIMITE} se ficar dentro do limite. Passar do limite
        nunca tira pontos.
      </p>
    </section>
  );
}

/** Formulário "quanto foi ontem?", em horas e minutos. */
function FecharOntem({ meta, onFim, cancelavel }: { meta: Meta; onFim: () => void; cancelavel: boolean }) {
  const [horas, setHoras] = useState("");
  const [minutos, setMinutos] = useState("");
  const total = Number(horas || 0) * 60 + Number(minutos || 0);
  const valido = (horas !== "" || minutos !== "") && total <= 24 * 60 && Number(minutos || 0) < 60;
  const soDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 2);
  return (
    <form
      className="etapa"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        void registrarMeta(meta, total, { ontem: true, total: true });
        setHoras("");
        setMinutos("");
        onFim();
      }}
    >
      <label htmlFor={`ontem-h-${meta.id}`}>Quanto foi ontem?</label>
      <div className="linha duracao">
        <input id={`ontem-h-${meta.id}`} className="numero" inputMode="numeric" pattern="[0-9]*" value={horas} onChange={(e) => setHoras(soDigitos(e.target.value))} placeholder="0" aria-label="Horas" />
        <span>h</span>
        <input className="numero" inputMode="numeric" pattern="[0-9]*" value={minutos} onChange={(e) => setMinutos(soDigitos(e.target.value))} placeholder="00" aria-label="Minutos" />
        <span>min</span>
      </div>
      <button className="principal" type="submit" disabled={!valido}>
        Registrar ontem
      </button>
      {cancelavel && (
        <button type="button" className="link" onClick={onFim}>
          Cancelar
        </button>
      )}
    </form>
  );
}

/** Meta de "fazer pelo menos": soma minutos ao longo do dia. */
function Minimo({ m }: { m: MetaNaTela }) {
  const { meta, hoje } = m;
  const xpMaximo = (MAX_MINUTOS_COM_XP / MINUTOS_POR_BLOCO) * XP_POR_BLOCO;
  const porcentagem = Math.min(100, Math.round((hoje.minutos / Math.max(1, hoje.alvoMin)) * 100));
  const falta = Math.max(0, hoje.alvoMin - hoje.minutos);
  const botoes = meta.etiquetas?.length ? meta.etiquetas.map((e) => ({ rotulo: `+ 15 min ${e}`, minutos: 15, etiqueta: e as string | undefined })) : [15, 30].map((x) => ({ rotulo: `+ ${x} min`, minutos: x, etiqueta: undefined }));
  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>
          <span aria-hidden>{meta.icone}</span> {meta.nome}
        </h2>
        <span className="xp-dia">
          +{hoje.xp} de {xpMaximo} XP
        </span>
      </div>
      <p className="total">
        {duracao(hoje.minutos)} <small>de {duracao(hoje.alvoMin)}</small>
      </p>
      <div className="barra grande" role="progressbar" aria-label={`${meta.nome} hoje`} aria-valuenow={porcentagem} aria-valuemax={100}>
        <div className="barra-cheia meta" style={{ width: `${porcentagem}%` }} />
      </div>
      <p className="situacao">{falta > 0 ? `Faltam ${duracao(falta)} para a meta de hoje.` : "Meta do dia atingida."}</p>
      <div className="botoes">
        {botoes.map((b) => (
          <button key={b.rotulo} className="principal meta" onClick={() => void registrarMeta(meta, b.minutos, { etiqueta: b.etiqueta })}>
            {b.rotulo}
          </button>
        ))}
      </div>
      {hoje.registrado && (
        <button className="discreto" onClick={() => void desfazerUltimoRegistroMeta(meta.id, diaLogico())}>
          Desfazer último registro
        </button>
      )}
      <p className="nota">
        {XP_POR_BLOCO} XP a cada {MINUTOS_POR_BLOCO} min, até {MAX_MINUTOS_COM_XP} min por dia. Acima disso não há XP extra.
      </p>
    </section>
  );
}

// ---------- Ajustar, pausar e criar metas (fica dentro das Configurações) ----------

const NOMES_TIPO: Record<TipoMeta, string> = { limite: "Ficar abaixo de", minimo: "Fazer pelo menos" };

export function GerenciarMetas({ metas }: { metas: Meta[] }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoMeta>("minimo");
  const ordenadas = [...metas].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="etapa">
      <h3>Minhas metas</h3>
      {ordenadas.map((m) => (
        <div className="ajuste" key={m.id}>
          <span className={m.arquivadaEm ? "suave" : ""}>
            {m.icone} {m.nome}
            <br />
            <small className="suave">
              {NOMES_TIPO[m.tipo].toLowerCase()} ·{" "}
              <button className="link" onClick={() => void pausarMeta(m.id, !m.arquivadaEm)}>
                {m.arquivadaEm ? "retomar" : "pausar"}
              </button>
            </small>
          </span>
          <div className="passos">
            <button aria-label={`Diminuir ${m.nome}`} disabled={m.alvoMin <= 15} onClick={() => void mudarMeta(m.id, { alvoMin: m.alvoMin - 15 })}>
              −
            </button>
            <strong>{duracao(m.alvoMin)}</strong>
            <button aria-label={`Aumentar ${m.nome}`} disabled={m.alvoMin >= 12 * 60} onClick={() => void mudarMeta(m.id, { alvoMin: m.alvoMin + 15 })}>
              +
            </button>
          </div>
        </div>
      ))}
      <form
        className="etapa"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          void criarMeta(nome.trim(), tipo, tipo === "limite" ? 60 : 30, "🎯");
          setNome("");
        }}
      >
        <label htmlFor="nova-meta">Nova meta diária</label>
        <input id="nova-meta" className="texto" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Inglês, Meditação, Redes sociais" maxLength={40} />
        <div className="chips" role="group" aria-label="Tipo da meta">
          {(Object.keys(NOMES_TIPO) as TipoMeta[]).map((t) => (
            <button type="button" key={t} className={t === tipo ? "chip ativo" : "chip"} aria-pressed={t === tipo} onClick={() => setTipo(t)}>
              {NOMES_TIPO[t]}
            </button>
          ))}
        </div>
        <button className="discreto" type="submit" disabled={!nome.trim()}>
          Criar meta
        </button>
      </form>
      <p className="nota">Mudar o alvo vale daqui para a frente; os dias já registrados ficam como estavam. Pausar esconde a meta sem apagar o histórico.</p>
    </div>
  );
}
