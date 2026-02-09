
# Excluir socios (partners) das metricas de SDR

## Problema

Quando um lead e agendado com 2 socios, o sistema cria 3 registros em `meeting_slot_attendees` (1 lead principal + 2 com `is_partner = true`). As RPCs que calculam as metricas nao filtram socios, entao:
- 1 lead + 2 socios = 3 agendamentos (deveria ser 1)
- Se der no-show, conta 3 no-shows (deveria ser 1)
- Na lista de reunioes, aparecem 3 linhas identicas (como visto na screenshot do Bruno)

## Solucao

Adicionar o filtro `AND msa.is_partner = false` nas duas RPCs que alimentam o painel de SDR.

## Alteracoes

### 1. RPC `get_sdr_metrics_from_agenda` (metricas/KPIs)

Nova migration SQL adicionando `AND msa.is_partner = false` no WHERE da query principal (linha 59 da versao atual). Isso corrige:
- Total Agendamentos
- R1 Agendada
- R1 Realizada
- No-Shows (derivado de agendamentos - realizadas)
- Contratos

### 2. RPC `get_sdr_meetings_from_agenda` (lista de reunioes)

Nova migration SQL adicionando `AND msa.is_partner = false` no WHERE. Isso corrige:
- A lista que mostra 3 linhas "Bruno" identicas passara a mostrar apenas 1

### Arquivos criados
- `supabase/migrations/[timestamp]_exclude_partners_from_sdr_metrics.sql` -- migration com as 2 RPCs atualizadas
