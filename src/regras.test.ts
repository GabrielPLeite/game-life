import { describe, expect, it } from "vitest";
import {
  calcularSequencia,
  classificarGlicose,
  diaLogico,
  inicioDaSemana,
  nivelDeXp,
  seFaltarHoje,
  somarDias,
  xpAgua,
  xpDoDia,
} from "./regras";

describe("diaLogico", () => {
  it("antes das 3h ainda é o dia anterior", () => {
    expect(diaLogico(new Date(2026, 10, 12, 2, 59))).toBe("2026-11-11");
    expect(diaLogico(new Date(2026, 10, 12, 3, 0))).toBe("2026-11-12");
  });
});

describe("xpAgua", () => {
  it("dá 2 XP por copo de 250 ml", () => {
    expect(xpAgua(0, 2500)).toBe(0);
    expect(xpAgua(249, 2500)).toBe(0);
    expect(xpAgua(750, 2500)).toBe(6);
  });
  it("dá bônus ao atingir a meta e nada acima dela", () => {
    expect(xpAgua(2500, 2500)).toBe(30);
    expect(xpAgua(6000, 2500)).toBe(30);
  });
});

describe("nivelDeXp", () => {
  it("segue a tabela 300, 400, 500...", () => {
    expect(nivelDeXp(0).nivel).toBe(1);
    expect(nivelDeXp(299).nivel).toBe(1);
    expect(nivelDeXp(300)).toEqual({ nivel: 2, xpNoNivel: 0, xpParaProximo: 400 });
    expect(nivelDeXp(1800).nivel).toBe(5);
    expect(nivelDeXp(6300).nivel).toBe(10);
  });
});

describe("datas", () => {
  it("soma dias atravessando meses", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("acha a segunda-feira da semana", () => {
    expect(inicioDaSemana("2026-11-11")).toBe("2026-11-09"); // quarta
    expect(inicioDaSemana("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(inicioDaSemana("2026-11-09")).toBe("2026-11-09");
  });
});

describe("classificarGlicose", () => {
  const limites = { limiteBaixoTreino: 70, limiteComerAntes: 80, limiteAltoTreino: null };
  it("segue os limites configurados", () => {
    expect(classificarGlicose(69, limites)).toBe("baixa");
    expect(classificarGlicose(70, limites)).toBe("comer_antes");
    expect(classificarGlicose(80, limites)).toBe("comer_antes");
    expect(classificarGlicose(81, limites)).toBe("liberado");
    expect(classificarGlicose(400, limites)).toBe("liberado");
  });
  it("só usa o limite alto quando ele existe", () => {
    expect(classificarGlicose(260, { ...limites, limiteAltoTreino: 250 })).toBe("alta");
  });
});

describe("xpDoDia", () => {
  const base = { sessoes: 0, checagens: 0, glicoses: 0, aguaMl: 0, metaAguaMl: 2500, garantido: false, sequencia: 0 };
  it("dia normal: 1 treino com checagem, 3 glicoses, meta de água, sequência 5", () => {
    const { total, partes } = xpDoDia({ ...base, sessoes: 1, checagens: 1, glicoses: 3, aguaMl: 2500, garantido: true, sequencia: 5 });
    expect(partes).toEqual({ treinos: 40, checagens: 10, glicose: 15, agua: 30, dia: 20, bonus: 10 });
    expect(total).toBe(125);
  });
  it("aplica os tetos", () => {
    const { partes } = xpDoDia({ ...base, sessoes: 5, checagens: 5, glicoses: 20, garantido: true, sequencia: 50 });
    expect(partes.treinos).toBe(80);
    expect(partes.checagens).toBe(20);
    expect(partes.glicose).toBe(30);
    expect(partes.bonus).toBe(20);
  });
});

describe("calcularSequencia", () => {
  // Monta a sequência a partir de uma string: C=cumprido, P=pausa, D=descanso, .=vazio. Último caractere = hoje.
  function rodar(padrao: string) {
    const inicio = "2026-11-01";
    const hoje = somarDias(inicio, padrao.length - 1);
    const mapa: Record<string, "C" | "P" | "D" | "."> = {};
    [...padrao].forEach((c, i) => (mapa[somarDias(inicio, i)] = c as "C"));
    const situacao = { C: "cumprido", P: "pausa", D: "descanso", ".": "vazio" } as const;
    return calcularSequencia(inicio, hoje, (d) => situacao[mapa[d]]);
  }

  it("hoje vazio fica pendente e não quebra nada", () => {
    const e = rodar("CCC.");
    expect(e.atual).toBe(3);
    expect(e.dias.at(-1)?.resultado).toBe("pendente");
  });
  it("pausa e descanso contam como dias garantidos", () => {
    expect(rodar("CPDC").atual).toBe(4);
  });
  it("falta sem congelamento corta pela metade e guarda o recorde", () => {
    const e = rodar("CCCCCC.C");
    expect(e.atual).toBe(4); // 6 -> 3 -> +1
    expect(e.recorde).toBe(6);
  });
  it("ganha congelamento a cada 7 dias e usa sozinho na falta", () => {
    const e = rodar("CCCCCCC.C");
    expect(e.dias[7].resultado).toBe("congelado");
    expect(e.atual).toBe(8);
    expect(e.congelamentos).toBe(0);
  });
  it("guarda no máximo 2 congelamentos", () => {
    expect(rodar("C".repeat(30)).congelamentos).toBe(2);
  });
  it("mostra o que acontece se faltar hoje", () => {
    expect(seFaltarHoje(rodar("CCCCCC."))).toEqual({ usaCongelamento: false, sequenciaDepois: 3 });
    expect(seFaltarHoje(rodar("CCCCCCC."))).toEqual({ usaCongelamento: true, sequenciaDepois: 7 });
  });
});
