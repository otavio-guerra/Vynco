# Vynco Design System 1.0

Linguagem visual do Vynco: um assistente calmo, escuro e de vidro, onde cada área do app tem a sua cor.
Os tokens moram em `app/public/app.css` (camada "Vynco Design System 1.0", no fim do arquivo) e as pranchas editáveis estão no Desigma (`vynco/vynco-design-system.desigma`). As pranchas saem de `docs/design-system/gerar.js`.

## Princípios
1. **Uma ideia por tela.** Cada tela responde a uma pergunta: o que vai ao ar, o que espera você, o que a IA vai criar.
2. **A área diz onde você está.** Cada seção tem cor e ícone próprios. A cor aparece no sobretítulo, no indicador do menu, no brilho do fundo e no item ativo, nunca no texto corrido.
3. **O vidro guarda o conteúdo; o fundo só respira.** Partículas, aurora e grão ficam abaixo de 20% de presença.
4. **Movimento explica, não enfeita.** Entrada de tela, troca de estado e confirmação. Nada pula ao passar o mouse no menu.
5. **Nada parece navegador nem Windows.** Barra da janela, listas de escolha, rolagem e menu do botão direito são do app.

## Cores
| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--brand` | #6C63FF | #6C63FF | marca, brilhos e superfícies grandes |
| `--bg` | #0C1220 | #F4F5FA | fundo do app (Midnight / Cloud) |
| `--bg-3` | #131A2B | #FFFFFF | menus, avisos, balões |
| `--text` | #F4F5FA | #0C1220 | texto principal |
| `--soft` | #AAB0C8 | #4A4F66 | texto de apoio |
| `--faint` | #8D93AD | #5C6178 | rótulos e metadados |
| `--accent` | #8C85FF | #5A51F0 | links, foco |
| `--btn` | #625AF6 | #5A51F0 | botão principal |
| `--green` (Mint) | #7FFFD4 | #0B7A5C | sucesso, no ar, aprovado |
| `--amber` | #FFB547 | #B8730F | esperando você, atenção |
| `--red` | #FF6470 | #D93A49 | erro, desconectado |

### Cores por seção
| Área | Token | Escuro | Claro |
|---|---|---|---|
| Início | `--sec-inicio` | #8C85FF | #5A51F0 |
| Estratégia | `--sec-estrategia` | #34D3C2 | #0F9B8E |
| Criar | `--sec-criar` | #FF8A65 | #D9572F |
| Revisar | `--sec-revisar` | #FFB547 | #B8730F |
| Agenda | `--sec-agenda` | #5AA9FF | #1F6FD1 |
| Rede | `--sec-rede` | #F472B6 | #C2307A |
| Ajustes | `--sec-ajustes` | #A3AEC6 | #5B6680 |

O app define `--area` pela tela aberta (`body[data-area]`). Componentes usam `--area`, não a cor da seção direto.

## Tipografia
Família: **Segoe UI Variable** (Display para títulos, Text para o resto), com fallback do sistema. Oito degraus:

| Token | Tamanho | Altura | Peso | Uso |
|---|---|---|---|---|
| `--fs-display` | 34 | 1.15 | 700 | título da tela (h1) |
| `--fs-title` | 22 | 1.3 | 700 | destaque (próximo post) |
| `--fs-heading` | 17 | 1.3 | 600 | título de seção (h2) |
| `--fs-body-lg` | 15 | 1.5 | 400 | subtítulo, títulos de cartão (h3) |
| `--fs-body` | 14 | 1.5 | 400 | texto corrido, botões |
| `--fs-small` | 13 | 1.5 | 400 | apoio, notas |
| `--fs-caption` | 12 | 1.4 | 400 | metadados |
| `--fs-overline` | 11 | 1.2 | 600 | sobretítulos (MAIÚSCULAS) |

**Maiúsculas só em sobretítulos** (`--fs-overline`, 600, espaçamento `.08em`): grupos do menu, rótulo da área, etiquetas de estado ("APROVADO"), dias da semana do calendário. Títulos, botões e texto corrido: nunca em maiúsculas. Pesos: 400, 500, 600 e 700 (nada de 650 ou 800).

## Espaçamento
Escala de 4 px: `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 · `--sp-14` 56.
Dentro de cartões: 12–16. Entre cartões: 12. Entre blocos da tela: 24–32. Margem da tela: 28 (desktop) e 16 (celular).

## Raios
`--r-sm` 8 (campos, botões pequenos, itens de lista) · `--r-md` 12 (botões, menus, avisos) · `--r-lg` 16 (cartões e painéis de vidro) · `--r-xl` 20 (destaque, balões do tour, diálogos) · `--r-pill` 999 (chips, abas, etiquetas, contadores).

## Elevação
`--e-1` cartões em repouso · `--e-2` menus, avisos e cartões no hover · `--e-3` diálogos e tour.

## Movimento
`--t-fast` .15s (cor, hover) · `--t-base` .25s (abrir e fechar) · `--t-slow` .45s (troca de tela).
Curvas: `--ease` cubic-bezier(.2, .8, .2, 1) para quase tudo; `--spring` só para confirmação (aprovar, publicar). Com "menos movimento" ligado no sistema, nada anima.

## Componentes
| Componente | Variantes | Estados | Regras |
|---|---|---|---|
| Botão | principal (`.btn.accent`), secundário (`.btn`), link (`.link`) | normal, hover, apertado, desativado | um principal por bloco; verbo da ação no texto |
| Chip / filtro | seleção única | normal, ativo | usa `--r-pill`; contador à direita |
| Lista de escolha | `.vsel` (troca o `<select>` do navegador) | fechada, aberta, item em foco, selecionado | setas, Enter e Esc; abre para cima se faltar espaço |
| Cartão de vidro | `.glass`, `.ed-box` | normal, luz do cursor | `--r-lg`; conteúdo nunca vaza (quebra palavras longas) |
| Aviso | ok, info, erro | entrando, pausado (mouse em cima), saindo | some sozinho (7 s; erro 14 s) com barrinha do tempo |
| Menu lateral | grupos com sobretítulo | item ativo com indicador na cor da área | sem pulo nos ícones |
| Abas internas | `.subnav` | ativa com borda na cor da área | 2 a 3 abas no máximo |
| Barra da janela | `.jan-ctrl` (desktop) | hover; fechar em vermelho | fechar esconde na bandeja |
| Menu do botão direito | só em campos de texto | itens desativados quando não se aplicam | recortar, copiar, colar, selecionar tudo |
| Erro explicado | `.rot-erro` | — | título curto + o que fazer + ação; o registro técnico fica recolhido |

## Padrões por tela
- **Cabeçalho de tela:** sobretítulo da área (ícone + nome), título (display), subtítulo (body-lg) e um traço na cor da área.
- **Revisar:** três modos com cor própria: esperando você (âmbar), aprovados (verde), rascunhos (cinza, borda tracejada).
- **Agenda:** cabeçalho numa linha (mês à esquerda, navegação à direita), hoje com a cor da área, fim de semana mais apagado, eventos com barra de cor por tipo (no ar, agendado, rotina).
