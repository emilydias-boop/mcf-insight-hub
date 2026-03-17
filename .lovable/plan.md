

## Duplicar Webhook com field_mapping completo

### Contexto

O webhook "ClientData Inside" possui um `field_mapping` com 26 campos mapeados (nome_completo, cpf, renda_bruta, saldo_fgts, etc.) que fica armazenado no banco mas nao aparece no formulario visual. A duplicacao precisa copiar esse mapeamento integralmente.

### Alteracoes

**1. `src/components/crm/webhooks/IncomingWebhookEditor.tsx`**
- Adicionar state `duplicateData: WebhookEndpoint | null`
- Adicionar item "Duplicar" (icone Copy) no DropdownMenu de cada webhook
- Handler `handleDuplicate` que seta o endpoint completo e abre o dialog
- Passar `duplicateData` como prop ao `IncomingWebhookFormDialog`
- Limpar `duplicateData` ao fechar o dialog

**2. `src/components/crm/webhooks/IncomingWebhookFormDialog.tsx`**
- Nova prop opcional `duplicateData?: WebhookEndpoint | null`
- No `useEffect` de reset: quando `duplicateData` presente (e nao `endpointId`), pre-preencher todos os campos:
  - name: original + " (Copia)"
  - slug: original + "-copia"
  - description, stage_id, auto_tags, required_fields, auth headers: copiar identicos
  - is_active: true
- No `onSubmit` (modo criacao): incluir `field_mapping` do `duplicateData` no payload passado ao `createMutation`
- Titulo do dialog: "Duplicar Webhook de Entrada" quando `duplicateData` presente

**3. `src/hooks/useWebhookEndpoints.ts`**
- Adicionar `field_mapping` como campo opcional no tipo `CreateWebhookEndpoint`
- Passar `field_mapping` no insert quando fornecido

### O que sera copiado

| Campo | Copiado? |
|---|---|
| name, slug, description | Sim (com sufixo) |
| stage_id, auto_tags, required_fields | Sim |
| auth_header_name, auth_header_value | Sim |
| **field_mapping** (26 campos) | **Sim** |
| leads_received, last_lead_at | Nao (zerados) |

### Resultado

O usuario clica "Duplicar" no ClientData Inside, o formulario abre pre-preenchido com todos os dados incluindo o mapeamento de 26+ campos. Altera o que quiser (nome, slug, tags) e salva. O novo webhook herda todo o field_mapping e funciona identicamente para processar os dados do lead_profiles.

