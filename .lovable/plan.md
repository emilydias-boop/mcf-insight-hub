

## Criar Webhook "ClientData Inside" na Pipeline Inside Sales

O sistema de webhook (`webhook-lead-receiver`) já suporta todos os campos ClientData que você solicitou (a atualização foi feita na mensagem anterior com o `upsertLeadProfile`). Basta criar um novo **endpoint de webhook** vinculado à origin "PIPELINE INSIDE SALES" (`e3c04f21`).

### O que será feito

1. **Inserir registro em `webhook_endpoints`** via SQL:
   - **Nome**: `ClientData Inside`
   - **Slug**: `clientdata-inside`
   - **Origin**: `e3c04f21` (PIPELINE INSIDE SALES)
   - **Stage inicial**: `d346320a` (Lead Gratuito - primeiro estágio)
   - **Tags automáticas**: `["ClientData"]`
   - **Campos obrigatórios**: `["name"]` (apenas nome, pois nem todo lead terá email)
   - **Field mapping**: mapeamento dos campos camelCase → snake_case para os campos ClientData (rendaBruta → renda_bruta, etc.)
   - **Ativo**: sim

2. **URL gerada automaticamente**:
   `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/clientdata-inside`

Nenhuma alteração de código necessária — o `webhook-lead-receiver` já processa todos os campos ClientData e faz o upsert no `lead_profiles`.

### Arquivo
| Ação | Arquivo |
|---|---|
| SQL INSERT | Novo registro em `webhook_endpoints` |

