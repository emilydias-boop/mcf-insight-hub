

# Distribuir 16 leads sem dono para os SDRs da Inside Sales

## Diagnóstico confirmado
- **16 deals** sem owner na pipeline Inside Sales (não 13 como estimado antes)
- **0 duplicatas** — todos verificados por email, nenhum tem outro deal na mesma pipeline
- Inclui 13 recuperados A010/Hubla + 2 order bumps + 1 contrato avulso

## SDRs ativos na distribuição (8 pessoas)
Os mesmos 8 SDRs do `lead_distribution_config` da origin Inside Sales.

## Distribuição: 16 leads / 8 SDRs = 2 cada

| SDR | Leads |
|---|---|
| Caroline Corrêa | 2 |
| Mayara Souza | 2 |
| Leticia Nunes | 2 |
| Caroline Souza | 2 |
| Marcio Dantas | 2 |
| Julia Caroline | 2 |
| Robert Gusmão | 2 |
| Alex Dias | 2 |

## Execução
Uma migration SQL que:
1. Busca os 16 deal IDs sem owner na Inside Sales (criados desde 06/04)
2. Busca os 8 SDRs e seus profile IDs do `lead_distribution_config`
3. Atribui `owner_id` (email) e `owner_profile_id` (UUID) — 2 leads por SDR, round-robin por ordem de `current_count`
4. Incrementa `current_count` em +2 para cada SDR
5. Registra `deal_activities` com `activity_type = 'owner_change'` para cada atribuição

| Arquivo | Acao |
|---|---|
| `supabase/migrations/*.sql` | UPDATE owner nos 16 deals + incrementar contadores + registrar atividades |

