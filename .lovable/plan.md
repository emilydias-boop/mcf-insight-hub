# Karen escolher gerente na Agenda de Viabilidade

## O que acontece hoje
Na janela "Nova reunião de viabilidade", a lista de Gerente mostra só a própria Karen. A Karen já tem acesso à agenda e pode criar reuniões. O problema é que o sistema só deixa ela ver o próprio nome na lista de cargos e de perfis. Por isso William Rangel, Rebeca Saar, Vitor Ferreira e Kalyanne Pereira não aparecem, mesmo sendo gerentes de relacionamento.

## O que muda
- Criar uma função somente de leitura no banco, `pos_venda_listar_gerentes()`. Ela devolve id, nome e e-mail apenas de quem tem o papel gerente_relacionamento ou admin, e só responde para quem já tem acesso ao Pós-Venda (`pos_venda_tem_acesso`).
- Em `AgendaPosVenda.tsx`, a busca `useGerentes` passa a usar essa função. Assim, tanto a janela "Nova reunião" quanto o filtro "Todos os gerentes" mostram os quatro gerentes e a Karen.
- Nenhuma regra de acesso (RLS) de perfis ou de cargos muda, e nenhum outro usuário passa a ver dados novos. Agendar continua igual: grava em `pos_venda_reunioes` com a regra que já existe.

## Validação
- Testar a função com a sessão da Karen: a lista precisa trazer William Rangel, Rebeca, Vitor e Kalyanne.
- Typecheck e build.

## Observação
O "William" considerado aqui é William Rangel, que é gerente de relacionamento. William Ferreira é closer e não entra na lista.
