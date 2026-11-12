import { describe, expect, it } from "vitest";
import { episodiosAbaixo, leituraRecente, lerPacote, linkPuxarDoSensor, paraGuardar, tempoNoAlvo, type LeituraSensor } from "./sensor";

const MIN = 60 * 1000;
const agora = new Date(2026, 10, 12, 12, 0).getTime();
const baseSeg = Math.floor((agora - 60 * MIN) / 1000);

describe("lerPacote", () => {
  it("lê histórico, leitura atual, tendência e serviço", () => {
    const texto = `v1.2.1.${baseSeg + 3600}.${baseSeg}.3540:110.0:150,900:140,1800:130`;
    const r = lerPacote(texto, agora);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pacote.tendencia).toBe(2);
    expect(r.pacote.servicoLigado).toBe(true);
    expect(r.pacote.atual).toEqual({ ts: (baseSeg + 3540) * 1000, valor: 110 });
    expect(r.pacote.leituras.map((x) => x.valor)).toEqual([150, 140, 130]);
  });

  it("aceita pacote sem leitura atual e sem histórico", () => {
    const r = lerPacote(`v1.0.0.0.${baseSeg}..`, agora);
    expect(r.ok && r.pacote.leituras.length === 0 && r.pacote.atual === undefined).toBe(true);
  });

  it("descarta valores absurdos e horários no futuro", () => {
    const r = lerPacote(`v1.3.1.0.${baseSeg}..0:5,60:120,${3 * 3600}:120`, agora);
    expect(r.ok && r.pacote.leituras.length).toBe(1);
  });

  it("reconhece app ausente, erro e lixo", () => {
    expect(lerPacote("sem-app")).toEqual({ ok: false, motivo: "sem-app" });
    expect(lerPacote("erro")).toEqual({ ok: false, motivo: "erro" });
    expect(lerPacote("<script>")).toEqual({ ok: false, motivo: "invalido" });
    expect(lerPacote("v1.9.1.0.0..")).toEqual({ ok: false, motivo: "invalido" });
  });
});

describe("paraGuardar", () => {
  it("junta atual e histórico sem repetir horário", () => {
    const ts = agora - 10 * MIN;
    const xs = paraGuardar({ tendencia: 3, servicoLigado: true, atual: { ts, valor: 101 }, leituras: [{ ts, valor: 100 }, { ts: ts - MIN, valor: 99 }] });
    expect(xs.map((x) => x.valor)).toEqual([99, 101]);
    expect(xs[0].dia).toBe("2026-11-12");
  });
});

describe("linkPuxarDoSensor", () => {
  it("abre o app Glicose e volta para o Game Life se ele não existir", () => {
    const link = linkPuxarDoSensor("https://exemplo.github.io/game-life/");
    expect(link).toContain("scheme=glicoserelogio");
    expect(link).toContain("package=br.gleite.glicose");
    expect(decodeURIComponent(link)).toContain("https://exemplo.github.io/game-life/#sensor=sem-app");
  });
});

const serie = (valores: number[], passoMin = 5, inicio = agora - 60 * MIN): LeituraSensor[] =>
  valores.map((valor, i) => ({ ts: inicio + i * passoMin * MIN, valor, dia: "2026-11-12" }));

describe("leituraRecente", () => {
  it("só devolve leitura de até 15 min", () => {
    const xs = serie([100, 110], 5, agora - 20 * MIN);
    expect(leituraRecente(xs, agora)?.valor).toBe(110);
    expect(leituraRecente(xs, agora + 20 * MIN)).toBeUndefined();
  });
});

describe("tempoNoAlvo", () => {
  it("conta tempo, não número de leituras", () => {
    // 12 leituras de 5 em 5 min cobrindo 1 h: 6 no alvo, 3 abaixo, 3 acima.
    const xs = serie([100, 100, 100, 100, 100, 100, 60, 60, 60, 200, 200, 200]);
    const t = tempoNoAlvo(xs, agora - 60 * MIN, agora);
    expect(t.coberturaPct).toBe(100);
    expect(t.noAlvoPct).toBe(50);
    expect(t.abaixoPct).toBe(25);
    expect(t.acimaPct).toBe(25);
  });

  it("buracos sem leitura não contam e baixam a cobertura", () => {
    // Uma leitura só vale 15 min. Duas leituras numa janela de 2 h = 30 min cobertos = 25%.
    const xs = serie([120, 120], 60, agora - 120 * MIN);
    const t = tempoNoAlvo(xs, agora - 120 * MIN, agora);
    expect(t.coberturaPct).toBe(25);
    expect(t.suficiente).toBe(false);
    expect(t.noAlvoPct).toBe(100);
  });

  it("sem leituras não inventa número", () => {
    const t = tempoNoAlvo([], agora - 60 * MIN, agora);
    expect(t.noAlvoPct).toBeNull();
    expect(t.coberturaPct).toBe(0);
  });
});

describe("episodiosAbaixo", () => {
  it("só conta quando dura 15 min ou mais", () => {
    expect(episodiosAbaixo(serie([100, 65, 62, 100]))).toHaveLength(0); // 5 min
    const eps = episodiosAbaixo(serie([100, 65, 62, 58, 66, 100]));
    expect(eps).toHaveLength(1);
    expect(eps[0].minimo).toBe(58);
  });

  it("um buraco longo separa episódios", () => {
    const xs = [...serie([60, 60, 60, 60]), ...serie([60, 60, 60, 60], 5, agora + 60 * MIN)];
    expect(episodiosAbaixo(xs)).toHaveLength(2);
  });
});
