import { useState } from "react";
import { diaLogico, ML_POR_COPO } from "../regras";
import { definirGlicose, exportarTudo, glicoseLigada, restaurarBackup, salvarConfiguracoes, type Configuracoes as Config, type Meta } from "../db";
import { GerenciarMetas } from "./Metas";
import { litros } from "./Agua";

/** Baixa um arquivo JSON com todos os dados do app. */
async function baixarBackup() {
  const dados = await exportarTudo();
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `game-life-backup-${diaLogico()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lê um arquivo de backup e substitui os dados deste aparelho, depois de confirmar. */
async function restaurar(arquivo: File) {
  try {
    const dados = JSON.parse(await arquivo.text());
    if (!window.confirm("Restaurar este backup? Os dados atuais deste aparelho serão substituídos pelos do arquivo.")) return;
    await restaurarBackup(dados);
    window.alert("Backup restaurado.");
  } catch (e) {
    window.alert(e instanceof Error && e.message.includes("Game Life") ? e.message : "Não consegui ler este arquivo.");
  }
}

/** Linha com botões − e + para ajustar um número. */
function Ajuste(p: { rotulo: string; valor: string; onMenos: () => void; onMais: () => void; podeMenos: boolean; podeMais: boolean }) {
  return (
    <div className="ajuste">
      <span>{p.rotulo}</span>
      <div className="passos">
        <button aria-label={`Diminuir ${p.rotulo}`} disabled={!p.podeMenos} onClick={p.onMenos}>
          −
        </button>
        <strong>{p.valor}</strong>
        <button aria-label={`Aumentar ${p.rotulo}`} disabled={!p.podeMais} onClick={p.onMais}>
          +
        </button>
      </div>
    </div>
  );
}

export default function Configuracoes({ configuracoes: c, metaAguaHoje, metas }: { configuracoes: Config; metaAguaHoje: number; metas: Meta[] }) {
  const comGlicose = glicoseLigada(c);
  const [aberto, setAberto] = useState(false);
  const salvar = (m: Partial<Config>) => void salvarConfiguracoes(m);

  return (
    <section className="cartao">
      <button className="cabecalho-dobravel" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <h2>Configurações</h2>
        <span aria-hidden>{aberto ? "−" : "+"}</span>
      </button>
      {aberto && (
        <>
          <GerenciarMetas metas={metas} />
          <h3>Geral</h3>
          <Ajuste
            rotulo="Meta diária de água"
            valor={litros(metaAguaHoje)}
            podeMenos={metaAguaHoje > ML_POR_COPO}
            podeMais={metaAguaHoje < 6000}
            onMenos={() => salvar({ metaAguaMl: metaAguaHoje - ML_POR_COPO })}
            onMais={() => salvar({ metaAguaMl: metaAguaHoje + ML_POR_COPO })}
          />
          {comGlicose && (
            <>
          <Ajuste
            rotulo="Não treinar abaixo de"
            valor={`${c.limiteBaixoTreino}`}
            podeMenos={c.limiteBaixoTreino > 50}
            podeMais={c.limiteBaixoTreino < c.limiteComerAntes}
            onMenos={() => salvar({ limiteBaixoTreino: c.limiteBaixoTreino - 5 })}
            onMais={() => salvar({ limiteBaixoTreino: c.limiteBaixoTreino + 5 })}
          />
          <Ajuste
            rotulo="Comer antes até"
            valor={`${c.limiteComerAntes}`}
            podeMenos={c.limiteComerAntes > c.limiteBaixoTreino}
            podeMais={c.limiteComerAntes < 150}
            onMenos={() => salvar({ limiteComerAntes: c.limiteComerAntes - 5 })}
            onMais={() => salvar({ limiteComerAntes: c.limiteComerAntes + 5 })}
          />
          <Ajuste
            rotulo="Não treinar acima de"
            valor={c.limiteAltoTreino === null ? "sem limite" : `${c.limiteAltoTreino}`}
            podeMenos={c.limiteAltoTreino !== null}
            podeMais={c.limiteAltoTreino === null || c.limiteAltoTreino < 400}
            onMenos={() => salvar({ limiteAltoTreino: c.limiteAltoTreino! <= 180 ? null : c.limiteAltoTreino! - 10 })}
            onMais={() => salvar({ limiteAltoTreino: c.limiteAltoTreino === null ? 250 : c.limiteAltoTreino + 10 })}
          />
            </>
          )}
          <Ajuste
            rotulo="Descansos por semana"
            valor={`${c.descansosPorSemana}`}
            podeMenos={c.descansosPorSemana > 0}
            podeMais={c.descansosPorSemana < 3}
            onMenos={() => salvar({ descansosPorSemana: c.descansosPorSemana - 1 })}
            onMais={() => salvar({ descansosPorSemana: c.descansosPorSemana + 1 })}
          />
          <Ajuste
            rotulo="Esteira na 1ª semana (min)"
            valor={`${c.esteiraBaseMin}`}
            podeMenos={c.esteiraBaseMin > 10}
            podeMais={c.esteiraBaseMin < 60}
            onMenos={() => salvar({ esteiraBaseMin: c.esteiraBaseMin - 5 })}
            onMais={() => salvar({ esteiraBaseMin: c.esteiraBaseMin + 5 })}
          />
          {comGlicose && <p className="nota">Valores de glicose em mg/dL. Use os limites definidos com seu médico; o app não sugere valores.</p>}
          <div className="interruptor">
            <span>
              Parte de glicose
              <br />
              <small className="suave">{comGlicose ? "Ligada: medições, sensor, checagem antes do treino e relatório." : "Desligada. Seus dados de glicose continuam guardados."}</small>
            </span>
            <button className="chip" aria-pressed={comGlicose} onClick={() => void definirGlicose(!comGlicose)}>
              {comGlicose ? "Desligar" : "Ligar"}
            </button>
          </div>
          <button className="discreto" onClick={() => void baixarBackup()}>
            Baixar backup dos meus dados
          </button>
          <label className="discreto botao-arquivo">
            Restaurar a partir de um backup
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restaurar(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="nota">
            Regras de XP: treino ou pausa legítima 40 (até 2 por dia) · meta de limite (tela, jogos) 10 por registrar o dia + 15 se ficou dentro · meta de mínimo (estudo) 5 a cada 15 min (até 60 min)
            {comGlicose && " · checagem antes do treino 10 · glicose registrada 5 (até 6)"} · água 2 a cada 250 ml + 10 na meta · dia garantido 20 · bônus de
            sequência +2 por dia (até +20) · refeição 5 (até 4) · caminhada pós-refeição 10 (até 3) · sono e peso{comGlicose && " e insulina"} 5 cada por dia · missão da semana 50 · chefe 150. O dia vira às 3h. Seus dados
            ficam só neste aparelho.
          </p>
        </>
      )}
    </section>
  );
}
