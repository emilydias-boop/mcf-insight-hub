# Atribuir trilhas por colaborador na Academia MCF

## O que será criado
- Uma aba **Atribuir trilhas** dentro do **Admin RH**.
- Seleção de um colaborador já cadastrado na Academia, com busca por nome.
- Lista das trilhas publicadas, permitindo marcar uma ou mais e clicar em **Atribuir trilhas**.
- Exibição das trilhas já atribuídas, com progresso; não será possível atribuir a mesma trilha novamente.
- As trilhas adicionais aparecerão em **Minha Trilha**, identificadas pelo nome, com acesso às suas fases e tarefas.

## Preservação do que já existe
- A trilha principal, as respostas, as aprovações, o XP e os marcos existentes não serão apagados nem reiniciados.
- Nenhuma mudança em outras BUs, webhooks, funções de vendas ou regras comerciais.
- Não haverá remoção de trilhas nem publicação do site neste trabalho.

## Acesso e disponibilidade
- Apenas admin e RH poderão atribuir trilhas, usando os papéis existentes.
- A atribuição feita pelo Admin RH disponibilizará as trilhas adicionais imediatamente. A regra atual de o próprio colaborador abrir uma extensão somente após concluir os 90 dias permanece inalterada.
- Tarefas já presentes na trilha do colaborador não serão reiniciadas ou duplicadas. Trilhas sem tarefas novas serão identificadas como já contempladas.

## Detalhes técnicos
- As funções atuais só montam a trilha do próprio usuário; não permitem atribuir uma trilha escolhida a outro colaborador.
- Criar uma função específica `academia_atribuir_trilhas` por migração, com verificação de admin/RH no banco e atribuição das trilhas selecionadas em uma única transação.
- Reutilizar as tabelas e as regras de leitura existentes da Academia. Nenhum novo papel nem ampliação das permissões de leitura.
- Manter uma única trilha principal. Atribuições extras usam as trilhas adicionais já suportadas pelo sistema.
- Ajustar a apresentação das trilhas adicionais para mostrar seu nome e todas as fases atribuídas, não apenas o primeiro link.
- Validar atribuição múltipla, prevenção de duplicatas e preservação das tarefas existentes com testes; conferir a compilação automática. Se o projeto não disponibilizar uma sessão de teste, a atribuição com login real será informada como não verificada.