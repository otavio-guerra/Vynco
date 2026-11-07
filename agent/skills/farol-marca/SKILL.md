---
name: farol-marca
description: Desenhar peças de LinkedIn com o design system do usuário no Farol (tokens, fontes, molduras, pixel art). Use sempre que for criar ou corrigir uma imagem, GIF, slide de carrossel ou tela do Daily UI.
---

# Design system no Farol

As peças são SVG gerados por código e exportados para PNG/PDF pelo Edge.

## Onde está cada coisa
- `engine/brand/lib.js`: tokens (`T`), fontes (`FONT`), `Board` (a prancheta SVG) e peças base (`frame`, `button`, `plaque`, `chip`, `bar`, `header`, `section`, `contrast`).
- `engine/brand/kit.js`: `kit(board)` devolve as peças de post (`title`, `kick`, `para`, `card`, `chips`, `bubble`, `status`, `img`) e `chrome` desenha cabeçalho e rodapé. Quadro padrão `W` x `H` (1080 x 1350).
- Imagens: só da pasta configurada em `assetsDir` (padrão `examples/assets`).

## Regras
- Se o perfil em uso tiver "usar nas peças geradas" ligado, `lib.js` já troca as cores e fontes pelos da marca do perfil (veja `workspace/perfil.md`). Use sempre os tokens de `T` e `FONT`, nunca cores fixas no código.
- Cores só dos tokens de `T`. Proporção de referência: 60% tinta, 30% primária, 10% secundária; cores extras só como acento.
- Contraste AA no texto (use `contrast` de lib.js para conferir).
- Pixel art sempre em escala inteira (`k.img(arquivo, { k: 2 })`), nunca esticada.
- Ícones e setas desenhados com `rect`/`poly`; nunca símbolos de texto (o editor pode trocar por emoji).
- Fontes de pixel não têm acento: o gerador já remove; não force.
- Depois de gerar, exporte o PNG e **olhe a imagem**: nada cortado, sobreposto ou fora do quadro.
