# Usuários da BU Pós Venda (Gerente de Relacionamento)

## O que encontrei hoje
| Pessoa | Login existe? | Perfil atual | Cadastro RH |
|---|---|---|---|
| William Rangel de Barros Silva | Não | — | Não |
| Rebeca Carlos de Aguiar Saar | Não | — | Não |
| Kalyanne Pereira | Sim (nome gravado como "kalyanne.pereira") | Viewer | Não |
| Vitor Ferreira | Sim | **SDR**, squad "projetos" | Sim (1 vínculo) |

## O que será feito
1. **William e Rebeca**: criar o login com e-mail confirmado, nome completo e perfil **Gerente de Relacionamento**, com acesso à BU Pós Venda.
2. **Kalyanne**: corrigir o nome para "Kalyanne Pereira", adicionar o perfil Gerente de Relacionamento e incluir a BU Pós Venda. O perfil Viewer será removido (confirmar abaixo).
3. **Vitor**: adicionar Gerente de Relacionamento e a BU Pós Venda. **Ponto de atenção**: ele é SDR hoje. Se eu remover SDR, ele sai das listas/metas/fechamento de SDR. Padrão do plano: **manter SDR e somar o novo perfil**, sem mexer no cadastro RH dele. Trocar só com sua confirmação.
4. **Senha de primeiro acesso**: sugestão `PosVenda@2026` (igual para os 4, só quem já tem login terá a senha redefinida se você autorizar; senão Kalyanne e Vitor continuam com a senha atual).
5. **Troca obrigatória no primeiro acesso**: marcar os 4 como "precisa trocar senha"; ao entrar, o sistema leva direto para uma tela de nova senha e só libera o uso depois da troca.
6. **Cadastro RH (colaborador)**: William, Rebeca e Kalyanne não têm ficha de colaborador. Não crio ficha RH sem dados (cargo, admissão etc.) — o RH completa depois; o login funciona sem ela.

## Fora do escopo
Nada em agendas, métricas, closers ou outras BUs é alterado.

## Detalhes técnicos
- Criação via edge function admin existente (service role), `email_confirm: true`; profile + `user_roles(gerente_relacionamento)`; squad/BU `pos_venda` em `profiles.squad`.
- Flag `must_change_password` em `user_metadata` (sem migration); guarda no layout autenticado redireciona para `/reset-password`-like `/trocar-senha`, que chama `updateUser({ password })` e limpa a flag.
- Verificação: login de teste de cada usuário só leitura da sessão + conferir roles via SELECT.
