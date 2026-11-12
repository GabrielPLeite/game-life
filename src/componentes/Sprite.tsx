import type { Desenho } from "../sprites";

/** Desenha uma grade de pixels como SVG nítido, em qualquer tamanho. */
export default function Sprite({ desenho, tamanho = 96, rotulo, className }: { desenho: Desenho; tamanho?: number; rotulo?: string; className?: string }) {
  const largura = Math.max(...desenho.grade.map((l) => l.length));
  const altura = desenho.grade.length;
  const lado = Math.max(largura, altura);
  const dx = Math.floor((lado - largura) / 2);
  const dy = lado - altura; // encosta o desenho no chão
  return (
    <svg className={`sprite ${className ?? ""}`} width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      {desenho.grade.flatMap((linha, y) =>
        [...linha].map((letra, x) => (desenho.cores[letra] ? <rect key={`${x}-${y}`} x={x + dx} y={y + dy} width={1.02} height={1.02} fill={desenho.cores[letra]} /> : null)),
      )}
    </svg>
  );
}
