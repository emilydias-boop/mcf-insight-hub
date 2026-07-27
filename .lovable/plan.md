## Problema

Os SDRs Cleiton e Ithaline não veem novos leads no Kanban do Consórcio porque `Negocios.tsx` (linha 295) filtra por `owner_profile_id = user.id` para cargo SDR. Novos leads replicados estão sendo criados com `owner_profile_id = NULL` (56 deals nos últimos dias na stage "NOVO LEAD ( FORM )"), então ficam invisíveis.

Permissão em `pipeline_permissions` já está OK; RLS de `crm_deals` é `USING (true)`. O problema é apenas atribuição.

## Correção

1. **Reatribuir apenas os deals com `owner_profile_id IS NULL`** nas duas stages "Novo Lead" do Consórcio, distribuindo round-robin entre Cleiton e Ithaline:
   - Stage `b5af7d28-7a0f-4da5-a115-094489fbc07d` (NOVO LEAD ( FORM ) — Efeito Alavanca + Clube)
   - Stage `550a86c1-8ab6-42a3-8744-93fd3f5336c2` (Novo Lead — Cobrança Consorcio)
   - SDRs elegíveis: Cleiton (`16828627-136e-42ef-9623-62dedfbc9d89`) e Ithaline (`411e4b5d-8183-4d6a-b841-88c71d50955f`)
   - Deals já atribuídos a outros SDRs (Ygor, Bruno, etc.) permanecem como estão

2. **Ajustar `supabase/functions/process-deal-replication/index.ts`** para que, ao criar novo deal nas origens do Consórcio (`7d7b1cb5-2a44-4552-9eff-c3b798646b78` e `ea7aac02-3a69-422a-9f6e-691c8a04f06a`), a distribuição seja feita via round-robin **exclusivamente** entre Cleiton e Ithaline, garantindo que `owner_profile_id` nunca fique NULL. Implementar como lookup direto no código da edge (contar deals na stage novo lead nos últimos 7 dias para cada um dos dois e atribuir ao com menor carga) — sem depender de `get_next_lead_owner`, que hoje está devolvendo NULL/SDRs de outros squads.

## Notas técnicas

- Passo 1 é `supabase--insert` (UPDATE em `crm_deals`).
- Passo 2 é edição da edge function (deploy automático após o build).
- Nada muda em RLS, permissões ou UI.