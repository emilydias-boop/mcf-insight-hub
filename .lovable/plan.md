

## Plano: Corrigir query do Webhook Analytics (0 resultados)

### Causa raiz

Dois problemas na query do hook `useWebhookIntakeAnalytics.ts`:

1. **Case mismatch no filtro**: O `lead_channel` no banco é armazenado em UPPERCASE (`CLIENTDATA-INSIDE`), mas o slug do endpoint é lowercase (`clientdata-inside`). O filtro usa `eq` (case-sensitive), resultando em 0 matches.

2. **Join com tabela errada** (menor): O hook faz join com `crm_stages` que funciona neste caso, mas o padrão do projeto usa `local_pipeline_stages` em muitos lugares. Ambas as tabelas têm dados, então isso não é o bloqueio principal, mas deve ser corrigido para consistência.

### Correção

**Arquivo**: `src/hooks/useWebhookIntakeAnalytics.ts`

- Alterar o filtro de `lead_channel` para comparar em uppercase: trocar `.filter('custom_fields->>lead_channel', 'eq', slug)` por `.filter('custom_fields->>lead_channel', 'eq', slug.toUpperCase())`
- Isso resolve o match porque o webhook-lead-receiver armazena o `lead_channel` como `slug.toUpperCase()`

### Resultado

Ao selecionar "ClientData Inside", a query vai filtrar por `CLIENTDATA-INSIDE` e retornar os 57 leads corretamente, populando KPIs, breakdown por estágio e tabela.

