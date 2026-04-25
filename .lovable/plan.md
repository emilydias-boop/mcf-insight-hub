## Diagnóstico

O teste retornou **HTTP 401** porque a URL de destino é uma **Edge Function de outro projeto Supabase** (`ruupfbtqmgsynurdoomu.supabase.co`), e Edge Functions Supabase exigem o header `Authorization: Bearer <anon_key>` por padrão. O nosso dispatcher (`outbound-webhook-test` e `outbound-webhook-dispatcher`) só envia `Content-Type` + headers customizados configurados + opcional `X-Signature`. Não há injeção automática de Authorization.

**Segundo problema (silencioso):** Mesmo após resolver o 401, a função de destino (`webhook-consorcio` no outro projeto, cujo código é idêntico ao nosso `supabase/functions/webhook-consorcio/index.ts`) espera um schema **completamente diferente** do payload que enviamos:

| Campo esperado pelo destino | Enviado pelo nosso webhook |
|---|---|
| `grupo`, `cota`, `valor_credito`, `tipo_pessoa` (obrigatórios) | `event`, `external_id`, `comprador.{...}`, `valor_carta_credito` |
| `nome_completo` / `razao_social` | `comprador.nome` / `comprador.razao_social` |
| `cnpj`, `cpf`, `email`, `telefone` (raiz) | dentro de `comprador` |

Resultado esperado se só corrigirmos o 401: HTTP 400 com `Campos obrigatórios: grupo, cota, valor_credito, tipo_pessoa`.

## Solução em 2 partes

### Parte 1 — Resolver o 401 (você faz, sem código)

1. Editar o webhook **"Consórcio - Vendas para Grima"** em Admin > Automações > Webhooks Saída.
2. Na seção **Headers customizados**, adicionar:
   - **Chave:** `Authorization`
   - **Valor:** `Bearer <ANON_KEY do projeto ruupfbtqmgsynurdoomu>`
3. Salvar e clicar em **Testar** novamente.

> Use a **anon key** do projeto de destino (não service_role). Você pega no dashboard Supabase > Settings > API daquele projeto.

### Parte 2 — Compatibilizar o schema (eu faço no código)

Existem 3 caminhos possíveis. Recomendo o **B**:

**A) Adaptar o destino:** alterar `webhook-consorcio` no outro projeto para aceitar o payload estendido. ❌ Não temos acesso ao outro projeto.

**B) Adaptar o payload de saída (RECOMENDADO):** alterar a função `build_consorcio_sale_webhook_payload` no banco para emitir os campos no schema que `webhook-consorcio` espera (`grupo`, `cota`, `valor_credito`, `tipo_pessoa`, `nome_completo` na raiz, etc.) — mantendo também os campos estendidos como metadados opcionais que o destino ignora.

**C) Trocar o destino:** apontar para um endpoint genérico (Make/Zapier) que aceita JSON livre.

### Implementação proposta (caminho B)

1. **Migração SQL** — recriar `build_consorcio_sale_webhook_payload(card_id uuid, event_type text)` para retornar JSON com:
   - **Raiz (compatível com webhook-consorcio):** `grupo`, `cota`, `valor_credito`, `prazo_meses`, `tipo_produto`, `tipo_contrato`, `parcelas_pagas_empresa`, `data_contratacao`, `dia_vencimento`, `origem`, `origem_detalhe`, `tipo_pessoa`, `nome_completo`, `cpf`, `email`, `telefone`, `razao_social`, `cnpj`, `vendedor_name`.
   - **Metadados extras (ignorados pelo destino, úteis para outros consumidores):** `event`, `external_id`, `source: "consorcio"`, `occurred_at`, `status`, `data_contemplacao`, `motivo_contemplacao`, `vendedor.{id, nome}`, `comissao`, `transferencia`, `timestamps`.

2. **Atualizar** `CONSORCIO_PAYLOAD_EXAMPLE` em `src/components/automations/OutboundWebhookFormDialog.tsx` para refletir o novo formato (raiz + metadados).

3. **Atualizar** `samplePayload()` em `supabase/functions/outbound-webhook-test/index.ts` para emitir o novo formato quando a config tiver `sources` contendo `'consorcio'`. Hoje ela manda sempre payload de venda Hubla (`event: "sale.created"`), o que também explicaria o 400 do `webhook-consorcio` mesmo se o 401 fosse resolvido.

### Arquivos afetados
- `supabase/migrations/<timestamp>_<id>.sql` (novo) — recria função `build_consorcio_sale_webhook_payload`.
- `src/components/automations/OutboundWebhookFormDialog.tsx` — atualiza exemplo na UI.
- `supabase/functions/outbound-webhook-test/index.ts` — gera amostra de Consórcio compatível com destino.

### Validação
1. Você adiciona o header `Authorization: Bearer <anon_key>` no webhook.
2. Eu deploy as alterações.
3. Você clica **Testar** → esperado: HTTP 200 com `{ "success": true, "id": "<uuid>", "message": "Carta de consórcio criada com sucesso" }`.
4. Como será criada uma **carta de teste no banco do destino**, você deve depois removê-la manualmente (ou eu posso adicionar um marcador `_test: true` que o destino reconheça — mas isso requer ajuste no destino, então fica fora do escopo).

⚠️ **Atenção sobre o teste real:** o `webhook-consorcio` do destino **realmente cria um registro** em `consortium_cards` no banco do projeto de destino quando recebe um payload válido. Cada clique em "Testar" vai inserir uma carta de teste (grupo `1234`, cota `0789`, cliente `João da Silva`/CPF `00000000000`). Considere se isso é aceitável ou se prefere apontar pra uma URL de staging para testes.