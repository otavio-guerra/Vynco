---
name: farol-pauta-noticias
description: Montar os carrosséis de notícias do dia no Vynco (pauta checada, slides, PDF e legenda). Use quando pedirem os carrosséis, a pauta ou notícias de IA, tecnologia e design.
---

# Carrosséis de notícias no Vynco

Siga `prompts/pauta-noticias.md` (é a rotina oficial). Resumo:
1. Pesquise na web os assuntos das últimas 24 a 72 horas (ferramentas de design, IA, big techs, web, UX). Escolha 2 diferentes entre si e das últimas duas semanas (`engine/noticias/pautas/`).
2. Confira cada fato em fonte primária ou em dois veículos sérios. Descarte o que só aparece em agregador. Mostre o outro lado quando houver disputa.
3. Escreva `engine/noticias/pautas/AAAA-MM-DD-a.js` e `-b.js` (6 a 8 slides: gancho, o que aconteceu, o outro lado, o que muda para quem desenha, leitura do autor, pergunta e fontes), com a skill `farol-marca`.
4. `node engine/noticias/carrossel.js <pauta>` e `node engine/noticias/exportar.js <id>`; confira os PNG e o PDF (uma página por slide).
5. Legenda com a skill `farol-legendas`. Não publique. Termine com "Pronto para aprovação no Vynco."
