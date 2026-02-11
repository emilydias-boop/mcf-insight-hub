
# Remover Tudo Relacionado a Agendamento Fantasma (Ghost Appointments)

## Resumo

Remover completamente todos os componentes, hooks, edge functions, rotas e referencias relacionadas a "agendamento fantasma" / "ghost appointments", sem afetar o restante do sistema.

## Arquivos a DELETAR

1. **`src/hooks/useGhostAppointments.ts`** - Hook principal com todos os hooks de ghost audit
2. **`src/hooks/useGhostCountBySdr.ts`** - Hook de contagem de ghost por SDR
3. **`src/components/sdr/GhostAppointmentsAlert.tsx`** - Componente de alerta (nao esta sendo usado em nenhuma pagina, mas existe)
4. **`src/components/sdr/GhostCasesBySdr.tsx`** - Componente de casos ghost por SDR
5. **`supabase/functions/detect-ghost-appointments/`** - Edge function de deteccao

## Arquivos a MODIFICAR

### 1. `src/pages/crm/AuditoriaAgendamentos.tsx`
- A pagina tem 2 abas: "Fraude/Ghost" e "Duplicatas Webhook"
- Remover toda a aba "Fraude/Ghost" (stats, filtros, tabela, sheet de detalhes)
- Remover imports de `useGhostAppointments`
- Manter a aba "Duplicatas Webhook" (`DuplicatesTab`) como conteudo unico da pagina (sem tabs)
- Simplificar o titulo para "Auditoria - Duplicatas"

### 2. `src/components/sdr/SdrSummaryTable.tsx`
- Remover import de `GhostCountBySdr` e `Ghost` icon
- Remover prop `ghostCountBySdr` da interface e do componente
- Remover a coluna inteira do ghost (header com icone Ghost + celula com badge/tooltip/link)
- Remover variaveis `ghostData`, `hasGhostCases`, `hasCritical`, `hasHigh` do map

### 3. `src/pages/crm/ReunioesEquipe.tsx`
- Remover import de `useGhostCountBySdr`
- Remover `const { data: ghostCountBySdr } = useGhostCountBySdr()`
- Remover prop `ghostCountBySdr={ghostCountBySdr}` do `SdrSummaryTable`

### 4. `src/pages/bu-consorcio/PainelEquipe.tsx`
- Remover import de `useGhostCountBySdr`
- Remover `const { data: ghostCountBySdr } = useGhostCountBySdr()`
- Remover prop `ghostCountBySdr={ghostCountBySdr}` de qualquer `SdrSummaryTable`

### 5. `src/pages/crm/SdrMeetingsDetailPage.tsx`
- Remover import de `GhostCasesBySdr`
- Remover o bloco `<GhostCasesBySdr sdrEmail={...} sdrName={...} />`

### 6. `src/pages/CRM.tsx`
- Remover o item de navegacao `auditoria-agendamentos` / "Auditoria" e o import do icone `Shield`

### 7. `src/App.tsx`
- Remover a rota `<Route path="auditoria-agendamentos" ... />`
- Remover o import de `AuditoriaAgendamentos`

## O que NAO sera afetado

- A tabela `ghost_appointments_audit` no banco de dados permanece (sem risco de perda de dados)
- O componente `DuplicatesTab` continua existindo em `src/components/audit/DuplicatesTab.tsx`
- Todas as demais funcionalidades do CRM, Agenda, SDR, etc. permanecem intactas
- Nenhum outro hook ou componente depende dos arquivos removidos

## Secao Tecnica

A remocao e segura porque:
- `useGhostAppointments.ts` e `useGhostCountBySdr.ts` sao hooks isolados que so acessam a tabela `ghost_appointments_audit`
- `GhostAppointmentsAlert` nao e importado em nenhuma pagina (componente orfao)
- `GhostCasesBySdr` so e usado em `SdrMeetingsDetailPage`
- A coluna ghost no `SdrSummaryTable` e puramente visual e opcional (prop opcional)
- A edge function `detect-ghost-appointments` opera de forma isolada
- A pagina de Auditoria pode ser mantida com a aba de Duplicatas, ou removida inteiramente junto com a rota -- optarei por **manter** a pagina simplificada com apenas Duplicatas, a menos que voce prefira remover
