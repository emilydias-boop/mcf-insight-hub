# Reembolsos em tela cheia, busca e edição auditada

## O que muda

### 1. Painel de Reembolsos em tela cheia
O modal de Reembolsos (aberto pelos botões/cards em Financeiro > A Receber) passa a ocupar praticamente toda a área da tela (largura e altura quase totais), com cabeçalho fixo e conteúdo rolável. Assim a listagem e a tabela de títulos ficam muito mais legíveis.

### 2. Filtro por nome de contato na aba "Reembolsos"
Hoje só a aba "Novo reembolso" tem busca. Será adicionado um campo de busca na aba de listagem, filtrando em tempo real por nome do contato (e também e-mail/CPF, sem exigir escolha do usuário).

### 3. Edição de reembolsos já criados
Nova ação "Editar" em cada linha da listagem (para reembolsos pendentes e pagos), abrindo um formulário com:
- Data do pedido
- Data prevista de pagamento
- Data de pagamento efetivo (quando pago)
- Motivo / observação
- Valor do reembolso

Reembolsos cancelados não são editáveis.

### 4. Campos sensíveis exigem justificativa + log de auditoria
O campo **Valor** (e a data de pagamento efetivo, que afeta o mês de competência) é tratado como sensível:
- Ao alterá-lo, o formulário exige justificativa de no mínimo 15 caracteres antes de permitir salvar.
- O salvamento grava registro de auditoria com valor antigo, valor novo, autor, data/hora e a justificativa.
- Alterações apenas de datas previstas e motivo são salvas sem justificativa obrigatória, mas ainda registradas no histórico do título.

### 5. Visualização do histórico
Cada linha ganha acesso ao histórico de alterações do reembolso (quem mudou, o que mudou, justificativa), exibido em painel expansível dentro da mesma tela.

## Detalhes técnicos

- `src/components/financeiro/aReceber/ReembolsosPanel.tsx`: `DialogContent` passa a usar largura/altura quase totais (`max-w-[98vw] w-[98vw] h-[95vh]`), com header fixo e área de conteúdo com scroll próprio; novo state de busca aplicado como filtro client-side sobre `useArReembolsos`.
- Novo componente `EditarReembolsoDialog.tsx` com o formulário de edição e bloco de justificativa condicional (aparece quando `valor` ou `data_pagamento` mudam em relação aos valores originais).
- Novo hook `useEditarReembolso` em `src/hooks/useArReembolsos.ts`:
  - `UPDATE public.ar_reembolsos` com os campos alterados;
  - `INSERT` em `public.audit_logs` (`table_name: 'ar_reembolsos'`, `action: 'update_sensitive' | 'update'`, `old_data`, `new_data` com a justificativa) — tabela e colunas já existem;
  - `INSERT` em `public.ar_historico` (`tipo: 'reembolso_editado'`) com descrição legível, seguindo o padrão dos hooks atuais;
  - invalida `ar-reembolsos`, `ar-reembolsos-totais`, `ar-titulos` e `ar-historico`.
- Migration necessária: adicionar policy de `UPDATE` em `public.ar_reembolsos` (hoje a tabela tem apenas 1 policy) e garantir policy/`GRANT` de `INSERT` em `audit_logs` para quem gerencia A Receber, reutilizando a função `can_manage_ar()` já existente.
- Nenhuma alteração no fluxo de criação de reembolso (baixa sem numerário) nem nos KPIs do topo da tela A Receber.