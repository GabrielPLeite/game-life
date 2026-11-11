# Game Life

App pessoal de hábitos de saúde com gamificação. Funciona offline, instala no celular como um app e guarda os dados somente no aparelho.

**Abrir o app:** https://gabrielpleite.github.io/game-life/

## O que já existe

- Registro de água em um toque (+250 ml e +500 ml), com meta diária ajustável
- XP e níveis com regras visíveis no próprio app
- Backup dos dados em arquivo JSON

## Como está organizado

| Arquivo | O que faz |
| --- | --- |
| `src/regras.ts` | Regras do jogo (XP, níveis, virada do dia). Funções puras, com testes em `regras.test.ts` |
| `src/db.ts` | Banco de dados local (IndexedDB via Dexie) |
| `src/App.tsx` | A tela do app |
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
