import type { Desenho } from "../sprites";

/**
 * Mostra um desenho do jogo em qualquer tamanho.
 * O conteúdo vem só de src/sprites.ts (texto fixo do próprio app), por isso pode ser inserido direto.
 */
export default function Sprite({ desenho, tamanho = 96, rotulo, className }: { desenho: Desenho; tamanho?: number; rotulo?: string; className?: string }) {
  return (
    <svg
      className={`sprite ${className ?? ""}`}
      width={tamanho}
      height={tamanho}
      viewBox="0 -3 64 67"
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      dangerouslySetInnerHTML={{ __html: desenho.svg }}
    />
  );
}
