# Brasa no PC

Programa do Windows que deixa a Brasa sentada em cima da barra de tarefas, sempre por cima das outras janelas, sem navegador.

## Instalar
Dê dois cliques em `instalar.bat` (ou rode `instalar.ps1` no PowerShell). Ele compila o `BrasaPC.cs` com o compilador que já vem no Windows (.NET Framework 4), copia tudo para `%LOCALAPPDATA%\BrasaPC` e cria o atalho "Brasa" na Área de Trabalho e em Inicializar (abre junto com o Windows).

## Usar
- **Clique:** carinho. Na hora da refeição (5-11h, 11-15h, 17-22h) ela pede comida; o clique abre o Game Life e ela para de pedir até a próxima refeição.
- **Clique duplo:** abre o Game Life.
- **Arrastar:** muda de lugar; perto da barra de tarefas, gruda em cima dela.
- **Botão direito** (nela ou no ícone perto do relógio): tamanho dela no jogo (estágio), tamanho na tela, esconder por 1 hora, fechar.
- Das 23h às 5h ela dorme.

O programa não usa internet: só abre o endereço do Game Life quando você pede. Configurações ficam em `%LOCALAPPDATA%\BrasaPC\config.txt`.

## Desinstalar
Rode `desinstalar.ps1`.
