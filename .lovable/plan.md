

# Copiar e Mover Webhook para outra Pipeline

## O que será feito

Adicionar duas novas opções no menu de contexto (⋯) de cada webhook de entrada:

1. **Copiar para outra Pipeline** -- Cria uma cópia do webhook (com novo slug) em outra pipeline, mantendo o original intacto
2. **Mover para outra Pipeline** -- Altera o `origin_id` do webhook existente para a pipeline escolhida

Ambas as ações abrem um dialog de seleção de pipeline antes de executar.

## Mudanças

| Arquivo | Alteração |
|---|---|
| `src/components/crm/webhooks/IncomingWebhookEditor.tsx` | Adicionar itens "Copiar para Pipeline" e "Mover para Pipeline" no dropdown menu; novo state para controlar dialog de seleção |
| `src/components/crm/webhooks/MoveWebhookDialog.tsx` | **Novo arquivo** -- Dialog com Select de pipelines (origins) e botão confirmar. Recebe `mode: 'copy' \| 'move'`, `endpoint`, `currentOriginId` |
| `src/hooks/useWebhookEndpoints.ts` | Adicionar `useMoveWebhookEndpoint()` (update `origin_id`) e `useCopyWebhookToOrigin()` (insert cópia com novo slug) |

## Detalhes técnicos

### MoveWebhookDialog
- Busca todas as `crm_origins` não arquivadas, excluindo a origin atual
- Mostra nome da origin agrupado pelo grupo (se tiver)
- Botão "Confirmar" executa a ação

### Hook: Mover
```typescript
// Simplesmente atualiza origin_id (e opcionalmente stage_id para null)
useMutation: UPDATE webhook_endpoints SET origin_id = newOriginId, stage_id = null WHERE id = ...
```

### Hook: Copiar
```typescript
// Cria novo registro com slug incrementado (ex: "anamnese" → "anamnese-copy")
// Copia: name, description, auto_tags, field_mapping, required_fields, auth configs, is_active
// Altera: origin_id para destino, slug com sufixo, leads_received = 0
```

