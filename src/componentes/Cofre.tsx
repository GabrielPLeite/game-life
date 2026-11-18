// Cofre: guarda uma senha que você não sabe de cor (a do app de bloqueio, por exemplo).
// Para ver a senha, é preciso ficar 30 minutos seguidos nesta tela. Sair, apagar a tela ou mexer
// no relógio do celular zera a espera. A senha fica só neste aparelho e não vai para o backup.
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export const ESPERA_MIN = 30;
/** Depois de liberada, a senha fica visível por 5 min e volta a se esconder. */
const VISIVEL_MIN = 5;
/** Intervalo máximo entre dois "tiques" do relógio. Mais que isso = saiu da tela ou mexeu no relógio. */
const SALTO_MAX_MS = 5_000;

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha aleatória de 16 caracteres, sem letras que confundem (0/O, 1/l/I). */
export function gerarSenha(tamanho = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho * 2));
  let senha = "";
  for (const b of bytes) {
    if (b >= 256 - (256 % ALFABETO.length)) continue; // evita viés
    senha += ALFABETO[b % ALFABETO.length];
    if (senha.length === tamanho) break;
  }
  return senha.length === tamanho ? senha : gerarSenha(tamanho);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Cofre() {
  const guardado = useLiveQuery(() => db.cofre.get("unica"), []);
  const [mostrarNova, setMostrarNova] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const [liberadoAte, setLiberadoAte] = useState<number | null>(null);

  const guardarNova = async () => {
    const senha = gerarSenha();
    await db.cofre.put({ id: "unica", senha, criadaEm: new Date().toISOString() });
    setLiberadoAte(null);
    setMostrarNova(senha);
  };

  if (guardado === undefined && mostrarNova === null) {
    return (
      <div className="etapa cofre">
        <p className="nota">
          Gere uma senha forte e use-a no app de bloqueio. Ela some da tela e só volta depois de {ESPERA_MIN} minutos seguidos aqui.
        </p>
        <button className="discreto" onClick={() => void guardarNova()}>
          Gerar senha
        </button>
      </div>
    );
  }

  if (mostrarNova) {
    return (
      <div className="etapa cofre">
        <p className="nota">Copie esta senha para o app de bloqueio agora. Ela não vai aparecer de novo sem a espera.</p>
        <Senha valor={mostrarNova} />
        <button className="discreto" onClick={() => setMostrarNova(null)}>
          Já usei, pode esconder
        </button>
      </div>
    );
  }

  if (liberadoAte && guardado) {
    return <Liberada senha={guardado.senha} ate={liberadoAte} onFim={() => setLiberadoAte(null)} onTrocar={() => void guardarNova()} />;
  }

  if (esperando) {
    return (
      <Espera
        onLiberar={() => {
          setEsperando(false);
          setLiberadoAte(Date.now() + VISIVEL_MIN * 60_000);
        }}
        onDesistir={() => setEsperando(false)}
      />
    );
  }

  return (
    <div className="etapa cofre">
      <p className="nota">
        A senha está guardada. Para vê-la, fique {ESPERA_MIN} minutos seguidos nesta tela. Sair do app, apagar a tela ou mudar o relógio recomeça a contagem.
      </p>
      <button className="discreto" onClick={() => setEsperando(true)}>
        Pedir a senha
      </button>
    </div>
  );
}

/** Contagem de 30 min que só anda com esta tela aberta e o relógio andando normalmente. */
function Espera({ onLiberar, onDesistir }: { onLiberar: () => void; onDesistir: () => void }) {
  const [restante, setRestante] = useState(ESPERA_MIN * 60_000);
  const [recomecou, setRecomecou] = useState(false);
  const ultimo = useRef(Date.now());

  useEffect(() => {
    // Mantém a tela acesa durante a espera, quando o navegador permite.
    let trava: { release: () => Promise<void> } | undefined;
    const pedirTrava = () =>
      (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request("screen")
        .then((t) => (trava = t))
        .catch(() => undefined);
    void pedirTrava();

    const zerar = () => {
      setRestante(ESPERA_MIN * 60_000);
      setRecomecou(true);
      ultimo.current = Date.now();
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") zerar();
      else void pedirTrava();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    const t = setInterval(() => {
      const agora = Date.now();
      const passou = agora - ultimo.current;
      ultimo.current = agora;
      // Pulo grande (app em segundo plano, tela apagada) ou relógio voltando: recomeça do zero.
      if (passou > SALTO_MAX_MS || passou < 0) return zerar();
      setRestante((r) => r - passou);
    }, 1000);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      void trava?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (restante <= 0) onLiberar();
  }, [restante, onLiberar]);

  const pct = Math.round((1 - restante / (ESPERA_MIN * 60_000)) * 100);
  return (
    <div className="etapa cofre">
      <p className="total">
        {mmss(restante)} <small>para liberar</small>
      </p>
      <div className="barra grande" role="progressbar" aria-label="Espera" aria-valuenow={pct} aria-valuemax={100}>
        <div className="barra-cheia meta" style={{ width: `${pct}%` }} />
      </div>
      <p className="nota">
        {recomecou ? "A contagem recomeçou porque a tela saiu do ar. " : ""}Deixe esta tela aberta. Se ainda quiser a senha quando acabar, ela aparece aqui.
      </p>
      <button className="discreto" onClick={onDesistir}>
        Desistir
      </button>
    </div>
  );
}

function Liberada({ senha, ate, onFim, onTrocar }: { senha: string; ate: number; onFim: () => void; onTrocar: () => void }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (agora >= ate) onFim();
  }, [agora, ate, onFim]);
  return (
    <div className="etapa cofre">
      <Senha valor={senha} />
      <p className="nota">Some em {mmss(ate - agora)}. Depois de usar, troque a senha no app de bloqueio por uma nova para a próxima vez.</p>
      <button className="discreto" onClick={onTrocar}>
        Gerar senha nova
      </button>
    </div>
  );
}

function Senha({ valor }: { valor: string }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className="linha senha">
      <code>{valor}</code>
      <button
        className="link"
        onClick={() =>
          void navigator.clipboard
            ?.writeText(valor)
            .then(() => setCopiada(true))
            .catch(() => undefined)
        }
      >
        {copiada ? "copiada" : "copiar"}
      </button>
    </div>
  );
}
