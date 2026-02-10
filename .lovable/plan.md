
# Adicionar Meta Editavel no Card "BU Consorcio"

## Contexto
O card "BU Consorcio" no topo do Painel Equipe mostra Apurado e Meta para Semana, Mes e Ano. Atualmente, as metas mostram R$ 0,00 porque nao existem registros na tabela `team_targets` para os tipos `setor_efeito_alavanca_*` e `setor_credito_*`. Tambem nao ha interface para o gestor editar esses valores.

## O que sera feito

### 1. Criar um modal de edicao de metas monetarias do BU Consorcio
- Um novo componente `ConsorcioRevenueGoalsEditModal` que permite ao gestor (admin, manager, coordenador) definir metas de faturamento para:
  - **Efeito Alavanca**: meta semanal, mensal e anual (usa target types `setor_efeito_alavanca_semana`, `setor_efeito_alavanca_mes`, `setor_efeito_alavanca_ano`)
  - **Credito**: meta semanal, mensal e anual (usa target types `setor_credito_semana`, `setor_credito_mes`, `setor_credito_ano`)
- Campos de input monetario (R$) para cada periodo
- Botao "Salvar" que faz upsert na tabela `team_targets`

### 2. Adicionar botao de edicao no card ConsorcioMetricsCard
- Um icone de engrenagem (Settings2) no card, visivel apenas para roles `admin`, `manager`, `coordenador`
- Ao clicar, abre o modal de edicao

### 3. Garantir que o "Apurado" mostra os valores corretos
- O card ja combina `comissaoSemanal` (comissao de installments do Efeito Alavanca) + `apuradoSemanal` (comissao do Credito). Confirmaremos se o usuario quer ver **valor em carta** (total de creditos de cartas) ou **comissao** (o que ja esta sendo mostrado). A implementacao atual usa comissoes -- se o usuario quiser "valor em carta", ajustaremos para usar `apuradoSemanal` do efeito_alavanca (que ja e o total de cartas via `valor_credito`) em vez de `comissaoSemanal`.

## Detalhes Tecnicos

### Novo componente: `src/components/sdr/ConsorcioRevenueGoalsEditModal.tsx`
- Modal com 6 campos (2 setores x 3 periodos)
- Usa upsert direto na tabela `team_targets` para os tipos `setor_*`
- Invalida query `['setores-dashboard']` apos salvar para atualizar o card

### Alteracao: `src/pages/bu-consorcio/PainelEquipe.tsx`
- Adicionar estado `revenueGoalsEditOpen`
- Adicionar botao de edicao no `ConsorcioMetricsCard`
- Importar e renderizar o modal
- Corrigir o "Apurado" para usar `apuradoSemanal` (valor em carta) do efeito_alavanca em vez de `comissaoSemanal` (comissao), somado ao `apuradoSemanal` do credito

### Alteracao: `src/hooks/useSetoresDashboard.ts`
- Nenhuma alteracao necessaria - o hook ja busca os targets `setor_*` e os retorna nos dados. Os targets simplesmente nao existiam no banco.

### Banco de dados
- Nenhuma migracao necessaria - os tipos `setor_efeito_alavanca_semana`, `setor_efeito_alavanca_mes`, etc. ja estao permitidos no CHECK constraint
