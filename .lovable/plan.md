

## Plano: Mover todos os deals de parceiros para "Venda Realizada"

### Problema
Parceiros existentes (que compraram A001, A009, etc.) estão em estágios ativos do pipeline e os SDRs estão ligando para eles desnecessariamente. Esses deals precisam ser movidos automaticamente para o estágio "Venda Realizada".

### Solução

Criar uma **Edge Function** `move-partners-to-venda-realizada` que:

1. Busca **todos os deals** no CRM com contatos que possuem email
2. Cruza os emails com `hubla_transactions` para identificar parceiros (mesma lógica de `PARTNER_PATTERNS`: A001, A002, A003, A004, A009, INCORPORADOR, ANTICRISE)
3. Filtra deals que **não estão** no estágio "Venda Realizada"
4. Para cada pipeline/origin, busca o stage_id de "Venda Realizada" correspondente (usando `ilike '%venda realizada%'` na tabela `crm_stages`)
5. Move todos os deals de parceiros para esse estágio, adicionando tag `Parceiro` e registrando atividade em `deal_activities`
6. Suporta `dry_run` para simular antes de executar

### Detalhes técnicos

| Item | Detalhe |
|---|---|
| Nova Edge Function | `supabase/functions/move-partners-to-venda-realizada/index.ts` |
| Botão de execução | Adicionar na página de Negócios (similar ao `OutsideDistributionButton`) |
| Lógica de parceiro | Reutiliza `PARTNER_PATTERNS` do `cleanup-backfill-partners` |
| Stage lookup | Busca `crm_stages` por `stage_name ILIKE '%venda realizada%'` por `origin_id` |
| Fallback stage | `3a2776e2-a536-4a2a-bb7b-a2f53c8941df` (Venda Realizada do Pipeline Inside Sales) |

### Fluxo da Edge Function

```text
1. Buscar todos deals com contatos (email)
2. Buscar hubla_transactions para emails → Set<partnerEmails>
3. Filtrar deals onde email ∈ partnerEmails AND stage ≠ "Venda Realizada"
4. Para cada origin_id único, buscar stage_id de "Venda Realizada"
5. Atualizar cada deal: stage_id, tag "Parceiro", deal_activity
6. Retornar relatório: total verificados, parceiros encontrados, movidos
```

### Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/move-partners-to-venda-realizada/index.ts` | Nova edge function |
| `src/components/crm/MovePartnersButton.tsx` | Novo botão para disparar a função |
| `src/pages/crm/Negocios.tsx` | Adicionar o botão na toolbar |

