import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ehAndroid, linkBolinha } from "../flutuante";
import { MiniBrasa, useJanelinha } from "./Flutuante";
import { alimentarBrasa } from "../db";
import { estagioDe, falaDe, humorDe, janelaAberta, JANELAS, poseDe, proximaJanela, type Humor, type Refeicao, type RefeicaoBrasa, type Situacao } from "../brasa";
import type { Resumo } from "../resumo";
import { MAX_CONGELAMENTOS } from "../regras";
import { animacaoBase, esperaGesto, gestoEspontaneo, NAO_INTERROMPE, proximaVariacao, reacaoPara, variacoesDe, type Animacao, type Catalogo, type Evento } from "../animacao";

const BASE = import.meta.env.BASE_URL;

/** Relógio que anda a cada minuto, para a Brasa mudar de humor sozinha (fome, sono...). */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const CHAVE_BOLINHA = "brasa-bolinha";
function lerBolinha() {
  try {
    return localStorage.getItem(CHAVE_BOLINHA) === "1";
  } catch {
    return false;
  }
}
function gravarBolinha(ligada: boolean) {
  try {
    if (ligada) localStorage.setItem(CHAVE_BOLINHA, "1");
    else localStorage.removeItem(CHAVE_BOLINHA);
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

const ROTULO_HUMOR: Record<Humor, string> = {
  feliz: "feliz",
  animada: "animada",
  energia: "com energia",
  cansada: "cansada",
  dormindo: "dormindo",
  fome: "com fome",
  satisfeita: "satisfeita",
  sede: "com sede",
  hidratada: "bem hidratada",
  fraca: "fraquinha",
  doente: "de cobertor",
  curiosa: "curiosa",
  carinhosa: "carinhosa",
  irritada: "fingindo estar brava",
};

// ---------- Animação por quadros ----------

let catalogo: Promise<Catalogo | undefined> | null = null;
/** Lista de animações disponíveis (public/brasa/anim/animacoes.json). Sem o arquivo, fica só nas poses paradas. */
function useCatalogo() {
  const [c, setC] = useState<Catalogo>();
  useEffect(() => {
    catalogo ??= fetch(`${BASE}brasa/anim/animacoes.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Catalogo>) : undefined))
      .catch(() => undefined);
    void catalogo.then(setC);
  }, []);
  return c;
}

/** Toca uma folha de quadros. Em loop, repete; senão, avisa quando acabar. */
function Quadros({ anim, onFim }: { anim: Animacao; onFim: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fim = useRef(onFim);
  const colunas = anim.colunas ?? anim.quadros;
  const linhas = anim.linhas ?? 1;
  fim.current = onFim;
  useEffect(() => {
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const mostrar = (i: number) => {
      const c = i % colunas;
      const l = Math.floor(i / colunas);
      if (ref.current) ref.current.style.backgroundPosition = `${colunas > 1 ? (c / (colunas - 1)) * 100 : 0}% ${linhas > 1 ? (l / (linhas - 1)) * 100 : 0}%`;
    };
    mostrar(0);
    if (calmo) {
      if (!anim.loop) fim.current();
      return;
    }
    let id = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const total = anim.vaievem && anim.quadros > 1 ? anim.quadros * 2 - 2 : anim.quadros;
      let i = Math.floor(((t - t0) / 1000) * anim.fps);
      if (i >= total) {
        if (!anim.loop) return fim.current();
        i %= total;
      }
      mostrar(i < anim.quadros ? i : total - i);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [anim]);
  return (
    <div
      ref={ref}
      className="brasa-quadros"
      style={{ backgroundImage: `url(${BASE}brasa/anim/${anim.arquivo})`, backgroundSize: `${colunas * 100}% ${linhas * 100}%`, aspectRatio: `${anim.largura} / ${anim.altura}` }}
    />
  );
}

// Vídeos WebM com transparência. Cada arquivo é baixado uma vez e fica na memória: trocar de
// animação não espera a rede. O service worker guarda os arquivos para o app funcionar offline.
const clipes = new Map<string, Promise<string | undefined>>();
function carregarClipe(arquivo: string) {
  let p = clipes.get(arquivo);
  if (!p) {
    p = fetch(`${BASE}brasa/anim/${arquivo}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("clipe"))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        clipes.delete(arquivo);
        return undefined;
      });
    clipes.set(arquivo, p);
  }
  return p;
}

/** Baixa em segundo plano todos os vídeos do estágio, um de cada vez, para as trocas serem instantâneas. */
function usePreCarregar(cat: Catalogo | undefined, estagio: number) {
  useEffect(() => {
    if (!cat) return;
    const lista = Object.values(cat[`e${estagio}`] ?? {}).filter((a) => a?.formato === "webm");
    let vivo = true;
    void (async () => {
      for (const a of lista) if (vivo) await carregarClipe(a.arquivo);
    })();
    return () => {
      vivo = false;
    };
  }, [cat, estagio]);
}

interface Camada {
  id: number;
  anim: Animacao;
  url: string;
}

/**
 * Toca um vídeo da Brasa. Quando a animação muda, o vídeo novo entra POR CIMA do antigo e o antigo
 * só sai quando o novo já está rodando: nunca aparece um quadro vazio entre duas animações.
 * Enquanto o primeiro vídeo não chega, mostra `reserva` (a pose parada).
 */
function Clipe({ anim, chave, onFim, reserva }: { anim: Animacao; chave: string; onFim: () => void; reserva: ReactNode }) {
  const [camadas, setCamadas] = useState<Camada[]>([]);
  const seq = useRef(0);
  const fim = useRef(onFim);
  fim.current = onFim;
  const calmo = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const dados = useRef(anim);
  dados.current = anim;

  useEffect(() => {
    let vivo = true;
    const a = dados.current;
    void carregarClipe(a.arquivo).then((url) => {
      if (!vivo || !url) return;
      if (calmo && !a.loop) return fim.current();
      setCamadas((c) => [...c, { id: ++seq.current, anim: a, url }].slice(-2));
    });
    return () => {
      vivo = false;
    };
  }, [chave, calmo]);

  return (
    <div className="brasa-clipe" style={{ aspectRatio: `${anim.largura} / ${anim.altura}` }}>
      {camadas.length === 0 && reserva}
      {camadas.map((c) => (
        <video
          key={c.id}
          src={c.url}
          muted
          playsInline
          autoPlay={!calmo}
          loop={c.anim.loop}
          preload="auto"
          onPlaying={() => setCamadas((cs) => cs.filter((x) => x.id >= c.id))}
          onEnded={() => !c.anim.loop && fim.current()}
        />
      ))}
    </div>
  );
}

// ---------- Movimento ----------

/** Velocidade de passeio (% da largura da cena por segundo). Zero = fica no lugar. */
const VELOCIDADE: Partial<Record<Humor, number>> = { animada: 16, energia: 13, feliz: 9, hidratada: 9, curiosa: 7, sede: 4 };
/** Para que lado cada desenho olha (1 = direita). Os outros olham para a esquerda. */
const OLHA_DIREITA = new Set(["e1-com-sede", "e1-bem-hidratada", "e1-com-fome", "e1-doente", "e1-carinhosa", "e2-curiosa", "e2-bufando", "e3-feliz", "e3-rugindo", "e3-pronta", "e3-carinhosa"]);

/**
 * Movimento da Brasa pela cena. Ela só sai do lugar se existir a animação de andar (pernas de verdade);
 * sem ela, fica parada, para não "deslizar" com as patas paradas. Nas poses paradas, o código ainda dá
 * respiração e pulinhos; com animação por quadros, quem mexe é a própria animação.
 */
function useMovimento(humor: Humor, arquivo: string, pulo: number, podeAndar: boolean, aoAndar: (andando: boolean) => void) {
  const corpo = useRef<HTMLDivElement>(null);
  const virador = useRef<HTMLDivElement>(null);
  const estado = useRef({ x: 50, alvo: 50, dir: -1, pausaAte: 0, ultimo: 0, puloEm: -1e9 });
  const humorRef = useRef(humor);
  humorRef.current = humor;
  const arquivoRef = useRef(arquivo);
  arquivoRef.current = arquivo;
  const podeAndarRef = useRef(podeAndar);
  podeAndarRef.current = podeAndar;
  const aoAndarRef = useRef(aoAndar);
  aoAndarRef.current = aoAndar;
  const andavaRef = useRef(false);

  useEffect(() => {
    estado.current.puloEm = performance.now();
  }, [pulo]);

  useEffect(() => {
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let id = 0;
    const quadro = (t: number) => {
      const e = estado.current;
      const dt = Math.min(0.05, (t - (e.ultimo || t)) / 1000);
      e.ultimo = t;
      const h = humorRef.current;
      const vel = calmo || !podeAndarRef.current ? 0 : VELOCIDADE[h] ?? 0;
      let andando = false;
      if (vel > 0 && t > e.pausaAte) {
        const falta = e.alvo - e.x;
        if (Math.abs(falta) < 0.6) {
          e.pausaAte = t + 1500 + Math.random() * 3500;
          e.alvo = 14 + Math.random() * 72;
        } else {
          e.dir = Math.sign(falta);
          e.x += e.dir * Math.min(Math.abs(falta), vel * dt);
          andando = true;
        }
      } else if (vel === 0) {
        // Parada: volta devagar para o meio da cena.
        e.x += (50 - e.x) * Math.min(1, dt * 1.5);
      }

      if (andando !== andavaRef.current) {
        andavaRef.current = andando;
        aoAndarRef.current(andando);
      }

      let y = 0;
      let sy = 1;
      const porQuadros = arquivoRef.current.startsWith("anim:");
      if (!calmo) {
        if (andando || porQuadros) {
          // A própria animação já respira: não soma outro movimento por cima.
        } else if (h === "dormindo" || h === "cansada" || h === "doente" || h === "fraca") {
          sy = 1 + 0.035 * Math.sin((t / 4200) * Math.PI * 2);
        } else {
          sy = 1 + 0.022 * Math.sin((t / 2600) * Math.PI * 2);
        }
        // Pulinhos: com fome (pedindo comida), animada de vez em quando, e quando você toca.
        const ciclo = h === "fome" ? 1700 : h === "animada" ? 3200 : 0;
        if (ciclo && !porQuadros) {
          const f = (t % ciclo) / ciclo;
          if (f < 0.22) y -= Math.sin((f / 0.22) * Math.PI) * 14;
        }
        const desde = t - e.puloEm;
        if (desde < 520 && !porQuadros) y -= Math.sin((desde / 520) * Math.PI) * 26;
      }
      const olhaDireita = OLHA_DIREITA.has(arquivoRef.current) ? 1 : -1;
      if (corpo.current) corpo.current.style.left = `${e.x}%`;
      if (virador.current) virador.current.style.transform = `translateY(${y.toFixed(1)}px) scale(${(e.dir * olhaDireita).toFixed(0)}, ${sy.toFixed(3)})`;
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, []);

  return { corpo, virador };
}

/** Faíscas que sobem da Brasa. Mais quando ela está animada; nenhuma quando está de cobertor. */
function Faiscas({ humor }: { humor: Humor }) {
  const n = humor === "animada" || humor === "energia" ? 9 : humor === "doente" || humor === "dormindo" ? 0 : humor === "cansada" || humor === "fraca" ? 2 : 5;
  return (
    <div className="faiscas" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ left: `${15 + ((i * 37) % 70)}%`, animationDelay: `${(i * 0.53) % 2.6}s`, animationDuration: `${2.2 + ((i * 7) % 5) * 0.25}s` }} />
      ))}
    </div>
  );
}

// ---------- Gaveta (painel que sobe de baixo) ----------

export function Gaveta({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onFechar]);
  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <div className="gaveta" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="gaveta-topo">
          <h2>{titulo}</h2>
          <button className="link" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Tela principal ----------

export interface AtalhoCovil {
  id: string;
  icone: string;
  nome: string;
  /** Selo pequeno no canto do ícone (✓, %, !). */
  selo?: string;
  alerta?: boolean;
  painel: ReactNode;
}

/**
 * Covil: a Brasa vive numa cena no topo da tela Hoje. Treino, água e o resto viram ícones pequenos
 * embaixo dela; tocar num ícone abre o painel daquela parte sem sair de perto dela.
 */
export default function Covil({ resumo, refeicoes, hoje, atalhos }: { resumo: Resumo; refeicoes: RefeicaoBrasa[]; hoje: string; atalhos: AtalhoCovil[] }) {
  const agora = useAgora();
  const [reacao, setReacao] = useState<{ situacao: Situacao; humor?: Humor; n: number } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const toques = useRef<number[]>([]);

  // A reação a um toque ou à comida dura alguns segundos e some.
  useEffect(() => {
    if (!reacao) return;
    const t = setTimeout(() => setReacao(null), 4500);
    return () => clearTimeout(t);
  }, [reacao]);

  const dias = resumo.sequencia.dias;
  const diasCumpridos = dias.filter((d) => d.resultado === "cumprido").length;
  const ultimoTreino = dias.map((d) => d.resultado).lastIndexOf("cumprido");
  const treinouHoje = resumo.hoje.treinosConcluidos.length > 0;
  const comidas = refeicoes.filter((r) => r.dia === hoje).map((r) => r.refeicao);
  const ultimaRefeicaoEm = [...refeicoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).at(-1)?.criadoEm;
  const sono = resumo.habitosHoje.filter((h) => h.tipo === "sono" && !h.excluidoEm).at(-1);
  const sonoHoras = sono && "horas" in sono ? sono.horas : undefined;

  const humorDoDia = humorDe({
    agora,
    treinouHoje,
    diasSemTreino: ultimoTreino < 0 ? undefined : dias.length - 1 - ultimoTreino,
    pausaHoje: !!resumo.hoje.pausa,
    sonoHoras,
    aguaMl: resumo.hoje.aguaMl,
    metaAguaMl: resumo.hoje.metaAguaMl,
    refeicoesHoje: comidas,
    ultimaRefeicaoEm,
  });
  const humor = reacao?.humor ?? humorDoDia;
  const estagio = estagioDe(diasCumpridos);
  const pose = poseDe(estagio.n, humor);
  const fala = reacao ? falaDe(reacao.situacao, `${hoje}-${reacao.n}`) : falaDe(humorDoDia, `${hoje}-${agora.getHours()}`);

  // Animação por quadros: base do humor, com gestos espontâneos e reações por cima.
  const cat = useCatalogo();
  usePreCarregar(cat, estagio.n);
  const base = animacaoBase(cat, estagio.n, humor);
  const [extra, setExtra] = useState<string | null>(null);
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const reagir = (evento: Evento) => {
    const r = reacaoPara(cat, estagio.n, evento);
    if (r && !(extraRef.current && NAO_INTERROMPE.has(extraRef.current))) setExtra(r);
  };
  // Piscar e olhar em volta de vez em quando, com intervalos sorteados.
  useEffect(() => {
    if (extra || !base) return;
    const t = setTimeout(() => setExtra(gestoEspontaneo(cat, estagio.n, base, Math.random())), esperaGesto(Math.random()));
    return () => clearTimeout(t);
  }, [extra, base, cat, estagio.n]);
  // Comemora quando um treino é concluído com o app aberto.
  const treinouAntes = useRef(treinouHoje);
  useEffect(() => {
    if (treinouHoje && !treinouAntes.current) reagir("treinou");
    treinouAntes.current = treinouHoje;
  });
  // Repouso com variações (idle, idle2, idle3...): ao fim de cada uma, sorteia a próxima.
  const variacoes = variacoesDe(cat, estagio.n, base);
  const [variacao, setVariacao] = useState(0);
  const baseAtual = variacoes.length > 1 ? variacoes[variacao % variacoes.length] : base;
  const sortearVariacao = () => setVariacao((v) => proximaVariacao(v, variacoes.length, Math.random()));
  const temAndar = !!cat?.[`e${estagio.n}`]?.andar;
  const [andando, setAndando] = useState(false);
  const nomeAnim = andando && temAndar ? "andar" : extra ?? baseAtual;
  const animCru = nomeAnim ? cat?.[`e${estagio.n}`]?.[nomeAnim] : undefined;
  const anim = animCru && !extra && !andando && variacoes.length > 1 ? { ...animCru, loop: false } : animCru;
  const aoTerminar = () => (extra ? setExtra(null) : sortearVariacao());

  const { corpo, virador } = useMovimento(humor, anim ? `anim:${nomeAnim}` : pose.arquivo, reacao?.n ?? 0, temAndar, setAndando);

  const janela = janelaAberta(agora);
  const podeComer = janela !== null && !comidas.includes(janela);
  const proxima = proximaJanela(agora);
  const h = agora.getHours();
  const noite = h >= 19 || h < 6;
  const sonolenta = humor === "dormindo" || humor === "cansada";

  const tocar = () => {
    const t = Date.now();
    toques.current = [...toques.current.filter((x) => t - x < 6000), t];
    const muitos = toques.current.length >= 5;
    setReacao({ situacao: muitos ? "toqueDemais" : "toque", humor: muitos ? "irritada" : "carinhosa", n: t });
    reagir("toque");
  };
  const alimentar = async () => {
    if (!janela || !podeComer) return;
    await alimentarBrasa(janela);
    setReacao({ situacao: "alimentou", humor: "satisfeita", n: Date.now() });
    reagir("alimentou");
    // Com a bolinha ligada, avisa o celular que ela já comeu, para a bolinha parar de pedir comida.
    if (bolinhaLigada) setTimeout(() => (location.href = linkDaBolinha("satisfeita", [...comidas, janela])), 1200);
  };

  // Brasa fora do app: janelinha por cima de tudo no PC, bolinha flutuante no celular.
  const janelinha = useJanelinha();
  const android = typeof navigator !== "undefined" && ehAndroid(navigator.userAgent);
  const [bolinhaLigada, setBolinhaLigada] = useState(() => lerBolinha());
  const [semAppCelular, setSemAppCelular] = useState(false);
  useEffect(() => {
    if (location.hash !== "#bolinha=sem-app") return;
    history.replaceState(null, "", location.pathname + location.search);
    gravarBolinha(false);
    setBolinhaLigada(false);
    setSemAppCelular(true);
  }, []);
  const linkDaBolinha = (h: Humor, r: Refeicao[]) => linkBolinha(`${location.origin}${BASE}`, { estagio: estagio.n, humor: h, refeicoesHoje: r, dia: hoje });
  const ligarBolinha = () => {
    gravarBolinha(true);
    setBolinhaLigada(true);
    location.href = linkDaBolinha(humorDoDia, comidas);
  };

  const aguaPct = resumo.hoje.metaAguaMl ? Math.min(100, Math.round((resumo.hoje.aguaMl / resumo.hoje.metaAguaMl) * 100)) : 0;
  const { nivel, xpNoNivel, xpParaProximo } = resumo.nivel;
  const atalhoAberto = atalhos.find((a) => a.id === aberto);
  const s = resumo.sequencia;

  return (
    <section className="covil" aria-label="Brasa">
      <div className="covil-topo">
        <span className="covil-nivel">Nível {nivel}</span>
        <div className="barra fina" role="progressbar" aria-label="Progresso do nível" aria-valuenow={xpNoNivel} aria-valuemax={xpParaProximo}>
          <div className="barra-cheia xp" style={{ width: `${(xpNoNivel / xpParaProximo) * 100}%` }} />
        </div>
        <span title="Sequência">🔥 {s.atual}</span>
        <span title="Congelamentos">
          ❄️ {s.congelamentos}/{MAX_CONGELAMENTOS}
        </span>
        {janelinha.suportado && (
          <button className={`covil-fora ${janelinha.janela ? "ligado" : ""}`} onClick={() => (janelinha.janela ? janelinha.fechar() : void janelinha.abrir())} title={janelinha.janela ? "Fechar a janelinha da Brasa" : "Brasa numa janelinha por cima de tudo"} aria-label="Janelinha da Brasa">
            🪟
          </button>
        )}
        {android && (
          <button className={`covil-fora ${bolinhaLigada ? "ligado" : ""}`} onClick={ligarBolinha} title={bolinhaLigada ? "Atualizar a bolinha da Brasa" : "Brasa flutuando por cima dos apps"} aria-label="Bolinha flutuante da Brasa">
            🫧
          </button>
        )}
      </div>
      {semAppCelular && <p className="nota covil-aviso">Para a bolinha flutuante, instale a versão nova do app do celular.</p>}

      <div className={`cena ${noite ? "noite" : ""}`}>
        <svg className="cena-fundo" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden>
          <path d="M0 170 L60 120 L95 140 L150 70 L178 92 L200 80 L245 140 L290 110 L340 150 L400 120 L400 260 L0 260Z" className="montanha-longe" />
          <path d="M178 92 q11 -16 22 -12" className="fumaca" />
          <path d="M0 200 Q100 168 200 186 T400 178 L400 260 L0 260Z" className="morro" />
          <ellipse cx="200" cy="236" rx="190" ry="26" className="chao" />
          <g className="pedras">
            <ellipse cx="44" cy="226" rx="16" ry="7" />
            <ellipse cx="360" cy="230" rx="12" ry="6" />
            <ellipse cx="330" cy="236" rx="7" ry="4" />
          </g>
        </svg>
        {noite && <div className="estrelas" aria-hidden />}

        <div className="cena-status" aria-label="Como ela está">
          <span className="selo-status" title="Sono da última noite">
            💤 {sonoHoras !== undefined ? `${String(Math.round(sonoHoras * 10) / 10).replace(".", ",")}h` : "—"}
          </span>
          <span className="selo-status" title="Água de hoje">
            💧 {aguaPct}%
          </span>
          <span className={`selo-status ${treinouHoje ? "ok" : ""}`} title="Treino de hoje">
            💪 {treinouHoje ? "✓" : "—"}
          </span>
          <span className="selo-status" title="Refeições dela hoje">
            🍖 {comidas.length}/3
          </span>
        </div>

        <p className="brasa-fala" key={fala} aria-live="polite">
          {fala}
        </p>

        <div className="brasa-andante" ref={corpo}>
          <button className="brasa-corpo" onClick={tocar} aria-label={`Brasa está ${ROTULO_HUMOR[humor]}. Toque para fazer carinho.`}>
            <div className="brasa-virador" ref={virador}>
              {anim?.formato === "webm" ? (
                <Clipe anim={anim} chave={`${nomeAnim}-${variacao}`} onFim={aoTerminar} reserva={<img src={`${BASE}brasa/${pose.arquivo}.webp`} alt="" draggable={false} />} />
              ) : anim ? (
                <Quadros key={`${nomeAnim}-${variacao}`} anim={anim} onFim={aoTerminar} />
              ) : (
                <img key={pose.arquivo} src={`${BASE}brasa/${pose.arquivo}.webp`} alt="" draggable={false} />
              )}
            </div>
            <Faiscas humor={humor} />
            {pose.balao && (
              <span className="brasa-balao" aria-hidden>
                {pose.balao}
              </span>
            )}
            {sonolenta && (
              <span className="zzz" aria-hidden>
                <i>z</i>
                <i>z</i>
                <i>Z</i>
              </span>
            )}
          </button>
          <span className="brasa-sombra" aria-hidden />
        </div>

        <span className="cena-legenda">
          {estagio.nome} · {ROTULO_HUMOR[humor]}
        </span>
      </div>

      <div className="covil-acoes">
        <button className={`atalho ${podeComer ? "alerta" : ""}`} onClick={() => (podeComer ? void alimentar() : setAberto("comer"))} aria-label={podeComer ? "Alimentar a Brasa" : "Refeições da Brasa"}>
          <span className="atalho-icone">🍖</span>
          <span>{podeComer ? "Alimentar" : "Comida"}</span>
          {podeComer && <b className="atalho-selo">!</b>}
        </button>
        {atalhos.map((a) => (
          <button key={a.id} className={`atalho ${a.alerta ? "alerta" : ""}`} onClick={() => setAberto(a.id)}>
            <span className="atalho-icone">{a.icone}</span>
            <span>{a.nome}</span>
            {a.selo && <b className="atalho-selo">{a.selo}</b>}
          </button>
        ))}
      </div>

      <div className="covil-crescimento">
        {estagio.proximo ? (
          <>
            <div className="barra fina" role="progressbar" aria-label={`Crescimento até ${estagio.proximo.nome}`} aria-valuenow={Math.round(estagio.proximo.progresso * 100)} aria-valuemax={100}>
              <div className="barra-cheia fogo" style={{ width: `${Math.max(3, estagio.proximo.progresso * 100)}%` }} />
            </div>
            <p className="nota">
              Faltam {estagio.proximo.faltam} {estagio.proximo.faltam === 1 ? "dia" : "dias"} de treino para ela virar {estagio.proximo.nome}.{" "}
              {treinouHoje ? "🔥 Hoje ela já cresceu." : resumo.hoje.pausa ? "Hoje é pausa: ela não cresce, mas também não perde nada." : "Se faltar hoje, ela não cresce hoje."}
            </p>
          </>
        ) : (
          <p className="nota">Ela chegou ao maior tamanho. Cada treino agora é mais uma história de vocês dois.</p>
        )}
      </div>

      {aberto === "comer" && (
        <Gaveta titulo="Comida da Brasa" onFechar={() => setAberto(null)}>
          <div className="brasa-refeicoes">
            {(Object.keys(JANELAS) as Refeicao[]).map((r) => {
              const comeu = comidas.includes(r);
              return (
                <span key={r} className={`chip ${comeu ? "feito" : janela === r ? "aberta" : ""}`}>
                  {comeu ? "✓" : "·"} {JANELAS[r].nome} <small>{String(JANELAS[r].inicio).padStart(2, "0")}h–{JANELAS[r].fim}h</small>
                </span>
              );
            })}
          </div>
          <p className="nota">
            {janela ? "Ela já comeu nesta refeição." : proxima ? `Próxima refeição dela: ${JANELAS[proxima].nome.toLowerCase()}, a partir das ${JANELAS[proxima].inicio}h.` : "As refeições de hoje acabaram. Amanhã tem mais."}
          </p>
        </Gaveta>
      )}
      {atalhoAberto && (
        <Gaveta titulo={atalhoAberto.nome} onFechar={() => setAberto(null)}>
          {atalhoAberto.painel}
        </Gaveta>
      )}
      {janelinha.janela &&
        createPortal(
          <MiniBrasa
            imagem={`${location.origin}${BASE}brasa/${pose.arquivo}.webp`}
            fala={fala}
            legenda={`${estagio.nome} · ${ROTULO_HUMOR[humor]}`}
            balao={pose.balao}
            noite={noite}
            podeComer={podeComer}
            onTocar={tocar}
            onAlimentar={() => void alimentar()}
          />,
          janelinha.janela.document.body,
        )}
    </section>
  );
}
