import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
// Letras do visual pergaminho, embutidas no app para funcionarem sem internet.
import "@fontsource/im-fell-english-sc/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-700.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/baloo-2/latin-700.css";
import "./estilos.css";

// Liga o modo offline e a atualização automática do app.
// O navegador só procura versão nova quando a página é aberta do zero. Um app instalado
// costuma ficar "dormindo" em segundo plano, então também procuramos ao voltar para a tela
// e a cada 30 minutos. Quando há versão nova, o app recarrega sozinho (registerType autoUpdate).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (!registro) return;
    const procurar = () => {
      if (navigator.onLine) void registro.update();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") procurar();
    });
    setInterval(procurar, 30 * 60 * 1000);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
