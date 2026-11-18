import { describe, expect, it } from "vitest";
import { contarJardim, estagio } from "./jardim";

describe("jardim", () => {
  it("vaso novo começa como semente e hoje só conta depois de regar", () => {
    expect(contarJardim("2026-11-18", [], "2026-11-18").dias).toBe(0);
    expect(contarJardim("2026-11-18", [{ dia: "2026-11-18", regou: true }], "2026-11-18").dias).toBe(1);
  });

  it("dia sem resposta conta como regado", () => {
    expect(contarJardim("2026-11-10", [], "2026-11-18").dias).toBe(8);
  });

  it("'não reguei' zera a sequência mas guarda o recorde", () => {
    const r = contarJardim("2026-11-01", [{ dia: "2026-11-10", regou: false }], "2026-11-18");
    // 11 a 17 contam; hoje (18) ainda sem resposta.
    expect(r.dias).toBe(7);
    expect(r.recorde).toBe(9);
  });

  it("'não reguei' hoje zera na hora e a última resposta do dia vale", () => {
    expect(contarJardim("2026-11-15", [{ dia: "2026-11-18", regou: false }], "2026-11-18").dias).toBe(0);
    const corrigida = contarJardim("2026-11-15", [{ dia: "2026-11-18", regou: false }, { dia: "2026-11-18", regou: true }], "2026-11-18");
    expect(corrigida.dias).toBe(4);
  });

  it("estágios crescem com os dias", () => {
    expect(estagio(0).nome).toBe("Semente");
    expect(estagio(3).nome).toBe("Muda");
    expect(estagio(7)).toMatchObject({ nome: "Planta", proximo: 14 });
    expect(estagio(120).proximo).toBeUndefined();
  });
});
