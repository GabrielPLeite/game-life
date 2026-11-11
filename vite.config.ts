import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// O app é publicado em https://<usuario>.github.io/game-life/,
// por isso todos os caminhos partem de "/game-life/".
const base = "/game-life/";

// "process" existe no Node, onde este arquivo roda; a declaração evita depender de @types/node.
declare const process: { env: Record<string, string | undefined> };

// Identifica a versão publicada: data da publicação + início do código do commit.
// Aparece no rodapé do app, para você conferir se está com a versão mais nova.
const versao = `${new Date().toISOString().slice(0, 10)} · ${process.env.GITHUB_SHA?.slice(0, 7) ?? "local"}`;

export default defineConfig({
  base,
  define: { __VERSAO__: JSON.stringify(versao) },
  plugins: [
    react(),
    // Transforma o site em um app instalável que funciona sem internet.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Game Life",
        short_name: "Game Life",
        description: "Hábitos de saúde gamificados, com dados guardados só no seu celular.",
        lang: "pt-BR",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
