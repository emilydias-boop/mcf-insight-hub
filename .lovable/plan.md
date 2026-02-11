

# Corrigir calculo de No-Show para SDRs

## Mudanca

Alterar a formula de No-Show de `Agendamentos - R1 Realizada` para `R1 Agendada - R1 Realizada`.

**Esclarecimento importante**: `contract_paid` ja esta incluido em `R1 Realizada` (junto com `completed` e `refunded`), entao a formula `R1 Agendada - (Realizadas + Contrato Pago)` equivale a `R1 Agendada - R1 Realizada` no sistema atual.

## Onde alterar

### 1. RPC `get_sdr_metrics_from_agenda` (banco de dados)

Linha 74 da funcao atual:
```text
-- ATUAL:
'no_shows', GREATEST(0, COALESCE(agendamentos, 0) - COALESCE(r1_realizada, 0))

-- NOVO:
'no_shows', GREATEST(0, COALESCE(r1_agendada, 0) - COALESCE(r1_realizada, 0))
```

### 2. Nenhuma alteracao no frontend

O frontend (`SdrSummaryTable`, `useTeamMeetingsData`, `TeamGoalsPanel`) ja consome o campo `no_shows` direto da RPC. Ao corrigir a fonte, todos os paineis atualizam automaticamente.

## Impacto

- **Painel SDR** (`/crm/reunioes-equipe`): coluna No-show e porcentagem serao recalculadas
- **KPI cards**: Taxa de No-Show sera baseada em reunioes agendadas para o periodo
- **Fechamento SDR**: metricas vindas da mesma RPC serao ajustadas
- **Pagina individual do SDR**: mesma correcao aplicada

## Complexidade
Alteracao de 1 linha em 1 migracao SQL. Zero alteracoes no codigo frontend.

