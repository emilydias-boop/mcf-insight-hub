

## Parceiros em stages erradas — Diagnostico e Correcao

### Problema

Existem duas causas para parceiros aparecerem em stages que nao sao "Venda Realizada":

**1. `webhook-lead-receiver` nao verifica parceiros**
O endpoint que recebe leads dos webhooks customizados (ClientData Inside, Instagram Bio, etc.) cria deals diretamente sem verificar se o email ja e de um parceiro. So o `clint-webhook-handler` faz essa verificacao.

**2. O botao "Mover Parceiros" e manual**
A unica forma de corrigir parceiros em stages erradas e clicar manualmente no botao. Nao ha nenhuma automacao periodica.

### Correcoes

**1. Adicionar verificacao de parceiro no `webhook-lead-receiver`**

No `supabase/functions/webhook-lead-receiver/index.ts`, antes de criar o deal (linha ~370), adicionar a mesma logica de `checkIfPartner` usada no clint-webhook-handler:
- Verificar email contra `hubla_transactions` com patterns A001-A009, INCORPORADOR, ANTICRISE
- Se parceiro: registrar em `partner_returns`, atualizar lead_profile, e retornar sem criar deal
- Manter o mesmo comportamento do clint-webhook-handler (bloquear criacao)

**2. Correcao retroativa dos dados existentes**

Executar o "Mover Parceiros" (que ja existe e funciona) para limpar os dados atuais. Alternativamente, criar uma migration SQL que faca o mesmo de forma automatica:
- Cruzar emails de `crm_contacts` com `hubla_transactions` (patterns de parceiro)
- Mover deals encontrados para stage "Venda Realizada" da respectiva origin
- Adicionar tag "Parceiro"

**3. (Opcional) Automacao com pg_cron**

Agendar execucao periodica da Edge Function `move-partners-to-venda-realizada` para capturar parceiros que escapem (ex: a cada 6 horas).

### Resumo tecnico

| Ponto de entrada | Verifica parceiro? | Correcao |
|---|---|---|
| clint-webhook-handler | Sim (bloqueia) | Nenhuma |
| webhook-lead-receiver | **Nao** | Adicionar checkIfPartner |
| Backfill functions | Parcial | Ja tem cleanup separado |
| Dados historicos | N/A | Rodar "Mover Parceiros" |

