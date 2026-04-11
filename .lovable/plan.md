

# Plano: Classificar leads sem R1 como Outside

## Problema
Atualmente, o sistema so classifica como "Outside" leads que tem contrato pago E uma R1 agendada posterior. Leads que pagaram contrato mas nao tem nenhuma R1 no sistema sao ignorados — 22 casos so em abril. O usuario confirma que esses tambem sao Outsides, pois precisam ser identificados e colocados na R1.

## Estado atual por hook

| Hook | Sem R1 = Outside? | Acao |
|---|---|---|
| `useOutsideDetectionForDeals` (Kanban) | Ja trata (linha 259-260) | Nenhuma |
| `useOutsideDetectionBatch` (Agenda R1) | N/A — so recebe attendees que ja tem meeting | Nenhuma |
| `useSdrOutsideMetrics` (Metricas SDR) | **NAO** — retorna 0 se nao achar R1 | **Corrigir** |
| `useCloserAgendaMetrics` | Exclui outsides do closer — logica similar | **Verificar** |

## Correcao principal: `useSdrOutsideMetrics.ts`

O problema esta nas linhas 115-116: se nenhum attendee R1 e encontrado para os deal_ids, o hook retorna `{ totalOutside: 0 }` imediatamente, perdendo todos os leads sem R1.

**Correcao**: Apos o loop dos attendees com R1, iterar sobre `contractEmails` que nao foram contabilizados (sem R1 encontrada). Para esses, buscar o `deal owner` como SDR responsavel e contar como Outside.

```
Fluxo corrigido:
1. Buscar contratos no periodo (ja existe)
2. Buscar deals/contacts (ja existe)  
3. Buscar R1 attendees (ja existe)
4. Contar outsides COM R1 (contrato < meeting) (ja existe)
5. [NOVO] Para emails com contrato mas SEM R1:
   - Buscar deal owner (crm_deals.owner_id -> profiles.email)
   - Se owner e um SDR valido, contar como Outside
```

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useSdrOutsideMetrics.ts` | Adicionar logica para contar contratos sem R1 como Outside, atribuindo ao deal owner |

## Detalhes tecnicos

Apos o loop existente (linha 140-161), adicionar:

1. Coletar emails ja contados (`countedEmails`)
2. Para cada `contractEmail` que nao esta em `countedEmails`:
   - Buscar o `crm_deals.owner_id` do deal correspondente
   - Mapear `owner_id` -> email via `profiles`
   - Se email do owner esta em `validSdrEmails`, incrementar `outsideBySdr` e `totalOutside`

Isso adiciona ~1 query extra (deal owners) mas captura os ~22 leads perdidos.

