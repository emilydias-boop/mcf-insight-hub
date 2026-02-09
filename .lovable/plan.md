
# Corrigir Visibilidade de "Minhas Reunioes" e "Metas da Equipe"

## Problemas Identificados

### Problema 1: Jessica Martins nao ve "Minhas Reunioes"
Jessica tem duas roles: `sdr` e `closer`. Como `closer` tem prioridade maior (4 vs 8), sua role primaria e `closer`. O menu lateral verifica apenas a role primaria (`role`) ao filtrar itens, e "Minhas Reunioes" exige `requiredRoles: ["sdr"]`. Como `closer` nao esta na lista, o item fica invisivel.

### Problema 2: SDRs so veem seus proprios numeros em "Metas da Equipe"
A tabela `sdr` possui politicas RLS que restringem SDRs e Closers a verem apenas seu proprio registro. O hook `useSdrsFromSquad` consulta essa tabela para montar a lista de emails validos, e como so retorna 1 email (o proprio), o `useTeamMeetingsData` filtra todas as metricas dos outros SDRs. O resultado: o TeamGoalsPanel mostra apenas os numeros individuais em vez dos totais da equipe.

## Solucao

### Correcao 1: Sidebar - Verificar todas as roles do usuario

**Arquivo**: `src/components/layout/AppSidebar.tsx`

Alterar a filtragem de menu items (linha ~415) para usar `allRoles` em vez de apenas `role`, verificando se **qualquer** role do usuario esta na lista permitida.

De:
```text
if (item.requiredRoles && role && !item.requiredRoles.includes(role)) {
```

Para:
```text
if (item.requiredRoles && role && !item.requiredRoles.some(r => allRoles.includes(r))) {
```

Tambem aplicar a mesma logica nas funcoes `getFilteredSubItems` e `getFilteredSubSubItems`.

### Correcao 2: Rota "Minhas Reunioes" - Permitir closers com role sdr

**Arquivo**: `src/App.tsx`

Mudar a rota de `ResourceGuard` para `RoleGuard` com roles `['sdr', 'closer']` para que Jessica (que tem ambas as roles) consiga acessar.

### Correcao 3: RLS da tabela `sdr` - Permitir leitura para SDRs e Closers do incorporador

**Migracao SQL**: Adicionar uma politica SELECT que permita usuarios com role `sdr`, `closer`, ou `manager` verem todos os registros da tabela `sdr`. Isso garante que `useSdrsFromSquad` retorne todos os SDRs ativos, permitindo que o TeamGoalsPanel e KPIs mostrem numeros da equipe inteira.

Nova politica:
```text
CREATE POLICY "SDRs e Closers podem ver lista de SDRs"
ON public.sdr FOR SELECT
USING (
  has_role(auth.uid(), 'sdr') OR 
  has_role(auth.uid(), 'closer') OR 
  has_role(auth.uid(), 'manager')
);
```

### Correcao 4: Manter restricao de navegacao individual

O `disableNavigation={isRestrictedRole}` no `SdrSummaryTable` ja impede que SDRs/Closers cliquem em linhas individuais para ver detalhes de outros SDRs. Isso sera mantido — eles verao os numeros agregados da equipe mas nao poderao navegar para paginas de detalhe individual.

## Secao Tecnica - Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/AppSidebar.tsx` | Usar `allRoles` na filtragem de menu items |
| `src/App.tsx` | Rota minhas-reunioes: RoleGuard com `['sdr', 'closer']` |
| Migracao SQL (tabela `sdr`) | Nova politica RLS permitindo sdr/closer/manager lerem todos |

## Resultado Esperado
- Jessica vera "Minhas Reunioes" no menu e conseguira acessar a pagina
- Todos os SDRs e Closers verao os numeros completos da equipe no TeamGoalsPanel
- Nenhum SDR/Closer conseguira clicar em outro SDR para ver detalhes individuais (mantido)
