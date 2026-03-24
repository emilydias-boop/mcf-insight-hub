
## Contexto

Os dois webhooks foram criados com sucesso no banco:
- `anamnese-mcf` → tag `ANAMNESE`
- `anamnese-insta-mcf` → tag `ANAMNESE-INSTA`

A tag `ANAMNESE-INSTA` **não precisa ser criada antecipadamente**. O sistema funciona assim:
- A tag é salva diretamente no campo `tags[]` de `crm_contacts` e `crm_deals` quando o lead chega
- A listagem de tags na tela `/crm/tags` exibe apenas tags que **já existem em contatos reais** (via Clint API)
- Portanto, `ANAMNESE-INSTA` aparecerá automaticamente após o **primeiro lead** chegar pelo webhook `anamnese-insta-mcf`

**Não há nada quebrado.** A configuração está correta.

---

## URLs prontas para usar

| Webhook | URL | Tag aplicada |
|---------|-----|-------------|
| Anamnese MCF | `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/anamnese-mcf` | `ANAMNESE` |
| Anamnese Instagram MCF | `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver/anamnese-insta-mcf` | `ANAMNESE-INSTA` |

Basta conectar a fonte do Instagram MCF à URL do `anamnese-insta-mcf`. Quando o primeiro lead chegar, a tag `ANAMNESE-INSTA` passará a aparecer no CRM.
