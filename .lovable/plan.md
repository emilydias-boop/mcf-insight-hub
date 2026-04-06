

# Unificar busca do QuickScheduleModal em campo unico

## Problema
O modal "Agendar Reuniao" tem 3 campos separados (Nome, Email, Telefone), cada um com sua propria query. O usuario quer um unico campo que busca por nome, email ou telefone simultaneamente.

## Abordagem

### 1. `src/hooks/useAgendaData.ts` — Expandir `useSearchDealsForSchedule`
A funcao ja busca por nome e telefone. Adicionar busca por email:
- Na query de `crm_contacts`, adicionar filtro `email.ilike.%${query}%` no `.or()`
- Isso faz com que um unico input encontre leads por qualquer campo

Os hooks `useSearchDealsByPhone` e `useSearchDealsByEmail` continuam existindo (usados em outros lugares), mas nao serao mais usados no QuickScheduleModal.

### 2. `src/components/crm/QuickScheduleModal.tsx` — Substituir 3 campos por 1

**Remover**:
- States: `phoneQuery`, `emailQuery`, `showPhoneResults`, `showEmailResults`
- Imports: `useSearchDealsByPhone`, `useSearchDealsByEmail`
- Os 2 blocos de UI para Email e Telefone (campos + resultados dropdown)

**Alterar**:
- O campo "Nome" vira "Buscar lead" com placeholder "Nome, email ou telefone..."
- O campo usa `nameQuery` e `useSearchDealsForSchedule` (que agora busca por nome/email/phone)
- Nos resultados do dropdown, mostrar nome + email + telefone para diferenciar leads homonimos
- Apos selecionar, mostrar email e telefone como texto informativo (read-only, sem campo de input separado) abaixo do campo de busca

**Resultado visual**:
- 1 campo de busca unificado com icone Search
- Apos selecao: card compacto mostrando nome, email e telefone do lead selecionado (com botao X para limpar)

### 3. Ajustes no `resetForm` e `handleClearSelection`
- Remover referencias a `phoneQuery`, `emailQuery`, `showPhoneResults`, `showEmailResults`

## Arquivos alterados
1. `src/hooks/useAgendaData.ts` — adicionar email ao filtro de `useSearchDealsForSchedule`
2. `src/components/crm/QuickScheduleModal.tsx` — substituir 3 campos por 1 + info card

## Impacto
- Nenhum outro componente afetado (os hooks de phone/email search continuam disponiveis)
- Comportamento de selecao de deal permanece identico
- Modal fica mais compacto e intuitivo

