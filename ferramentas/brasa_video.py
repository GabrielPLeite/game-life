#!/usr/bin/env python3
"""
Transforma um vídeo curto da Brasa em uma folha de quadros para o app.

Uso (precisa de ffmpeg, Pillow, numpy e scipy; rembg só se o fundo não for verde):
    python ferramentas/brasa_video.py idle.mp4 --nome idle --estagio 1 --loop
    python ferramentas/brasa_video.py pular.mp4 --nome comemorar --inicio 0.4 --fim 2.0

O que faz:
1. Tira os quadros do vídeo na taxa pedida (padrão 12 por segundo).
2. Remove o fundo: verde liso vira transparente (com limpeza do reflexo verde na borda).
   Se o fundo não for verde, usa o rembg (IA de recorte).
3. Recorta todos os quadros pela MESMA caixa (a união de onde a Brasa aparece), para ela não
   pular de lugar entre um quadro e outro. A câmera do vídeo precisa estar parada.
4. Grava uma grade de quadros em WebP em public/brasa/anim/e<estagio>/<nome>.webp
   e registra a animação em public/brasa/anim/animacoes.json.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "public" / "brasa" / "anim"


def extrair_quadros(video: Path, fps: float, inicio: float | None, fim: float | None, pasta: Path) -> list[Path]:
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    if inicio is not None:
        cmd += ["-ss", str(inicio)]
    if fim is not None:
        cmd += ["-to", str(fim)]
    cmd += ["-i", str(video), "-vf", f"fps={fps}", str(pasta / "q%04d.png")]
    subprocess.run(cmd, check=True)
    return sorted(pasta.glob("q*.png"))


def fundo_verde(img: np.ndarray) -> bool:
    """O fundo é verde se as bordas da imagem são quase todas verdes."""
    borda = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(int)
    r, g, b = borda[:, 0], borda[:, 1], borda[:, 2]
    return float(np.mean((g > 120) & (g > r + 50) & (g > b + 50))) > 0.8


def tirar_verde(img: np.ndarray) -> np.ndarray:
    """Chroma key: quanto mais verde que vermelho/azul, mais transparente. Tira o reflexo verde da borda."""
    f = img.astype(float)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    verdice = g - np.maximum(r, b)
    alfa = 1 - np.clip((verdice - 25) / 60, 0, 1)
    # Borda meio transparente: tira a parte do verde que se misturou (cor = fundo*(1-alfa) + Brasa*alfa).
    borda = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(float)
    fundo = np.median(borda, axis=0)
    a = np.maximum(alfa, 0.05)[..., None]
    rgb = (f - (1 - a) * fundo) / a
    # Reflexo verde que sobrar: nenhum pixel fica mais verde que o seu vermelho/azul (chama amarela continua amarela).
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]))
    return np.dstack([rgb, alfa * 255]).clip(0, 255).astype(np.uint8)


def tirar_fundo_ia(imgs: list[Image.Image]) -> list[np.ndarray]:
    from rembg import new_session, remove  # só carrega se precisar

    sessao = new_session("isnet-general-use")
    return [np.array(remove(i, session=sessao)) for i in imgs]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video", type=Path)
    p.add_argument("--nome", required=True, help="idle, piscar, feliz, comemorar, cansada, dormindo...")
    p.add_argument("--estagio", type=int, default=1)
    p.add_argument("--fps", type=float, default=12)
    p.add_argument("--inicio", type=float)
    p.add_argument("--fim", type=float)
    p.add_argument("--loop", action="store_true", help="repete sem parar (repouso, dormindo)")
    p.add_argument("--altura", type=int, default=320, help="altura de cada quadro em pixels")
    p.add_argument("--espelhar", action="store_true", help="vira o desenho para olhar para o outro lado")
    a = p.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        arquivos = extrair_quadros(a.video, a.fps, a.inicio, a.fim, Path(tmp))
        if not arquivos:
            raise SystemExit("Nenhum quadro saiu do vídeo.")
        imgs = [Image.open(f).convert("RGB") for f in arquivos]
        if fundo_verde(np.array(imgs[0])):
            quadros = [tirar_verde(np.array(i)) for i in imgs]
            metodo = "fundo verde"
        else:
            quadros = tirar_fundo_ia(imgs)
            metodo = "recorte por IA"

    # Mesma caixa para todos os quadros: a Brasa não pula de lugar.
    juntos = np.zeros(quadros[0].shape[:2], bool)
    for q in quadros:
        juntos |= q[..., 3] > 25
    ys, xs = np.where(juntos)
    folga = 8
    t, b = max(ys.min() - folga, 0), min(ys.max() + folga, juntos.shape[0])
    l, r = max(xs.min() - folga, 0), min(xs.max() + folga, juntos.shape[1])
    escala = a.altura / (b - t)
    larg, alt = round((r - l) * escala), a.altura

    # Grade de quadros (o WebP aceita no máximo 16383 px de lado).
    colunas = min(len(quadros), 16000 // larg)
    linhas = -(-len(quadros) // colunas)
    tira = Image.new("RGBA", (larg * colunas, alt * linhas))
    for i, q in enumerate(quadros):
        img = Image.fromarray(q[t:b, l:r], "RGBA").resize((larg, alt), Image.LANCZOS)
        if a.espelhar:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        tira.paste(img, ((i % colunas) * larg, (i // colunas) * alt))

    pasta = SAIDA / f"e{a.estagio}"
    pasta.mkdir(parents=True, exist_ok=True)
    tira.save(pasta / f"{a.nome}.webp", "WEBP", quality=80, method=6)

    indice = SAIDA / "animacoes.json"
    dados = json.loads(indice.read_text()) if indice.exists() else {}
    dados.setdefault(f"e{a.estagio}", {})[a.nome] = {
        "arquivo": f"e{a.estagio}/{a.nome}.webp",
        "quadros": len(quadros),
        "fps": a.fps,
        "loop": a.loop,
        "largura": larg,
        "altura": alt,
        "colunas": colunas,
        "linhas": linhas,
    }
    indice.write_text(json.dumps(dados, indent=2, ensure_ascii=False) + "\n")
    print(f"{a.nome}: {len(quadros)} quadros de {larg}x{alt} ({metodo}) -> {pasta / (a.nome + '.webp')}")


if __name__ == "__main__":
    main()
