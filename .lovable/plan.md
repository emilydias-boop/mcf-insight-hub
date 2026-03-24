

## Por que os deals do backfill ficaram sem dono

### Causa raiz

Os **24 deals sem dono** foram todos criados em **24/03/2026** (hoje) por duas vias:

1. **~20 deals** criados pela Edge Function `backfill-a010-missing-deals` — a função **tenta** distribuir chamando `get_next_lead_owner(p_origin_id)`, mas a RPC retornou `null`. Isso acontece quando **não há configuração de distribuição ativa** (`lead_distribution_config`) para a origin PIS, ou todos os SDRs configurados estavam inativos.

2. **4 deals** criados manualmente via REST API (Adrielson, Jovane, Marcel, Mateus) — esses **nem passaram** pela lógica de distribuição; foram inseridos diretamente sem owner.

Os **16 deals com dono** foram criados pela função `backfill-a010-offer-leads` em uma execução anterior onde a distribuição estava funcionando.

### Plano: Distribuir os 24 deals órfãos

**Passo 1** — Verificar a configuração de distribuição atual da origin PIS para confirmar quais SDRs estão ativos.

**Passo 2** — Executar a Edge Function `distribute-leads-batch` ou atualizar diretamente via SQL/API, atribuindo os 24 deals aos SDRs ativos usando o rodízio equitativo (`get_next_lead_owner`).

**Passo 3** — Verificar que todos os 40 deals do backfill têm `owner_id` e `owner_profile_id` preenchidos.

### Detalhes técnicos

- A função `backfill-a010-missing-deals` (linhas 319-329) chama `supabase.rpc('get_next_lead_owner', { p_origin_id: originId })` — se retorna `null`, o deal é criado com `owner_id: null`
- O trigger `trg_sync_owner_profile_id` só resolve `owner_profile_id` se `owner_id` for preenchido
- A correção é rodar a distribuição manualmente para esses 24 deals

