---
name: farol-daily-ui
description: Fazer a tela do desafio Daily UI do dia no Farol, com as decisões de UX numeradas, legenda e exportação. Use quando pedirem o Daily UI de hoje ou de um dia específico.
---

# Daily UI no Farol

Siga `prompts/daily-ui.md` (é a rotina oficial). Resumo:
1. `node engine/dailyui/dia.js hoje` diz o número e o tema. Fim de semana, dia 0 ou maior que 100: pare.
2. Escreva `engine/dailyui/dias/NNN.js` no formato de `engine/dailyui/dias/001.js`, usando a skill `farol-marca`.
3. Mostre a tela de verdade (celular ou janela) e as "DECISÕES DE UX" numeradas: hierarquia, estados (foco, erro, vazio, carregando), acessibilidade (AA, foco visível, alvos de 44 px) e microcopy.
4. Legenda com a skill `farol-legendas`, começando com "Daily UI NNN · <Tema>".
5. `node engine/dailyui/dia.js N` e `node engine/exportar-png.js dailyui NNN`; confira o PNG.
6. Não publique. Termine com "Pronto para aprovação no Farol."
