import { useState } from "react";
import { excluirHabito, registrarHabito, type ContextoRefeicao, type Habito } from "../db";
import type { Resumo } from "../resumo";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const NOMES_CONTEXTO: Record<ContextoRefeicao, string> = { normal: "Normal", antes_treino: "Antes do treino", depois_treino: "Depois do treino" };

/** Campo numérico que aceita vírgula (ex.: 76,5). */
function useNumero(inicial = "") {
  const [texto, setTexto] = useState(inicial);
  const valor = texto === "" ? undefined : Number(texto.replace(",", "."));
  return { texto, setTexto, valor: valor !== undefined && Number.isFinite(valor) ? valor : undefined, limpar: () => setTexto("") };
}

function Excluir({ id, rotulo }: { id: number; rotulo: string }) {
  return (
    <button className="link" aria-label={`Excluir ${rotulo}`} onClick={() => void excluirHabito(id)}>
      excluir
    </button>
  );
}

export default function Habitos({ resumo }: { resumo: Resumo }) {
  const hoje = resumo.habitosHoje;
  const de = <T extends Habito["tipo"]>(tipo: T) => hoje.filter((h): h is Extract<Habito, { tipo: T }> => h.tipo === tipo);
  return (
    <>
      <Refeicoes refeicoes={de("refeicao")} caminhadas={de("caminhada")} />
      <Sono registros={de("sono")} />
      <Insulina registros={de("insulina")} />
      <Medidas registros={de("medida")} />
    </>
  );
}

function Refeicoes({ refeicoes, caminhadas }: { refeicoes: Extract<Habito, { tipo: "refeicao" }>[]; caminhadas: Extract<Habito, { tipo: "caminhada" }>[] }) {
  const [descricao, setDescricao] = useState("");
  const carbs = useNumero();
  const [contexto, setContexto] = useState<ContextoRefeicao>("normal");
  const [caminhandoDe, setCaminhandoDe] = useState<number | null>(null);

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Refeições</h2>
        <span className="xp-dia">5 XP · caminhada +10</span>
      </div>
      <form
        className="etapa"
        onSubmit={(e) => {
          e.preventDefault();
          void registrarHabito({ tipo: "refeicao", descricao: descricao.trim() || "Refeição", carboidratosG: carbs.valor, contexto });
          setDescricao("");
          carbs.limpar();
          setContexto("normal");
        }}
      >
        <input className="texto" aria-label="O que comeu" placeholder="O que comeu (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="linha">
          <input className="numero" aria-label="Carboidratos estimados em gramas" inputMode="numeric" placeholder="Carbo (g)" value={carbs.texto} onChange={(e) => carbs.setTexto(e.target.value.replace(/[^\d]/g, ""))} />
          <button className="principal habito" type="submit">
            Registrar
          </button>
        </div>
        <div className="chips" role="group" aria-label="Contexto">
          {(Object.keys(NOMES_CONTEXTO) as ContextoRefeicao[]).map((c) => (
            <button type="button" key={c} className={c === contexto ? "chip ativo" : "chip"} aria-pressed={c === contexto} onClick={() => setContexto(c)}>
              {NOMES_CONTEXTO[c]}
            </button>
          ))}
        </div>
      </form>

      {refeicoes.length > 0 && (
        <ul className="lista">
          {refeicoes.map((r) => {
            const caminhada = caminhadas.find((c) => c.refeicaoId === r.id);
            return (
              <li key={r.id} className="coluna">
                <div className="linha">
                  <span>
                    {r.descricao}
                    {r.carboidratosG !== undefined && <span className="suave"> · {r.carboidratosG} g</span>}
                  </span>
                  <span className="suave">
                    {hora(r.criadoEm)} · <Excluir id={r.id} rotulo="refeição" />
                  </span>
                </div>
                {caminhada ? (
                  <span className="feito">
                    Caminhada de {caminhada.minutos} min depois <Excluir id={caminhada.id} rotulo="caminhada" />
                  </span>
                ) : caminhandoDe === r.id ? (
                  <div className="chips">
                    {[10, 15, 20, 30].map((m) => (
                      <button
                        key={m}
                        className="chip"
                        onClick={() => {
                          void registrarHabito({ tipo: "caminhada", minutos: m, refeicaoId: r.id });
                          setCaminhandoDe(null);
                        }}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                ) : (
                  <button className="discreto" onClick={() => setCaminhandoDe(r.id)}>
                    Caminhei depois desta refeição
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="nota">Carboidrato é estimativa, só para entender picos. Caminhada pós-refeição conta a partir de 10 minutos.</p>
    </section>
  );
}

function Sono({ registros }: { registros: Extract<Habito, { tipo: "sono" }>[] }) {
  const [horas, setHoras] = useState(7);
  const registrado = registros.at(-1);
  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Sono da última noite</h2>
        <span className="xp-dia">5 XP</span>
      </div>
      {registrado ? (
        <p className="situacao">
          {String(registrado.horas).replace(".", ",")} h registradas. <Excluir id={registrado.id} rotulo="sono" />
        </p>
      ) : (
        <div className="ajuste">
          <div className="passos">
            <button aria-label="Menos meia hora" disabled={horas <= 0} onClick={() => setHoras(horas - 0.5)}>
              −
            </button>
            <strong>{String(horas).replace(".", ",")} h</strong>
            <button aria-label="Mais meia hora" disabled={horas >= 14} onClick={() => setHoras(horas + 0.5)}>
              +
            </button>
          </div>
          <button className="principal habito" onClick={() => void registrarHabito({ tipo: "sono", horas })}>
            Registrar
          </button>
        </div>
      )}
    </section>
  );
}

function Insulina({ registros }: { registros: Extract<Habito, { tipo: "insulina" }>[] }) {
  const unidades = useNumero();
  const registrar = (insulina: "basal" | "rapida") => {
    void registrarHabito({ tipo: "insulina", insulina, unidades: unidades.valor });
    unidades.limpar();
  };
  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Insulina aplicada</h2>
        <span className="xp-dia">5 XP por dia</span>
      </div>
      <input className="numero" aria-label="Unidades aplicadas (opcional)" inputMode="decimal" placeholder="Unidades (opcional)" value={unidades.texto} onChange={(e) => unidades.setTexto(e.target.value.replace(/[^\d,]/g, ""))} />
      <div className="botoes">
        <button className="principal habito" onClick={() => registrar("basal")}>
          Basal
        </button>
        <button className="principal habito" onClick={() => registrar("rapida")}>
          Rápida
        </button>
      </div>
      {registros.length > 0 && (
        <ul className="lista">
          {registros.map((r) => (
            <li key={r.id}>
              <span>
                {r.insulina === "basal" ? "Basal" : "Rápida"}
                {r.unidades !== undefined && ` · ${String(r.unidades).replace(".", ",")} U`}
              </span>
              <span className="suave">
                {hora(r.criadoEm)} · <Excluir id={r.id} rotulo="insulina" />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="nota">Só registro do que você aplicou. O app não sugere dose: siga a orientação do seu médico. O XP é o mesmo com uma ou várias aplicações.</p>
    </section>
  );
}

function Medidas({ registros }: { registros: Extract<Habito, { tipo: "medida" }>[] }) {
  const peso = useNumero();
  const cintura = useNumero();
  const registrado = registros.at(-1);
  const fmt = (n?: number) => (n === undefined ? "—" : String(n).replace(".", ","));
  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Peso e cintura</h2>
        <span className="xp-dia">5 XP</span>
      </div>
      {registrado && (
        <p className="situacao">
          Hoje: {fmt(registrado.pesoKg)} kg · {fmt(registrado.cinturaCm)} cm. <Excluir id={registrado.id} rotulo="medida" />
        </p>
      )}
      <form
        className="linha"
        onSubmit={(e) => {
          e.preventDefault();
          if (peso.valor === undefined && cintura.valor === undefined) return;
          void registrarHabito({ tipo: "medida", pesoKg: peso.valor, cinturaCm: cintura.valor });
          peso.limpar();
          cintura.limpar();
        }}
      >
        <input className="numero" aria-label="Peso em kg" inputMode="decimal" placeholder="kg" value={peso.texto} onChange={(e) => peso.setTexto(e.target.value.replace(/[^\d,]/g, ""))} />
        <input className="numero" aria-label="Cintura em cm" inputMode="decimal" placeholder="cm" value={cintura.texto} onChange={(e) => cintura.setTexto(e.target.value.replace(/[^\d,]/g, ""))} />
        <button className="principal habito" type="submit">
          Salvar
        </button>
      </form>
      <p className="nota">O XP vem de registrar, não do número. Uma vez por semana, no mesmo horário, já basta.</p>
    </section>
  );
}
