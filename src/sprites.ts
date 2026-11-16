// Arte do jogo em traço de iluminura: contorno de tinta e pigmentos chapados e sombrios.
// Cada figura é um desenho vetorial (SVG) escrito aqui mesmo, sem imagens externas,
// numa área de 64 x 64 com os pés perto da base. Por ser vetorial, fica nítido em qualquer tamanho.
import type { Classe } from "./rpg";

/** Um desenho pronto para o componente Sprite: o miolo de um SVG de 64 x 64. */
export interface Desenho { svg: string; }

const T = '#2b1d0e';
// Cores dos olhos e brilhos ficam vivas; o resto é escurecido e dessaturado para um clima mais sombrio.
const VIVAS = new Set(['#e8c39e', '#e0c23a', '#d43c2c', '#c0392b', '#5fd38a', '#5fd3e0', '#3fa7c9', '#e9f3f5', '#f4e8a8', '#c9a227', '#e9e3d2', '#f4e8c8', '#d9f5e3']);
const sombria = (hex: string) => {
  if (VIVAS.has(hex.toLowerCase()) || hex.length !== 7) return hex;
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const cinza = 0.3 * r + 0.59 * gg + 0.11 * b;
  return '#' + [r, gg, b].map((c) => Math.round((c + (cinza - c) * 0.3) * 0.72).toString(16).padStart(2, '0')).join('');
};
const g = (s: string) => `<g stroke="${T}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${s.replace(/(fill|stroke)="(#[0-9a-fA-F]{6})"/g, (_: string, a: string, c: string) => `${a}="${c === T ? c : sombria(c)}"`)}</g>`;
const FIGS: Record<string, string> = {
guerreiro: g(`
<ellipse cx="30" cy="59" rx="16" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M22 44v12h7V46M33 46v10h7V44z" fill="#5b4a3a"/>
<path d="M18 28c0-4 5-6 13-6s13 2 13 6l-2 18H20z" fill="#7a1f1f"/>
<path d="M31 27v14M26 32h10" stroke="#c9a227" stroke-width="2.5"/>
<path d="M20 44h22" stroke="#c9a227" stroke-width="3"/>
<circle cx="31" cy="15" r="8" fill="#e8c39e"/>
<path d="M22 15c0-7 4-10 9-10s9 3 9 10h-4l-5-3-5 3z" fill="#9aa3ad"/>
<path d="M31 5v13" stroke-width="2.500"/><path d="M26 15l4 1M36 15l-4 1" stroke-width="1.600"/><path d="M28.500 20h5" stroke-width="1.200"/>
<path d="M6 30c0-3 4-5 8-5s8 2 8 5v8c0 6-4 9-8 11-4-2-8-5-8-11z" fill="#2f4a6b"/>
<path d="M14 28v17M9 34h10" stroke="#e9d9b0" stroke-width="2"/>
<path d="M50 8v28" stroke-width="5" stroke="${T}"/><path d="M50 8v28" stroke-width="2.5" stroke="#dfe3e8"/>
<path d="M45 36h10M50 36v7" stroke-width="3"/><circle cx="50" cy="45" r="2" fill="#c9a227"/>
<path d="M42 30l7 6" stroke-width="5" stroke="${T}"/><path d="M42 30l7 6" stroke-width="2.5" stroke="#e8c39e"/>`),
slime: g(`
<ellipse cx="32" cy="59" rx="22" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M6 57c-2-7 2-12 7-17 4-4 5-10 9-14 3-3 6-1 7-6 1-4 4-4 5 0 1 5 5 3 8 7 4 5 4 9 8 13 5 5 9 10 7 17z" fill="#55702c"/>
<path d="M17 40c1-5 4-9 7-11" stroke="#a9bf6a" stroke-width="2.500" fill="none"/>
<path d="M24 46c0-6 3-9 8-9s8 3 8 9c0 3-2 4-3 5v3H27v-3c-1-1-3-2-3-5z" fill="#d6cfae" stroke-width="1.500"/>
<ellipse cx="29" cy="46" rx="1.800" ry="2.200" fill="${T}" stroke="none"/><ellipse cx="35" cy="46" rx="1.800" ry="2.200" fill="${T}" stroke="none"/>
<path d="M30 51v3M32 51v3M34 51v3" stroke-width="1"/>
<path d="M14 36l7 3-6 2zM50 36l-7 3 6 2z" fill="#e0c23a" stroke-width="1.200"/>
<path d="M12 57v-5M52 57v-6M44 57v-3" stroke="#3d5220" stroke-width="2"/>`),
morcego: g(`
<ellipse cx="32" cy="59" rx="12" ry="2.5" fill="#2b1d0e33" stroke="none"/>
<path d="M26 30C18 20 8 18 3 22c5 2 5 7 3 12 4-3 7-2 9 2 2-4 6-4 9-1z" fill="#5a3f6b"/>
<path d="M38 30c8-10 18-12 23-8-5 2-5 7-3 12-4-3-7-2-9 2-2-4-6-4-9-1z" fill="#5a3f6b"/>
<path d="M24 22l-2-9 7 5h6l7-5-2 9c3 3 3 12-2 16-3 3-9 3-12 0-5-4-5-13-2-16z" fill="#3f2b4d"/>
<path d="M25 25l5 2-4 2zM39 25l-5 2 4 2z" fill="#d43c2c" stroke-width="1"/>
<path d="M29 34l1.5 4 1.5-4 1.5 4 1.500-4" fill="#f4e8c8" stroke-width="1.2"/>`),
ogro: g(`
<ellipse cx="32" cy="60" rx="24" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M18 46v12h10V48M36 48v10h10V46z" fill="#5b4a3a"/>
<path d="M10 30c0-8 10-12 22-12s22 4 22 12l-4 20H14z" fill="#b8792d"/>
<path d="M18 42c4 6 24 6 28 0v8H18z" fill="#6b5a48"/>
<circle cx="26" cy="46" r="1.5" fill="#c9a227"/><circle cx="38" cy="46" r="1.5" fill="#c9a227"/>
<path d="M12 30l-6 14 5 3 6-12z" fill="#b8792d"/><path d="M52 30l5 10-5 4-5-10z" fill="#b8792d"/>
<path d="M56 6l4 4-6 32-5-1z" fill="#7a5a34"/>
<path d="M19 14c0-7 6-10 13-10s13 3 13 10-4 12-13 12-13-5-13-12z" fill="#c98a3a"/>
<path d="M17 10l-4-5 7 2M47 10l4-5-7 2" fill="#c98a3a"/>
<path d="M24 12l5 2M40 12l-5 2" /><circle cx="27" cy="15.500" r="1.3" fill="${T}" stroke="none"/><circle cx="37" cy="15.500" r="1.3" fill="${T}" stroke="none"/>
<path d="M25 21h14" /><path d="M27 21v-3M37 21v-3" stroke="#f4e8c8" stroke-width="2.5"/>`),
patrulheiro: g(`
<ellipse cx="30" cy="59" rx="16" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M22 44v12h7V46M33 46v10h7V44z" fill="#6b4a2a"/>
<path d="M18 28c0-4 5-6 13-6s13 2 13 6l-2 18H20z" fill="#2f5a1f"/>
<path d="M20 28l22 14" stroke="#6b4a2a" stroke-width="2.5"/>
<path d="M20 44h22" stroke="#6b4a2a" stroke-width="3"/>
<circle cx="31" cy="15" r="8" fill="#e8c39e"/>
<path d="M21 17c0-9 4-13 10-13s10 4 10 13l-4-4h-12z" fill="#3f6b2a"/>
<path d="M36 6l8-3-4 7" fill="#7a1f1f"/>
<path d="M26 15l4 1M36 15l-4 1" stroke-width="1.600"/><path d="M28.500 20h5" stroke-width="1.200"/>
<path d="M52 8c8 10 8 30 0 40" fill="none" stroke-width="4" stroke="${T}"/><path d="M52 8c8 10 8 30 0 40" fill="none" stroke="#a9773a" stroke-width="2"/>
<path d="M52 8v40" stroke-width="1"/>
<path d="M42 30l10-2" stroke-width="5" stroke="${T}"/><path d="M42 30l10-2" stroke-width="2.5" stroke="#e8c39e"/>
<path d="M10 24l4 14" stroke-width="5" stroke="${T}"/><path d="M10 24l4 14" stroke-width="2.5" stroke="#a9773a"/>
<path d="M8 22l2-4 3 3M11 20l2-4 3 4" fill="#c9a227" stroke-width="1.2"/>`),
clerigo: g(`
<ellipse cx="30" cy="59" rx="16" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M17 30c0-5 6-8 14-8s14 3 14 8l3 27H14z" fill="#f4e8c8"/>
<path d="M31 24v33" stroke="#c9a227" stroke-width="3"/>
<path d="M22 40h18" stroke="#c9a227" stroke-width="3"/>
<circle cx="31" cy="15" r="8" fill="#e8c39e"/>
<path d="M23 12c1-5 4-7 8-7s7 2 8 7c-5-2-11-2-16 0z" fill="#d8b25a"/>
<ellipse cx="31" cy="3.500" rx="7" ry="2" fill="none" stroke="#c9a227"/>
<path d="M26 15l4 1M36 15l-4 1" stroke-width="1.600"/><path d="M28.500 20h5" stroke-width="1.200"/>

<path d="M52 16v42" stroke-width="5" stroke="${T}"/><path d="M52 16v42" stroke-width="2.5" stroke="#a9773a"/>
<circle cx="52" cy="11" r="5.500" fill="#c9a227"/><path d="M52 7v8M48 11h8" stroke-width="1.5"/>
<path d="M44 32l8 2" stroke-width="5" stroke="${T}"/><path d="M44 32l8 2" stroke-width="2.5" stroke="#e8c39e"/>`),
mago: g(`
<ellipse cx="30" cy="59" rx="16" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M17 30c0-5 6-8 14-8s14 3 14 8l3 27H14z" fill="#4a2f6b"/>
<path d="M22 44l3 3 3-3 3 3 3-3 3 3 3-3" fill="none" stroke="#c9a227"/>
<circle cx="31" cy="17" r="7.500" fill="#e8c39e"/>
<path d="M25 21c1 9 3 13 6 15 3-2 5-6 6-15-4 2-8 2-12 0z" fill="#e9e3d2"/>
<path d="M17 13h28l-5-3L33 0l-9 10z" fill="#4a2f6b"/>
<path d="M24 10h16" stroke="#c9a227" stroke-width="2.5"/>
<path d="M26 15l4 1M36 15l-4 1" stroke-width="1.600"/><path d="M28.500 20h5" stroke-width="1.200"/>
<path d="M52 14v44" stroke-width="5" stroke="${T}"/><path d="M52 14v44" stroke-width="2.5" stroke="#6b4a2a"/>
<path d="M52 3l5 6-5 6-5-6z" fill="#3fa7c9"/>
<path d="M44 32l8 2" stroke-width="5" stroke="${T}"/><path d="M44 32l8 2" stroke-width="2.5" stroke="#e8c39e"/>`),
goblin: g(`
<ellipse cx="32" cy="59" rx="15" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M24 46l-2 11h6l1-9M35 48l1 9h6l-2-11z" fill="#5d7430"/>
<path d="M19 36c1-5 6-7 13-7s12 2 13 7l-3 14H22z" fill="#4a3a26"/>
<path d="M22 44h20" stroke="${T}" stroke-width="3"/><path d="M26 31l2 6 3-5 3 5 3-6" fill="none" stroke-width="1.300"/>
<path d="M20 20L4 10l10 15zM44 20l16-10-10 15z" fill="#5d7430"/>
<path d="M18 21c0-8 6-12 14-12s14 4 14 12c0 5-5 10-14 12-9-2-14-7-14-12z" fill="#6b8536"/>
<path d="M21 17l9 4-7 2zM43 17l-9 4 7 2z" fill="#e0c23a" stroke-width="1.200"/>
<path d="M30 22l2 5 2-5" fill="none" stroke-width="1.300"/>
<path d="M25 28h14l-2 2H27z" fill="${T}"/><path d="M27 28l1 2.500 1-2.500M35 28l1 2.500 1-2.500" fill="#e9e3d2" stroke-width=".800"/>
<path d="M44 38l8 3" stroke-width="5" stroke="${T}"/><path d="M44 38l8 3" stroke-width="2.500" stroke="#6b8536"/>
<path d="M53 22l3 4-3 17-3-1z" fill="#8f979f"/><path d="M48 42h8" stroke-width="2.500"/>`),
aranha: g(`
<ellipse cx="32" cy="59" rx="20" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M22 34L8 24l-5 16M22 40L8 36l-3 18M24 44l-10 4 0 10M42 34l14-10 5 16M42 40l14-4 3 18M40 44l10 4 0 10" fill="none" stroke-width="2.5"/>
<ellipse cx="32" cy="28" rx="13" ry="12" fill="#3d3a4a"/>
<path d="M32 18l4 7-4 7-4-7z" fill="#7a1f1f"/>
<ellipse cx="32" cy="45" rx="9" ry="7.500" fill="#4d4a5c"/>
<circle cx="28" cy="43" r="2" fill="#c0392b"/><circle cx="36" cy="43" r="2" fill="#c0392b"/>
<circle cx="24" cy="46.500" r="1.200" fill="#c0392b" stroke-width="1"/><circle cx="40" cy="46.500" r="1.200" fill="#c0392b" stroke-width="1"/>
<path d="M29 51l1 4M35 51l-1 4" stroke="#f4e8c8" stroke-width="2"/>`),
esqueleto: g(`
<ellipse cx="30" cy="59" rx="15" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M26 44v13h-3M36 44v13h3" fill="none" stroke-width="5" stroke="${T}"/><path d="M26 44v13h-3M36 44v13h3" fill="none" stroke="#ece4cf" stroke-width="2.5"/>
<path d="M22 26h18l-2 18H24z" fill="#ece4cf"/>
<path d="M24 31h14M24.500 35.500h13M25 40h12M31 26v18" stroke-width="1.3"/>
<path d="M22 28l-7 12" stroke-width="5" stroke="${T}"/><path d="M22 28l-7 12" stroke-width="2.5" stroke="#ece4cf"/>
<path d="M21 14c0-7 4-10 10-10s10 3 10 10c0 4-2 6-4 7v4H25v-4c-2-1-4-3-4-7z" fill="#ece4cf"/>
<ellipse cx="27" cy="14" rx="2.500" ry="3" fill="${T}" stroke="none"/><ellipse cx="35" cy="14" rx="2.500" ry="3" fill="${T}" stroke="none"/>
<path d="M30 19l1-2 1 2zM28 22v3M31 22v3M34 22v3" stroke-width="1.2"/>
<path d="M40 28l9 6" stroke-width="5" stroke="${T}"/><path d="M40 28l9 6" stroke-width="2.5" stroke="#ece4cf"/>
<path d="M50 6v30" stroke-width="5" stroke="${T}"/><path d="M50 6v30" stroke-width="2.5" stroke="#9aa3ad"/><path d="M45 36h10" stroke-width="3"/>
<path d="M4 34c0-3 4-5 9-5s9 2 9 5v6c0 5-4 8-9 10-5-2-9-5-9-10z" fill="#6b5a48"/><circle cx="13" cy="38" r="2.500" fill="#9aa3ad"/>`),
lobo: g(`
<ellipse cx="32" cy="59" rx="22" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M10 38c-5-2-7-8-5-12 2 4 5 5 8 5z" fill="#7d7f86"/>
<path d="M14 44v13h5v-9M24 48v9h5v-9M36 48v9h5v-9M44 46v11h5V44z" fill="#6b6d74"/>
<path d="M10 34c2-6 10-8 20-8s16 0 20 4l2 14c-6 5-34 6-40 0z" fill="#8b8d94"/>
<path d="M40 22l2-11 6 7 6-5 1 10c5 3 7 8 6 12l-9 3c-6 0-10-3-12-7z" fill="#9b9da4"/>
<path d="M52 36l9-1" stroke-width="1.500"/><circle cx="60" cy="33" r="1.500" fill="${T}" stroke="none"/>
<path d="M47 24l5 2" /><circle cx="50" cy="27.500" r="1.500" fill="#c9a227" stroke-width="1"/>
<path d="M50 37l1 3 1.500-3 1.500 3 1.500-3" fill="#f4e8c8" stroke-width="1.200"/>
<path d="M18 30l3 4 3-4 3 4" fill="none" stroke-width="1.300"/>`),
fantasma: g(`
<ellipse cx="32" cy="60" rx="12" ry="2.500" fill="#2b1d0e22" stroke="none"/>
<path d="M16 58l2-10-5 3 2-9-4-14C9 14 20 5 32 5s23 9 21 23l-4 14 2 9-5-3 2 10-6-6-4 7-4-7-4 7-4-7-4 7-3-7z" fill="#b9bcc4"/>
<path d="M20 28c0-9 5-15 12-15s12 6 12 15c0 6-5 12-12 12s-12-6-12-12z" fill="#2a2433"/>
<path d="M24 24l6 3-5 3zM40 24l-6 3 5 3z" fill="#e9f3f5" stroke-width="1"/>
<path d="M28 34h8l-1 3h-6z" fill="${T}" stroke-width="1"/>
<path d="M13 30L5 42l5-1-3 9 9-9M51 30l8 12-5-1 3 9-9-9" fill="#b9bcc4"/>
<path d="M24 46v6M32 44v8M40 46v6" stroke="#8a8d96" stroke-width="1.500"/>`),
orc: g(`
<ellipse cx="32" cy="59" rx="20" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M20 44v13h8V46M36 46v11h8V44z" fill="#4d4a44"/>
<path d="M12 28c0-6 9-9 20-9s20 3 20 9l-4 20H16z" fill="#5a5148"/>
<path d="M16 44h32" stroke="#7a1f1f" stroke-width="3"/><path d="M20 24l24 18M44 24L20 42" stroke="#3b332b" stroke-width="2"/>
<path d="M14 28l-6 14 6 3 5-12z" fill="#6f8a3a"/><path d="M50 28l6 10-5 5-5-10z" fill="#6f8a3a"/>
<path d="M19 14c0-7 6-10 13-10s13 3 13 10-5 11-13 11-13-4-13-11z" fill="#7d9a3c"/>
<path d="M24 11l5 2M40 11l-5 2"/><circle cx="27" cy="14.500" r="1.300" fill="#c0392b" stroke="none"/><circle cx="37" cy="14.500" r="1.300" fill="#c0392b" stroke="none"/>
<path d="M25 20h14"/><path d="M26.500 20v-4M37.500 20v-4" stroke="#f4e8c8" stroke-width="2.500"/>
<path d="M56 12v32" stroke-width="5" stroke="${T}"/><path d="M56 12v32" stroke-width="2.500" stroke="#6b4a2a"/>
<path d="M56 8c6 0 8 4 8 8s-2 7-8 7z" fill="#9aa3ad"/>`),
lich: g(`
<ellipse cx="30" cy="60" rx="20" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M12 32c0-7 8-10 18-10s18 3 18 10l4 26H8z" fill="#3b2a55"/>
<path d="M30 24v34" stroke="#2a1d3f" stroke-width="2"/>
<path d="M14 40l-6 10 5 2M46 40l5 4" fill="none" stroke-width="5" stroke="${T}"/><path d="M14 40l-6 10 5 2M46 40l5 4" fill="none" stroke="#3b2a55" stroke-width="2.500"/>
<path d="M19 16c0-7 5-10 11-10s11 3 11 10c0 4-2 6-4 7v4H23v-4c-2-1-4-3-4-7z" fill="#ece4cf"/>
<ellipse cx="26" cy="16" rx="2.500" ry="3" fill="${T}" stroke="none"/><ellipse cx="34" cy="16" rx="2.500" ry="3" fill="${T}" stroke="none"/>
<circle cx="26" cy="16.500" r="1.200" fill="#5fd38a" stroke="none"/><circle cx="34" cy="16.500" r="1.200" fill="#5fd38a" stroke="none"/>
<path d="M27 23v3M30 23v3M33 23v3" stroke-width="1.200"/>
<path d="M19 9l2-7 4 4 5-5 5 5 4-4 2 7z" fill="#c9a227"/><circle cx="30" cy="6.500" r="1.300" fill="#c0392b" stroke-width="1"/>
<path d="M54 14v46" stroke-width="5" stroke="${T}"/><path d="M54 14v46" stroke-width="2.500" stroke="#6b4a2a"/>
<circle cx="54" cy="9" r="5.500" fill="#5fd38a"/><circle cx="52.500" cy="7.500" r="1.500" fill="#d9f5e3" stroke="none"/>`),
dragao: g(`
<ellipse cx="32" cy="60" rx="24" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M22 30C12 18 6 18 2 22c4 2 4 6 3 10 3-2 6-1 7 2 2-3 5-3 8-1z" fill="#8a2a22"/>
<path d="M42 30c10-12 16-12 20-8-4 2-4 6-3 10-3-2-6-1-7 2-2-3-5-3-8-1z" fill="#8a2a22"/>
<path d="M18 50c-8 2-12-2-14-8 4 4 8 3 12 2z" fill="#a8332a"/>
<path d="M18 46v11h7v-6M39 51v6h7V46z" fill="#8a2a22"/>
<path d="M16 38c0-8 7-12 16-12s16 4 16 12-4 16-16 16-16-8-16-16z" fill="#a8332a"/>
<path d="M24 36c0-4 4-6 8-6s8 2 8 6-2 14-8 14-8-10-8-14z" fill="#e0b24a"/>
<path d="M26 38h12M26.500 42h11M28 46h8" stroke-width="1.200"/>
<path d="M22 12l-5-8 9 4M42 12l5-8-9 4" fill="#e0b24a"/>
<path d="M20 16c0-6 5-9 12-9s12 3 12 9c0 4-2 6-4 8l-2 5H26l-2-5c-2-2-4-4-4-8z" fill="#b83a2e"/>
<path d="M25 14l4 2M39 14l-4 2"/><circle cx="27.500" cy="17" r="1.300" fill="#f4e8a8" stroke-width="1"/><circle cx="36.500" cy="17" r="1.300" fill="#f4e8a8" stroke-width="1"/>
<circle cx="30" cy="25" r=".800" fill="${T}" stroke="none"/><circle cx="34" cy="25" r=".800" fill="${T}" stroke="none"/>`),
golem: g(`
<ellipse cx="32" cy="60" rx="24" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M18 44h10v14H16zM36 44h10l2 14H36z" fill="#8a8378"/>
<path d="M14 20h36l4 26H10z" fill="#a39c8f"/>
<path d="M4 22h10l2 22H4zM50 22h10v22H48z" fill="#8a8378"/>
<path d="M22 4h20l2 16H20z" fill="#b5ae9f"/>
<path d="M25 11h5v4h-5zM34 11h5v4h-5z" fill="#3fa7c9"/>
<path d="M32 28l5 6-5 6-5-6z" fill="#3fa7c9"/>
<path d="M18 24l6 4-3 6M44 40l-5-3 2-5M26 6l3 3M8 30l4 2M54 28l-3 4" fill="none" stroke-width="1.300"/>
<path d="M27 17h10" stroke-width="1.500"/>`),
espectro: g(`
<ellipse cx="32" cy="60" rx="15" ry="2.500" fill="#2b1d0e22" stroke="none"/>
<path d="M12 56V26C12 13 21 5 32 5s20 8 20 21v30l-5-6-5 6-5-6-5 6-5-6-5 6-5-6z" fill="#3b2a55"/>
<path d="M19 30c0-10 5-17 13-17s13 7 13 17c0 5-6 8-13 8s-13-3-13-8z" fill="#1d1430"/>
<path d="M24 26l6 2-6 3zM40 26l-6 2 6 3z" fill="#5fd3e0" stroke-width="1"/>
<path d="M12 34L4 44l6 0-2 8 8-8M52 34l8 10-6 0 2 8-8-8" fill="#3b2a55"/>
<circle cx="50" cy="12" r="5" fill="#f4e8c8"/><path d="M50 9v3l2 1.500" stroke-width="1.200" fill="none"/>
<path d="M47 6l-2-2M53 6l2-2" stroke-width="1.500"/>`),
hidra: g(`
<ellipse cx="32" cy="60" rx="24" ry="3" fill="#2b1d0e33" stroke="none"/>
<path d="M14 58c-4-10 2-18 18-18s22 8 18 18z" fill="#2f7a6b"/>
<path d="M20 46C12 38 8 28 12 18" fill="none" stroke-width="10" stroke="${T}"/><path d="M20 46C12 38 8 28 12 18" fill="none" stroke="#2f7a6b" stroke-width="6.500"/>
<path d="M44 46c8-8 12-18 8-28" fill="none" stroke-width="10" stroke="${T}"/><path d="M44 46c8-8 12-18 8-28" fill="none" stroke="#2f7a6b" stroke-width="6.500"/>
<path d="M32 44V16" fill="none" stroke-width="10" stroke="${T}"/><path d="M32 44V16" fill="none" stroke="#3a8f7d" stroke-width="6.500"/>
<path d="M5 14c0-5 4-8 8-8s8 3 8 8-3 7-8 7-8-2-8-7z" fill="#3a8f7d"/>
<path d="M43 14c0-5 4-8 8-8s8 3 8 8-3 7-8 7-8-2-8-7z" fill="#3a8f7d"/>
<path d="M23 10c0-6 4-9 9-9s9 3 9 9-4 8-9 8-9-2-9-8z" fill="#45a590"/>
<path d="M7 10l5 2-4 2zM19 10l-5 2 4 2zM45 10l5 2-4 2zM57 10l-5 2 4 2zM26 6l5 2.500-4 2zM38 6l-5 2.500 4 2z" fill="#e0c23a" stroke-width="1"/>
<path d="M9 17h8M47 17h8M27 14h10" stroke-width="1.500"/>
<path d="M10 17l1 3 1-3M14 17l1 3 1-3M48 17l1 3 1-3M52 17l1 3 1-3M29 14l1 3.500 1-3.500M33 14l1 3.500 1-3.500" fill="#e9e3d2" stroke-width=".800"/>
<path d="M32 1l-2-3M32 1l2-3M13 6l-2-4M51 6l2-4" stroke-width="1.500"/>
<path d="M24 52h16M26 56h12" stroke="#bfe0c8" stroke-width="1.500"/>`),
};

const d = (id: string): Desenho => ({ svg: FIGS[id] });

export function desenhoDoHeroi(classe: Classe): Desenho {
  return d(classe);
}

export const INIMIGOS_ARTE: Record<string, Desenho> = Object.fromEntries(["slime", "morcego", "goblin", "aranha", "esqueleto", "lobo", "fantasma", "orc"].map((id) => [id, d(id)]));

export const CHEFES_ARTE: Record<string, Desenho> = Object.fromEntries(["ogro", "lich", "dragao", "golem", "espectro", "hidra"].map((id) => [id, d(id)]));
