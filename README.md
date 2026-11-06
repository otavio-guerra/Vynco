# Farol

**Seus posts no ar, do seu jeito. Nada sai sem você.**

O Farol é um motor de conteúdo para LinkedIn, feito por um designer para designers:
- a **sua IA** (Claude, ChatGPT, Gemini ou outra) pesquisa e desenha as peças no seu design system;
- o **Desigma** monta tudo num projeto editável;
- o **app local do Farol** cuida da parte que é sua: olhar, aprovar e publicar.

**[Ver a demonstração online](https://farol-otavio-guerra.vercel.app)** · **[Baixar para testar](https://github.com/AbapaOnSwamp/farol/releases/latest)**

| LinkedIn | Sua IA | Sincronização | Formatos |
|---|---|---|---|
| ![LinkedIn](docs/img/farol-linkedin.png) | ![IA](docs/img/farol-ia.png) | ![Sincronização](docs/img/farol-sync.png) | ![Formatos](docs/img/farol-formatos.png) |

![Como um post nasce](docs/img/fluxo.png)

Nasceu para o meu próprio perfil ([portfolio-otavio-guerra.vercel.app](https://portfolio-otavio-guerra.vercel.app)), com três frentes:
- uma série de 30 posts sobre o meu trabalho;
- o desafio [Daily UI](https://www.dailyui.co/), feito dentro do universo do meu portfólio;
- dois carrosséis de notícias por dia sobre IA, tecnologia e design.

| Série própria | Daily UI | Carrossel de notícias |
|---|---|---|
| ![Post da série](docs/img/serie-02.png) | ![Daily UI 002](docs/img/dailyui-002.png) | ![Capa do carrossel](docs/img/carrossel-capa.png) |

## O que ele faz
- **Gera peças com o seu design system.** Tudo é desenhado por código (`engine/brand`): cores, fontes, molduras e pixel art seguem as regras do seu site. Nada de template genérico.
- **Pauta com checagem.** A rotina de notícias procura os assuntos do dia, confere em fonte primária ou em dois veículos sérios e mostra "o outro lado" quando o dado é disputado.
- **Daily UI com decisões de UX.** Cada tela vem com as decisões numeradas (foco visível, estados, microcopy, acessibilidade), não só o visual.
- **Projeto editável no Desigma.** Cada peça vira um quadro na página certa do seu `.desigma`, sem perder o que você editou à mão.
- **Imagem, GIF, carrossel e vídeo.** PNG/JPG e GIF vão pela Images API, carrossel em PDF pela Documents API e MP4 pela Videos API.
- **Você aprova, ele publica.** A publicação usa a API oficial do LinkedIn. Nenhuma rotina publica sozinha: sem aprovação, nada vai ao ar.

## O app
Uma ideia por tela, com o mínimo de atrito. A entrada tem quatro passos e nenhum comando fora do app:
1. **LinkedIn:** um botão, "Continuar com LinkedIn", como em qualquer site. Você entra e clica em Permitir; o Farol nunca vê a sua senha.
2. **Sua IA:** "Continuar com Claude", "com ChatGPT" (Codex) ou "com Gemini" (Gemini CLI), e um menu com outras (GitHub Copilot, Qwen Code, OpenCode, em beta). Se a ferramenta não estiver instalada, o Farol instala e abre o login no navegador.
3. **Sincronização:** uma tela de carregamento mostra cada passo enquanto o Farol entrega à IA as regras (`agent/AGENTS.md`), as skills (`agent/skills`), os prompts das rotinas, o plugin do Desigma (MCP, se estiver instalado) e a trava que impede a IA de publicar. No fim, um teste rápido confere se ela responde.
4. **Formatos:** os quatro formatos em wireframe (imagem, GIF, carrossel e vídeo) e como aprovar com `A`.

Depois disso, a **Fila** mostra cada peça ao lado de uma prévia de como ela fica no feed. **Rotinas** roda a sua IA e **Ajustes** troca de IA, reconecta o LinkedIn e liga o Desigma.

- **Teclado:** `A` aprova, `P` publica, `←` e `→` navegam, `Enter` avança e `Esc` volta na entrada.
- **Brilho de fundo:** muda com o estado. Fica âmbar quando há post esperando você, verde quando tudo está aprovado, roxo enquanto a IA trabalha e vermelho quando algo dá errado.
- **Sons:** tudo em Ré maior. Cada tela tem um pad suave, aprovar e desfazer são dois toques numa quinta (Ré5 e Lá5) e publicar é um arpejo.
- **Movimento reduzido:** quem pede menos movimento no sistema não vê animação.

### Onde cada IA recebe o Farol
| IA | Regras | Skills | Prompts | Plugin (Desigma) | Trava da publicação |
|---|---|---|---|---|---|
| Claude (Claude Code) | `CLAUDE.md` | `.claude/skills` | `.claude/commands` | `.mcp.json` | `permissions.deny` |
| ChatGPT (Codex) | `AGENTS.md` | `.agents/skills` | `~/.codex/prompts` | `codex mcp add` | terminal sem rede |
| Gemini (Gemini CLI) | `GEMINI.md` | `.gemini/skills` | `.gemini/commands` | `.gemini/settings.json` | `tools.exclude` |

Tudo isso é gerado dentro da pasta do Farol a partir de `agent/` e fica fora do Git. Para mudar uma regra ou skill, edite `agent/` e clique em "Sincronizar de novo" em Ajustes. O mapa completo, com as IAs em beta, está em `engine/agentes.js`.

### Login do LinkedIn em um clique (ponte do Farol)
O LinkedIn exige um app com Client Secret, que não pode ir dentro de um programa baixado. Por isso o botão passa por uma ponte pequena na Vercel (`api/linkedin`): ela guarda o segredo, troca o código pelo token e devolve o token direto para o seu Farol em `127.0.0.1`, num fragmento de URL que não passa por servidor nenhum. O Farol confere o token com o próprio LinkedIn antes de salvar.

Para ligar a ponte (uma vez, por quem publica o Farol):
1. No app do LinkedIn, em **Auth**, adicione o redirect `https://farol-otavio-guerra.vercel.app/api/linkedin/callback`.
2. Na Vercel, crie as variáveis `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` e publique de novo.

Enquanto a ponte não estiver ligada, o botão avisa e oferece "Usar meu próprio app do LinkedIn", o jeito antigo, com as suas chaves.

![Fila](docs/img/farol-fila.png)

## Começar
Precisa de:
- **Node 20+** (só para rodar pelo terminal; o `Farol.exe` já traz o Node dentro);
- uma conta de IA (Claude, ChatGPT ou Gemini); a ferramenta de linha de comando o Farol instala na entrada;
- **Microsoft Edge** (para exportar PNG e PDF);
- **[Desigma](https://github.com/deepfounder-ai/desigma/releases)**, se quiser o projeto editável.

As fontes do design system de exemplo (Space Grotesk, IBM Plex Sans, Press Start 2P, VT323 e DM Serif Display, todas do Google Fonts) precisam estar instaladas para as exportações saírem iguais.

**Jeito fácil (Windows):**
1. Baixe o `Farol-windows.zip` na [página de releases](https://github.com/AbapaOnSwamp/farol/releases/latest).
2. Extraia a pasta inteira e dê dois cliques em `Farol.exe`.
3. O app abre na janela dele, sem barra de navegador. Fechar a janela encerra o Farol.

O Windows pode mostrar o aviso "O Windows protegeu o computador", porque o exe ainda não tem assinatura digital. Clique em **Mais informações → Executar assim mesmo**.

Para gerar o exe você mesmo: `npm run exe` (precisa do Node 25.5+; o ícone sai se a variável `RCEDIT` apontar para o `rcedit-x64.exe`).

**Pelo terminal:**
```bash
git clone https://github.com/AbapaOnSwamp/farol
cd farol
npm start
```
Depois é seguir a entrada. Para mudar caminhos à mão, copie `config/engine.config.example.json` para `config/engine.config.json`.

## Segurança
- O app escuta só em `127.0.0.1` e toda ação exige um token novo a cada vez que ele sobe. Assim, um site aberto no navegador não consegue agir por você.
- O token do LinkedIn (e as chaves, se você usar o seu próprio app) ficam em `config/`, que está fora do Git. O app nunca devolve segredos para a tela.
- No login de um clique, o token volta da ponte só para `127.0.0.1`, com um código de verificação (`state`) que expira em 10 minutos; o Farol confere o token com o LinkedIn antes de salvar.
- As rotinas rodam na IA escolhida com as ferramentas limitadas: ler e escrever no repositório, rodar `node`, pesquisar e usar o MCP do Desigma. O script de publicação é bloqueado para todas (veja a tabela acima).
- O token do LinkedIn vence em cerca de 60 dias. O app mostra a data, e reconectar leva um clique.

## Estrutura
```
app/            o app local (server.js sem dependências + public/)
engine/
  brand/        tokens e peças do design system (lib.js, kit.js)
  series/       série de posts próprios
  dailyui/      telas do Daily UI (dias/NNN.js) e a lista dos 100 temas
  noticias/     carrosséis: pautas, gerador e exportação em PDF
  desigma/      juntar páginas e anexar quadros no .desigma
  linkedin/     OAuth e publicação pela API oficial (imagem, GIF, PDF, vídeo)
  agentes.js    instalar, entrar e sincronizar cada IA
agent/          regras e skills que o Farol entrega à sua IA (fonte única)
api/linkedin/   ponte do login de um clique (Vercel)
prompts/        instruções das rotinas (viram comandos /farol-* na IA)
examples/assets imagens de exemplo (pixel art do meu portfólio)
workspace/      tudo o que é gerado (fora do Git); avulsos/ aceita qualquer imagem, GIF, vídeo ou PDF com uma legenda .txt de mesmo nome
config/         configuração local e segredos (fora do Git)
```

## Agendar
Para rodar todo dia, crie tarefas agendadas na sua IA apontando para `prompts/daily-ui.md` e `prompts/pauta-noticias.md`, ou use o Agendador de Tarefas do Windows (a tela Rotinas mostra o comando). A publicação continua passando pela sua aprovação.

## Créditos
- A linguagem da interface (uma ideia por tela, brilho de estado, keycaps, pílula de aviso) foi inspirada no onboarding do **[Mutto](https://mutto.app)**, um app brasileiro para mutar o microfone. O código e os sons do Farol foram feitos do zero.
- Construído por mim com o **[Claude Code](https://claude.com/claude-code)** como par de programação: eu defini o design system, o fluxo e as regras (o que pode e o que não pode ir ao ar sozinho), e o Claude escreveu boa parte do código comigo.

## Licença
Código sob licença MIT. As imagens de `examples/assets` e os textos da série são meus e estão aqui só como exemplo.
