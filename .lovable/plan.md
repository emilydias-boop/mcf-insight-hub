## Contexto

Você quer disparar um webhook **outbound** (saída) sempre que uma venda de consórcio (`consortium_cards`) for criada/atualizada, com payload estendido baseado no formato da imagem, gerenciável pela aba **Webhooks Saída** em `/admin/automacoes`.

**Estado atual do sistema:**
- Já existe infraestrutura completa de outbound webhooks: tabelas `outbound_webhook_configs`, `outbound_webhook_queue`, `outbound_webhook_logs`, edge function `outbound-webhook-dispatcher` (com retry, HMAC, logs) e UI `OutboundWebhookList` em Automações.
- O trigger atual (`enqueue_outbound_sale_webhook`) só observa `hubla_transactions` com sources `hubla|kiwify|mcfpay|make|asaas|manual`. **Consórcio não está coberto.**
- A função `build_sale_webhook_payload` monta payload baseado em transações Hubla — não serve para consórcio.

## Plano de implementação

### 1. Banco de dados (migração)

**a) Adicionar `consorcio` à lista de sources permitidos**
- Atualizar a constante de sources em `OUTBOUND_SOURCES` (frontend) e o filtro do trigger.

**b) Criar função `build_consorcio_sale_webhook_payload(card consortium_cards, event text)`**
- Retorna JSONB com formato estendido baseado na imagem:
```json
{
  "event": "consorcio.venda.criada",
  "external_id": "<card.id>",
  "grupo": "1234",
  "cota": "0789",
  "tipo_plano": "select",
  "tipo_contrato": "normal",
  "valor_carta_credito": 100000,
  "prazo_meses": 240,
  "data_venda": "2026-04-24",
  "dia_assembleia": 15,
  "status": "ativo",
  "comprador": {
    "tipo_pessoa": "pf",
    "nome": "...",
    "cpf": "...",
    "email": "...",
    "telefone": "...",
    "razao_social": null,
    "cnpj": null
  },
  "vendedor": { "id": "...", "nome": "..." },
  "comissao": { "valor": 1500.00 },
  "origem": { "tipo": "indicacao", "detalhe": "..." },
  "contemplacao": { "data": null, "motivo": null, "valor_lance": null },
  "timestamps": { "created_at": "...", "updated_at": "..." }
}
```

**c) Criar trigger `enqueue_outbound_consorcio_webhook` em `consortium_cards`**
- Eventos: `consorcio.venda.criada` (INSERT), `consorcio.venda.atualizada` (UPDATE relevante: status, valor_credito, valor_comissao, contemplacao), `consorcio.venda.cancelada` (UPDATE para status=`cancelado`).
- Insere na mesma fila `outbound_webhook_queue` para reusar o dispatcher existente.

**d) Token por integração** (similar ao da imagem)
- Criar tabela `outbound_webhook_tokens` (id, config_id, name, token_hash, last_used_at, revoked_at, created_at).
- Token em texto plano só é mostrado uma vez na criação. O dispatcher já injeta `X-Signature` HMAC; tokens são para identificação/revogação por integração.
- *(Alternativa mais simples: manter apenas o `secret_token` único por config como já existe — me confirma se quer a UI de múltiplos tokens ou só um.)*

### 2. Frontend — Estender Automações

**a) `useOutboundWebhooks.ts`**
- Adicionar `'consorcio'` em `OUTBOUND_SOURCES`.
- Adicionar eventos novos em `OUTBOUND_EVENTS`: `consorcio.venda.criada`, `consorcio.venda.atualizada`, `consorcio.venda.cancelada`.

**b) `OutboundWebhookFormDialog.tsx`**
- Já consome as listas acima — vai aparecer automaticamente como opção marcável.
- Adicionar bloco "**Exemplo de payload**" colapsável quando o source `consorcio` estiver selecionado, mostrando o JSON acima e exemplo curl (igual ao da imagem, mas usando seu projeto: `https://rehcfgqvigfcekiipqkc.supabase.co/...` — porém aqui a URL é a do CLIENTE, não a sua, já que é outbound).

**c) (Opcional) UI de tokens**
- Se decidirmos por múltiplos tokens, adicionar componente `OutboundWebhookTokens` dentro do form com listagem, botão "Gerar token" e revogação.

### 3. Edge function (mínima — reaproveita dispatcher existente)

Nada novo a criar. O `outbound-webhook-dispatcher` já lê da `outbound_webhook_queue` e dispara qualquer evento, então basta o trigger enfileirar.

### 4. Documentação inline na UI

Na aba "Webhooks Saída", quando o usuário criar um webhook para consórcio, o form mostra:
- Eventos disponíveis (com checkboxes)
- Exemplo de payload por evento
- Header de assinatura HMAC (`X-Signature: sha256=...`) explicado
- URL de destino (o cliente cola a URL DELE — Zapier/Make/n8n)

## Pontos a confirmar antes de implementar

1. **Tokens múltiplos por integração** (como na imagem) ou **um único secret_token por config** (como já existe)? O sistema atual já tem assinatura HMAC; tokens nomeados são úteis se você quer revogar/auditar por origem.
2. **Eventos a disparar**: confirma os 3 (criada / atualizada / cancelada)? Quer também `consorcio.contemplacao.registrada` quando `numero_contemplacao` é preenchido?
3. **Quais campos de UPDATE devem disparar `atualizada`**? Sugestão: status, valor_credito, valor_comissao, parcelas_pagas_empresa, contemplacao. Outros mudam muito e gerariam ruído.

Após sua aprovação eu sigo direto para a implementação.