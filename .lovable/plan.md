

# Distribuir 13 leads sem dono para os SDRs

## Diagnóstico
13 deals com tags `recuperado`/`recuperado-a010` na Inside Sales estão sem owner. O backfill que os criou não chamou a função de distribuição `get_next_lead_owner`.

## SDRs ativos na distribuição (8 pessoas)
| SDR | Email | Count atual |
|---|---|---|
| Caroline Corrêa | carol.correa@ | 125 |
| Mayara Souza | mayara.souza@ | 125 |
| Leticia Nunes | leticia.nunes@ | 125 |
| Caroline Souza | caroline.souza@ | 125 |
| Marcio Dantas | marcio.dantas@ | 135 |
| Julia Caroline | julia.caroline@ | 135 |
| Robert Gusmão | robert.gusmao@ | 135 |
| Alex Dias | alex.dias@ | 135 |

## Distribuição proposta
13 leads / 8 SDRs. Os 4 com menor count (125) recebem 2 cada (8 leads), os 4 com maior count (135) recebem 1 cada + 1 extra para o primeiro (5 leads). Total: 13.

| SDR | Leads atribuídos |
|---|---|
| Caroline Corrêa | 2 |
| Mayara Souza | 2 |
| Leticia Nunes | 2 |
| Caroline Souza | 2 |
| Marcio Dantas | 2 |
| Julia Caroline | 1 |
| Robert Gusmão | 1 |
| Alex Dias | 1 |

## Execução
Uma operação de UPDATE (via insert tool) que:
1. Atualiza `owner_id` (email) e `owner_profile_id` (UUID) nos 13 deals
2. Atualiza `current_count` na `lead_distribution_config` para cada SDR
3. Registra `deal_activities` com `activity_type = 'owner_change'` para cada atribuição

| Ação | Detalhes |
|---|---|
| UPDATE `crm_deals` | Atribuir owner nos 13 deals sem dono |
| UPDATE `lead_distribution_config` | Incrementar contadores dos SDRs |
| INSERT `deal_activities` | Registrar a atribuição de cada lead |

