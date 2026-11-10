# Segurança do Vynco

O Vynco está em **beta test**. Ele roda no seu computador, guarda os seus segredos cifrados e só publica no LinkedIn o que você aprovou. O README explica cada proteção, na seção [Segurança](README.md#segurança).

## Versões que recebem correções

| Versão | Recebe correções de segurança |
|---|---|
| 0.17.x (beta) | Sim |
| Anteriores | Não. Atualize para a versão mais nova em [Releases](https://github.com/otavio-guerra/Vynco/releases) |

## Como avisar sobre um problema

**Não abra uma issue pública** para problemas de segurança. Use o aviso privado do GitHub:

1. Abra a aba [Security](https://github.com/otavio-guerra/Vynco/security) do repositório.
2. Clique em **Report a vulnerability** e conte:
   - o que acontece e o que pode dar errado (por exemplo: publicar sem aprovação, ler o cofre, vazar dados);
   - como reproduzir, passo a passo;
   - a versão do Vynco e do Windows.

Você recebe uma resposta em até 7 dias. Quando a correção sair, o aviso é publicado com o crédito para quem encontrou, se você quiser.

## O que conta como problema de segurança

- Publicar no LinkedIn sem a aprovação da pessoa, ou com um conteúdo diferente do aprovado.
- Ler ou alterar o cofre (`config/segredos.dat`), tokens ou chaves.
- Um site, uma página lida pela IA ou outro programa conseguir agir pelo painel local.
- O modo automático aprovar um post que não passou na conferência, ou a IA conseguir aprovar sozinha.
- Dados da pessoa saindo do computador sem ela pedir.

## O que não conta

- Uma IA escolhida pela própria pessoa, com permissão para editar o projeto, mudando o código de propósito (é um limite conhecido, descrito no README).
- Problemas que dependem de alguém já ter controle total do computador ou da conta do Windows.
- Limites e termos de serviços de terceiros (LinkedIn, Magnific, provedores do OmniRoute).
