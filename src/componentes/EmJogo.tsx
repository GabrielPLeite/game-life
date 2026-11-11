import type { Resumo } from "../resumo";

/** O que você perde se não treinar hoje. Some quando o dia já está garantido. */
export default function EmJogo({ resumo }: { resumo: Resumo }) {
  const { hoje, sequencia, emJogo } = resumo;

  if (hoje.garantido) {
    const motivo = hoje.situacao === "pausa" ? "Pausa legítima registrada" : hoje.situacao === "descanso" ? "Descanso planejado" : "Treino feito";
    return (
      <section className="aviso ok" aria-live="polite">
        <strong>Dia garantido.</strong> {motivo}. Sequência em {sequencia.atual} {sequencia.atual === 1 ? "dia" : "dias"}.
      </section>
    );
  }

  return (
    <section className="aviso perigo" aria-live="polite">
      <strong>Se você não treinar hoje:</strong>
      <ul>
        {sequencia.atual > 0 &&
          (emJogo.usaCongelamento ? (
            <li>gasta 1 congelamento para segurar a sequência de {sequencia.atual} dias</li>
          ) : (
            <li>
              a sequência cai de {sequencia.atual} para {emJogo.sequenciaDepois} {emJogo.sequenciaDepois === 1 ? "dia" : "dias"}
            </li>
          ))}
        <li>deixa {emJogo.xp} XP na mesa</li>
        {sequencia.atual > 0 && !emJogo.usaCongelamento && <li>a contagem para o próximo congelamento recomeça</li>}
      </ul>
      <p className="nota">Um treino já garante o dia. Glicose fora da faixa ou doença contam como pausa legítima.</p>
    </section>
  );
}
