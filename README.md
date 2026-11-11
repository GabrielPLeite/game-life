# Game Life

App pessoal de hábitos de saúde com gamificação. Funciona offline, instala no celular como um app e guarda os dados somente no aparelho.

**Abrir o app:** https://gabrielpleite.github.io/game-life/

## O que já existe

- Treino em duas etapas: checagem de glicose ao começar (com os limites que você configurou) e conclusão ao terminar
- Pausa legítima e descanso planejado, que mantêm a sequência
- Sequência com congelamentos (1 a cada 7 dias, máximo 2) e queda pela metade em vez de zerar
- Painel "se você não treinar hoje" com o que está em jogo
- Registro de glicose (o valor nunca muda o XP)
- Registro de água em um toque, com meta diária ajustável
- Hábitos: refeições com carboidrato estimado, caminhada pós-refeição, sono, peso e cintura, insulina aplicada (só registro, sem sugestão de dose)
- Jogo: missões semanais, chefe da semana, conquistas de consistência, recompensas reais por nível e plano progressivo de esteira com semana leve
- Análises: média, variação e % de medições no alvo, gráfico por dia, comparações (treino, caminhada, sono), revisão semanal
- Relatório para o médico (imprimir ou salvar em PDF), exportação em CSV e restauração de backup
- XP e níveis com regras visíveis no próprio app
- Backup dos dados em arquivo JSON

## Como está organizado

| Arquivo | O que faz |
| --- | --- |
| `src/regras.ts` | Regras do jogo (XP, sequência, checagem de glicose, níveis). Funções puras, com testes em `regras.test.ts` |
| `src/jogo.ts` | Missões, chefe, conquistas e plano de esteira. Testes em `jogo.test.ts` |
| `src/analises.ts` | Estatísticas de glicose, comparações e CSV |
| `src/resumo.ts` | Junta os registros do banco e aplica as regras. Testes em `resumo.test.ts` |
| `src/db.ts` | Banco de dados local (IndexedDB via Dexie) |
| `src/App.tsx` | A tela principal |
| `src/componentes/` | Cada cartão da tela (treino, água, glicose, configurações...) |
| `src/estilos.css` | Aparência |
| `.github/workflows/publicar.yml` | Publica o app no GitHub Pages a cada mudança |

## Rodar no computador

```
npm install
npm run dev     # abre o app em modo de desenvolvimento
npm test        # roda os testes das regras
npm run build   # gera a versão publicada
```

## Princípios

- O app não dá conselho médico nem sugere dose de medicação.
- O valor da glicose nunca soma nem tira pontos.
- Nenhum dado de saúde sai do aparelho.
