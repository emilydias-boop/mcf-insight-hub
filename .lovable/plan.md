
# Adicionar Modal de Metas em Todas as BUs

## Contexto
O modal de edicao de metas monetarias (Semana, Mes, Ano) ja funciona para o BU Consorcio. O Incorporador e demais BUs (Projetos, Leilao) mostram "Meta: R$ 0,00" porque nao ha interface para definir esses valores. O banco de dados ja aceita os tipos `setor_incorporador_*`, `setor_projetos_*`, `setor_leilao_*` no CHECK constraint, e o hook `useSetoresDashboard` ja busca e aplica esses targets via `getTarget('setor_${config.id}_*')`.

## O que sera feito

### 1. Generalizar o modal de edicao de metas
Refatorar o `ConsorcioRevenueGoalsEditModal` para um componente generico `BURevenueGoalsEditModal` que recebe:
- `buId`: identificador do setor (ex: `'incorporador'`, `'efeito_alavanca'`, `'projetos'`, `'leilao'`)
- `buName`: nome para exibir no titulo (ex: "MCF Incorporador")
- `targetPrefix`: prefixo dos target types no banco (ex: `'setor_incorporador'`)

O modal tera campos para Semana, Mes e Ano com inputs monetarios (R$), fazendo upsert na tabela `team_targets`.

### 2. Adicionar botao de edicao no card do Incorporador
Na pagina `ReunioesEquipe.tsx`, o `IncorporadorMetricsCard` ganhara:
- Um botao de engrenagem (Settings2), visivel apenas para admin/manager/coordenador
- Abertura do modal generico configurado para `setor_incorporador_*`

### 3. Adicionar botao de edicao no Dashboard de Diretoria
Na pagina `Dashboard.tsx`, cada `SetorRow` (Incorporador, Efeito Alavanca, Credito, Projetos, Leilao) ganhara um botao de edicao com o modal correspondente, tambem restrito por role.

### 4. Atualizar o BU Consorcio para usar o modal generico
O `ConsorcioRevenueGoalsEditModal` existente sera substituido pelo componente generico, mantendo o mesmo comportamento (2 secoes: Efeito Alavanca + Credito).

## Detalhes Tecnicos

### Novo componente: `src/components/sdr/BURevenueGoalsEditModal.tsx`
- Props: `open`, `onOpenChange`, `sections` (array de `{ prefix, label }`)
- Cada section gera 3 campos: `{prefix}_semana`, `{prefix}_mes`, `{prefix}_ano`
- Busca valores existentes via `supabase.from('team_targets').select()` filtrando por prefixo
- Upsert com `week_start='2000-01-01'` e `week_end='2099-12-31'` (mesma logica atual)
- Invalida query `['setores-dashboard']` ao salvar

### Alteracao: `src/components/dashboard/SetorRow.tsx`
- Adicionar prop opcional `onEditGoals` e `canEdit`
- Renderizar botao Settings2 no canto superior direito quando `canEdit=true`

### Alteracao: `src/pages/crm/ReunioesEquipe.tsx`
- Importar modal generico e estado de abertura
- Passar `onEditGoals` e `canEdit` para o `SetorRow` do Incorporador

### Alteracao: `src/pages/Dashboard.tsx`
- Adicionar modal generico para cada setor com o prefixo correto
- Permitir edicao de metas para todos os setores (admin/manager/coordenador)

### Alteracao: `src/pages/bu-consorcio/PainelEquipe.tsx`
- Substituir `ConsorcioRevenueGoalsEditModal` pelo `BURevenueGoalsEditModal` generico com 2 sections (efeito_alavanca + credito)

### Banco de dados
- Nenhuma migracao necessaria - todos os target types ja existem no CHECK constraint
