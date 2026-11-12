// Arte em pixel do jogo. Cada desenho é uma grade de letras: cada letra é um quadradinho
// de uma cor da paleta, e "." é transparente. Tudo original e desenhado aqui, sem imagens externas.
import type { Classe } from "./rpg";

export interface Desenho { grade: string[]; cores: Record<string, string>; }

const PELE = "#f2c9a0";
const OLHO = "#1e1b2e";

const CORPO = [
  "..aaAAAAaa.w",
  ".aaaAAAAaaaw",
  ".s.aAAAAa.sw",
  ".s.abbbba.sw",
  "...aaaaaa..w",
  "...ll..ll...",
  "...ll..ll...",
  "..ccc..ccc..",
];

const CABECAS: Record<Classe, string[]> = {
  guerreiro: ["...........o", "....hhhh...w", "...hhhhhh..w", "...skssks..w", "....ssss...w"],
  patrulheiro: ["...........o", "....hhhh...w", "...hhhhhh..w", "..hskssksh.w", "..h.ssss.h.w"],
  clerigo: ["....yyyy..ooo", "..........ooo", "....hhhh...w", "...skssks..w", "....ssss...w"],
  mago: [".....hh....o", "....hhhh..ooo", "..hhhhhhhh.o", "...skssks..w", "....ssss...w"],
};

const PALETAS: Record<Classe, Record<string, string>> = {
  guerreiro: { h: "#9ca3af", A: "#cbd5e1", a: "#64748b", b: "#92400e", l: "#475569", c: "#78350f", w: "#e2e8f0", o: "#f8fafc" },
  patrulheiro: { h: "#15803d", A: "#4ade80", a: "#166534", b: "#78350f", l: "#713f12", c: "#422006", w: "#a16207", o: "#fde68a" },
  clerigo: { h: "#fde68a", A: "#f8fafc", a: "#cbd5e1", b: "#facc15", l: "#94a3b8", c: "#78350f", w: "#a16207", o: "#facc15", y: "#fde047" },
  mago: { h: "#6d28d9", A: "#8b5cf6", a: "#5b21b6", b: "#facc15", l: "#4c1d95", c: "#1e1b4b", w: "#a16207", o: "#38bdf8" },
};

export function desenhoDoHeroi(classe: Classe): Desenho {
  return { grade: [...CABECAS[classe], ...CORPO], cores: { s: PELE, k: OLHO, ...PALETAS[classe] } };
}

export const INIMIGOS_ARTE: Record<string, Desenho> = {
  slime: {
    cores: { g: "#4ade80", G: "#bbf7d0", k: OLHO, m: "#166534" },
    grade: ["............", "............", "....gggg....", "...gGGggg...", "..gGGggggg..", ".ggkgggkggg.", ".ggkgggkggg.", ".gggggggggg.", ".ggggmmgggg.", ".gggggggggg.", "..gggggggg.."],
  },
  morcego: {
    cores: { p: "#7c3aed", r: "#f87171", w: "#f8fafc" },
    grade: ["............", "p....pp....p", "pp..pppp..pp", "ppp.pppp.ppp", "pppprpprpppp", "pppppppppppp", ".pp.pppp.pp.", ".p..pwwp..p.", ".....pp.....", "............"],
  },
  goblin: {
    cores: { g: "#84cc16", k: OLHO, w: "#f8fafc", b: "#92400e", s: "#cbd5e1", t: "#78350f" },
    grade: ["............", ".g..gggg..g.", ".gggggggggg.", "..ggkggkgg..", "...gggggg..s", "...gwwwwg..s", "..bbbbbbbb.s", ".gbbbbbbbbgs", ".g.bbbbbb.gt", "...bb..bb...", "...gg..gg...", "..ggg..ggg.."],
  },
  aranha: {
    cores: { d: "#475569", r: "#f87171", w: "#f8fafc" },
    grade: ["............", "d..d....d..d", ".d..dddd..d.", "..dddddddd..", "dddrddddrddd", "..dddddddd..", ".d.dddddd.d.", "d..dwddwd..d", "...d....d...", "............"],
  },
  esqueleto: {
    cores: { w: "#e2e8f0", k: OLHO, s: "#94a3b8", t: "#78350f" },
    grade: ["....wwww....", "...wwwwww...", "...wkwwkw...", "...wwwwww...", "....wkkw....", ".....ww....s", "..wwwwwwww.s", "..w.wwww.w.s", "..w.w..w.wws", "....wwww...t", "....w..w....", "...ww..ww..."],
  },
  lobo: {
    cores: { c: "#94a3b8", r: "#f87171", w: "#f8fafc", k: OLHO },
    grade: ["............", ".........c.c", "........cccc", "..c....ccrcc", ".cc.cccccccw", ".cccccccccc.", ".cccccccc...", "..ccccccc...", "..cc...cc...", "..c.....c...", "..c.....c..."],
  },
  fantasma: {
    cores: { f: "#e0e7ff", k: "#312e81" },
    grade: ["....ffff....", "...ffffff...", "..ffffffff..", "..fkkffkkf..", "..fkkffkkf..", "..ffffffff..", "..fffkkfff..", "..ffffffff..", "..ffffffff..", "..ffffffff..", "..f.ff.ff.f."],
  },
  orc: {
    cores: { o: "#65a30d", k: OLHO, w: "#f8fafc", b: "#57534e" },
    grade: ["...oooooo...", "..oooooooo..", "..okkookko..", "..oooooooo..", "..owoooowo..", "...oooooo...", ".bbbbbbbbbb.", "obbbbbbbbbbo", "oo.bbbbbb.oo", "oo.bbbbbb.oo", "...bb..bb...", "..ooo..ooo.."],
  },
};

export const CHEFES_ARTE: Record<string, Desenho> = {
  ogro: {
    cores: { o: "#d97706", k: OLHO, w: "#f8fafc", m: "#7c2d12", b: "#57534e", y: "#facc15" },
    grade: ["....oooooo....", "...oooooooo...", "..ookkookkoo..", "..oooooooooo..", "..oowoooowoo..", "...oommmmoo...", ".oooooooooooo.", "ooobbbbbbbbooo", "oo.bbbbbbbb.oo", "oo.bbybbybb.oo", "oo.bbbbbbbb.oo", "...bbb..bbb...", "...ooo..ooo...", "..oooo..oooo.."],
  },
  lich: {
    cores: { y: "#facc15", r: "#f87171", w: "#e2e8f0", g: "#4ade80", k: OLHO, p: "#6d28d9", s: "#a16207", o: "#4ade80" },
    grade: ["....yyyyyy....", "....yryyry....", "....wwwwww....", "...wwwwwwww...", "...wggwwggw...", "...wwwwwwww...", "....wkwkww...o", ".pppppppppp..s", "pppppppppppp.s", "pp.pppppp.ppws", "ww.pppppp....s", "...pppppp....s", "..pppppppp...s", ".pppppppppp..."],
  },
  dragao: {
    cores: { r: "#ef4444", y: "#fde047", k: OLHO, w: "#f8fafc" },
    grade: [".r..........r.", ".rr..rrrr..rr.", "rrr.rrrrrr.rrr", "rrr.ryrryr.rrr", "rrrrrrrrrrrrrr", "rrr.rrkkrr.rrr", "rr..rwrrwr..rr", "r..rrrrrrrr..r", "...rryyyyrr...", "...rryyyyrr...", "...rryyyyrr...", "..rrr.yy.rrr..", "..rr......rr..", ".www......www."],
  },
  golem: {
    cores: { s: "#a8a29e", S: "#57534e", g: "#38bdf8", k: OLHO, c: "#38bdf8" },
    grade: ["...ssssssss...", "...sggssggs...", "...ssssssss...", "...sskkkkss...", ".ssssssssssss.", "sssSSssssSSsss", "sss.ssssss.sss", "sss.ssccss.sss", "sss.ssssss.sss", "SSS.ssssss.SSS", "....sss.sss...", "....sss.sss...", "...ssss.ssss.."],
  },
  espectro: {
    cores: { v: "#a78bfa", c: "#22d3ee", k: "#1e1b4b" },
    grade: ["....vvvvvv....", "...vvvvvvvv...", "..vvvvvvvvvv..", "..vvccvvccvv..", "..vvccvvccvv..", "..vvvvvvvvvv..", ".vvvvvkkvvvvv.", "vvvvvvkkvvvvvv", "vv.vvvvvvvv.vv", "v..vvvvvvvv..v", "...vvvvvvvv...", "...vv.vv.vv...", "...v..v...v..."],
  },
  hidra: {
    cores: { g: "#14b8a6", y: "#fde047", l: "#99f6e4" },
    grade: [".gg...gg...gg.", "gygg.gygg.gygg", "gggg.gggg.gggg", ".gg...gg...gg.", ".gg...gg...gg.", ".ggg..gg..ggg.", "..ggg.gg.ggg..", "...gggggggg...", "..gggggggggg..", "..ggllllllgg..", "..ggllllllgg..", "..gggggggggg..", ".ggg......ggg."],
  },
};
