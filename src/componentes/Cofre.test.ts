import { describe, expect, it } from "vitest";
import { gerarSenha } from "./Cofre";

describe("cofre", () => {
  it("gera senhas de 16 caracteres sem letras confusas e diferentes a cada vez", () => {
    const a = gerarSenha();
    expect(a).toHaveLength(16);
    expect(a).not.toMatch(/[0O1lI]/);
    expect(gerarSenha()).not.toBe(a);
  });
});
