

# Unificar busca do R2QuickScheduleModal em campo unico

## Problema
O modal "Agendar Reuniao R2" tem 3 campos separados (Nome, Email, Telefone) com 3 queries independentes. Deve seguir o mesmo padrao ja implementado no QuickScheduleModal de R1: um unico campo que busca por nome, email ou telefone simultaneamente.

## Abordagem

O hook `useSearchDealsForSchedule` ja suporta busca unificada (nome + telefone + email no `.or()`). Basta usar apenas esse hook e remover os outros dois.

## Alteracao: `src/components/crm/R2QuickScheduleModal.tsx`

**Remover:**
- Estados: `phoneQuery`, `showPhoneResults`, `emailQuery`, `showEmailResults`
- Imports: `useSearchDealsByPhone`, `useSearchDealsByEmail`
- Os 2 blocos de busca separados (Email lines 338-380, Phone lines 382-424)
- Referencias nos handlers `handleSelectDeal`, `handleClearSelection`, `resetForm`

**Substituir os 3 campos por 1:**
- Unico campo com placeholder "Buscar por nome, email ou telefone..."
- Icone `Search`, mesma logica de `nameQuery` + `showResults`
- Apos selecao: mostrar card compacto com nome, email e telefone (read-only), com botao X para limpar

**Resultado visual:**
- 1 campo de busca ao inves de 3
- Card informativo apos selecao (igual ao R1)
- Modal mais compacto

## Arquivo alterado
1. `src/components/crm/R2QuickScheduleModal.tsx`

