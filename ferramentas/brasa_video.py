#!/usr/bin/env python3
"""
Transforma um vídeo curto da Brasa em uma folha de quadros para o app.

Uso (precisa de ffmpeg, Pillow, numpy e scipy; rembg só se o fundo não for liso):
    python ferramentas/brasa_video.py idle.mp4 --nome idle --estagio 1 --loop --achar-loop 3
    python ferramentas/brasa_video.py pular.mp4 --nome comemorar --inicio 0.4 --fim 2.0

O que faz:
1. Tira os quadros do vídeo na taxa pedida (padrão 12 por segundo; use --fps 24 para vídeos de 24).
2. Remove o fundo. Fundo liso e verde (qualquer tom de verde) vira transparente, com o verde
   misturado na borda separado da cor da Brasa. Se o fundo não for verde, usa o rembg (IA).
   Marcas no rodapé (marca d'água) são apagadas: pedaços isolados na faixa de baixo do quadro.
3. Com --achar-loop N, procura sozinho o trecho de pelo menos N segundos cujo fim emenda com o
   começo sem tranco (compara os quadros) e usa só ele.
4. Recorta todos os quadros pela MESMA caixa, e a caixa é a mesma para TODAS as animações do
   estágio (a primeira define, com folga em volta para pulos; fica salva em animacoes.json).
   Assim a Brasa não muda de tamanho nem de lugar quando o app troca de animação.
   A câmera do vídeo precisa estar parada e os vídeos devem ter o mesmo enquadramento.
5. Grava um vídeo WebM com transparência (padrão: leve e fluido) ou uma grade de quadros em WebP,
   em public/brasa/anim/e<estagio>/, e registra a animação em public/brasa/anim/animacoes.json.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

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


def cor_do_fundo(img: np.ndarray):
    """Cor do fundo (mediana das bordas) se ele for liso e esverdeado; senão None."""
    borda = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(float)
    fundo = np.median(borda, axis=0)
    liso = float(np.mean(np.abs(borda - fundo).max(axis=1) < 14)) > 0.85
    verdice = fundo[1] - max(fundo[0], fundo[2])
    return fundo if liso and verdice > 30 else None


def tirar_verde(img: np.ndarray, fundo: np.ndarray) -> np.ndarray:
    """
    Chroma key para qualquer tom de verde. Mede o quanto cada pixel é mais verde que vermelho/azul
    e compara com o fundo: pixel igual ao fundo = transparente; pixel com cor "sem verde"
    (laranja, marrom, creme) = opaco; no meio é borda, e a parte de verde misturada é separada.
    """
    f = img.astype(float)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    verdice = g - np.maximum(r, b)
    v_fundo = fundo[1] - max(fundo[0], fundo[2])
    # A Brasa nunca é mais verde que -25 nesta medida (a chama amarela chega perto disso).
    alfa = np.clip((v_fundo - verdice) / (v_fundo + 25), 0, 1)
    alfa = np.where(alfa < 0.06, 0, alfa)
    a = np.maximum(alfa, 0.08)[..., None]
    rgb = (f - (1 - a) * fundo) / a
    # Reflexo verde que sobrar: nenhum pixel fica mais verde que o seu vermelho/azul.
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]))
    return np.dstack([rgb, alfa * 255]).clip(0, 255).astype(np.uint8)


def tirar_fundo_ia(imgs: list[Image.Image]) -> list[np.ndarray]:
    from rembg import new_session, remove  # só carrega se precisar

    sessao = new_session("isnet-general-use")
    return [np.array(remove(i, session=sessao)) for i in imgs]


def limpar_rodape(q: np.ndarray, faixa: float = 0.12) -> np.ndarray:
    """Apaga pedaços soltos que ficam só na faixa de baixo do quadro (marca d'água de ferramentas grátis)."""
    mascara = q[..., 3] > 25
    rotulos, n = ndimage.label(ndimage.binary_dilation(mascara, iterations=6))
    corte = int(q.shape[0] * (1 - faixa))
    for i, sl in enumerate(ndimage.find_objects(rotulos), 1):
        if sl[0].start >= corte:
            q[..., 3][rotulos == i] = 0
    return q


def achar_loop(quadros: list[np.ndarray], minimo: int) -> tuple[int, int, float]:
    """
    Procura o trecho [i, j] com pelo menos `minimo` quadros em que o quadro seguinte ao último (que
    é o primeiro) parece continuar naturalmente: o último quadro se parece com o que vem ANTES do
    primeiro, e o penúltimo com o antepenúltimo. Devolve (i, j, custo); custo baixo = emenda boa.
    """
    pequenos = []
    for q in quadros:
        im = Image.fromarray(q, "RGBA")
        fundo = Image.new("RGBA", im.size, (128, 128, 128, 255))
        fundo.alpha_composite(im)
        pequenos.append(np.array(fundo.convert("RGB").resize((96, 96), Image.BILINEAR), dtype=np.float32).ravel())
    m = np.stack(pequenos)
    n = len(m)
    sq = (m**2).sum(1)
    d = np.sqrt(np.maximum(sq[:, None] + sq[None, :] - 2 * m @ m.T, 0)) / m.shape[1] ** 0.5
    melhor = (0, n - 1, 1e9)
    for i in range(2, n):
        for j in range(i + minimo - 1, n):
            custo = d[j, i - 1] + 0.5 * d[j - 1, i - 2]
            if custo < melhor[2]:
                melhor = (i, j, float(custo))
    return melhor


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video", type=Path)
    p.add_argument("--nome", required=True, help="idle, piscar, feliz, comemorar, cansada, dormindo...")
    p.add_argument("--estagio", type=int, default=1)
    p.add_argument("--fps", type=float, default=12)
    p.add_argument("--inicio", type=float)
    p.add_argument("--fim", type=float)
    p.add_argument("--loop", action="store_true", help="repete sem parar (repouso, dormindo)")
    p.add_argument("--achar-loop", type=float, metavar="SEGUNDOS", help="acha o melhor trecho de pelo menos N segundos que emenda sozinho")
    p.add_argument("--altura", type=int, default=320, help="altura de cada quadro em pixels")
    p.add_argument("--qualidade", type=int, default=80, help="qualidade do WebP (0 a 100)")
    p.add_argument("--vaievem", action="store_true", help="grava para frente e depois de volta (loop sem emenda, dobra o tamanho)")
    p.add_argument("--espelhar", action="store_true", help="vira o desenho para olhar para o outro lado")
    p.add_argument("--formato", choices=["webm", "webp"], default="webm", help="webm = vídeo com transparência (padrão); webp = grade de quadros")
    p.add_argument("--crf", type=int, default=34, help="qualidade do WebM: menor = melhor e maior (30 a 40 é o normal)")
    p.add_argument("--nova-caixa", action="store_true", help="recalcula a caixa de recorte do estágio (as outras animações precisam ser refeitas)")
    p.add_argument("--rodape", type=float, default=0.12, help="parte de baixo do quadro onde pedaços soltos (marca d'água) são apagados")
    a = p.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        arquivos = extrair_quadros(a.video, a.fps, a.inicio, a.fim, Path(tmp))
        if not arquivos:
            raise SystemExit("Nenhum quadro saiu do vídeo.")
        imgs = [Image.open(f).convert("RGB") for f in arquivos]
        fundo = cor_do_fundo(np.array(imgs[0]))
        if fundo is not None:
            quadros = [limpar_rodape(tirar_verde(np.array(i), fundo), a.rodape) for i in imgs]
            metodo = "fundo verde"
        else:
            quadros = [limpar_rodape(q, a.rodape) for q in tirar_fundo_ia(imgs)]
            metodo = "recorte por IA"

    aviso = ""
    if a.achar_loop:
        i, j, custo = achar_loop(quadros, round(a.achar_loop * a.fps))
        quadros = quadros[i : j + 1]
        aviso = f" | trecho {i / a.fps:.2f}s a {j / a.fps:.2f}s, custo da emenda {custo:.1f}"

    if a.vaievem:
        quadros = quadros + quadros[-2:0:-1]

    # Caixa de recorte do estágio, guardada em fração do quadro do vídeo (vale para vídeos de qualquer tamanho).
    indice = SAIDA / "animacoes.json"
    dados = json.loads(indice.read_text()) if indice.exists() else {}
    estagio = dados.setdefault(f"e{a.estagio}", {})
    alto_v, larg_v = quadros[0].shape[:2]
    juntos = np.zeros((alto_v, larg_v), bool)
    for q in quadros:
        juntos |= q[..., 3] > 25
    ys, xs = np.where(juntos)
    if "_caixa" not in estagio or a.nova_caixa:
        # Folga: 5% dos lados, 25% em cima (pulos e chama) e 4% embaixo.
        w, h = xs.max() - xs.min(), ys.max() - ys.min()
        estagio["_caixa"] = {
            "l": max(xs.min() - 0.05 * w, 0) / larg_v,
            "r": min(xs.max() + 0.05 * w, larg_v) / larg_v,
            "t": max(ys.min() - 0.25 * h, 0) / alto_v,
            "b": min(ys.max() + 0.04 * h, alto_v) / alto_v,
        }
        novo = " (caixa nova do estágio)"
    else:
        novo = ""
    c = estagio["_caixa"]
    l, r, t, b = round(c["l"] * larg_v), round(c["r"] * larg_v), round(c["t"] * alto_v), round(c["b"] * alto_v)
    fora = juntos.copy()
    fora[t:b, l:r] = False
    if fora.sum() > 40:
        print(f"ATENÇÃO: {int(fora.sum())} pixels da Brasa ficam fora da caixa do estágio (cortados). Use --nova-caixa se for de propósito.")
    escala = a.altura / (b - t)
    larg, alt = round((r - l) * escala) // 2 * 2, a.altura // 2 * 2  # medidas pares (exigência do vídeo)

    pasta = SAIDA / f"e{a.estagio}"
    pasta.mkdir(parents=True, exist_ok=True)
    recortes = []
    for q in quadros:
        img = Image.fromarray(q[t:b, l:r], "RGBA").resize((larg, alt), Image.LANCZOS)
        recortes.append(img.transpose(Image.FLIP_LEFT_RIGHT) if a.espelhar else img)

    extra = {}
    if a.formato == "webm":
        arquivo = f"e{a.estagio}/{a.nome}.webm"
        with tempfile.TemporaryDirectory() as tmp:
            for i, img in enumerate(recortes):
                img.save(Path(tmp) / f"f{i:04d}.png")
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(a.fps), "-i", str(Path(tmp) / "f%04d.png"),
                 "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", str(a.crf),
                 "-auto-alt-ref", "0", "-row-mt", "1", "-an", str(SAIDA / arquivo)],
                check=True,
            )
    else:
        arquivo = f"e{a.estagio}/{a.nome}.webp"
        # Grade de quadros (o WebP aceita no máximo 16383 px de lado).
        colunas = min(len(recortes), 16000 // larg)
        linhas = -(-len(recortes) // colunas)
        tira = Image.new("RGBA", (larg * colunas, alt * linhas))
        for i, img in enumerate(recortes):
            tira.paste(img, ((i % colunas) * larg, (i // colunas) * alt))
        tira.save(SAIDA / arquivo, "WEBP", quality=a.qualidade, method=6)
        extra = {"colunas": colunas, "linhas": linhas, "vaievem": False}

    estagio[a.nome] = {
        "arquivo": arquivo,
        "formato": a.formato,
        "quadros": len(recortes),
        "fps": a.fps,
        "loop": a.loop,
        "largura": larg,
        "altura": alt,
        **extra,
    }
    indice.write_text(json.dumps(dados, indent=2, ensure_ascii=False) + "\n")
    kb = (SAIDA / arquivo).stat().st_size // 1024
    print(f"{a.nome}: {len(recortes)} quadros de {larg}x{alt} ({metodo}, {a.formato}, {kb} KB){aviso}{novo} -> {SAIDA / arquivo}")


if __name__ == "__main__":
    main()
