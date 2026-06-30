## Automatizar o disparo do MCF Pay

Hoje o `notify-mcf-pay` só roda quando alguém clica "Disparar" na tela `/admin/integracao-mcf-pay`. Vou montar duas camadas para não depender mais disso.

### 1. Disparo em tempo real (trigger no banco)

- Criar trigger `AFTER UPDATE` em `public.crm_deals` que dispara quando `contract_paid_at` muda de `NULL` para um valor preenchido.
- A função do trigger chama `net.http_post` para `…/functions/v1/notify-mcf-pay` com `{ deal_id, source: 'auto_contract_paid' }` e os headers de service-role.
- Idempotência: o `notify-mcf-pay` já registra em `mcf_pay_dispatch_logs`; vou adicionar uma checagem no início da função para pular se já existir um log `success` para o mesmo `deal_id` nas últimas 24 h, exceto quando `force: true`.

### 2. Rede de segurança (cron a cada 15 min)

- Habilitar `pg_cron` + `pg_net` (já usados em outras rotinas).
- `cron.schedule('mcf-pay-auto-dispatch', '*/15 * * * *', …)` executando uma nova rota `notify-mcf-pay/sweep` que:
  1. busca deals com `contract_paid_at IS NOT NULL` nas últimas 72 h que ainda não tenham um `mcf_pay_dispatch_logs.status='success'`;
  2. dispara `notify-mcf-pay` para cada um (no máximo 25 por execução).
- Cobre falhas pontuais do trigger (timeout do `pg_net`, edge function fora do ar, etc.).

### 3. Ajustes na edge function `notify-mcf-pay`

- Aceitar `source` no payload e gravar em `mcf_pay_dispatch_logs` para distinguir `manual | auto_contract_paid | sweep`.
- Garantir que `purchase_ref.transaction_id` e os códigos SDR/Closer R1/Closer R2 continuem entrando (lógica já existente).

### 4. Visibilidade na tela `/admin/integracao-mcf-pay`

- Mostrar a coluna `source` na lista de logs.
- Banner curto: "Disparo automático ativo: trigger em contract_paid + varredura a cada 15 min."

### O que NÃO muda

- Continua possível "Disparar" manual na tela (útil para refazer).
- Caso da Jessica (R2 sem código) segue igual: enquanto não cadastrarem o `mcf_pay_closer_code` dela, a comissão R2 não vai. O disparo automático não inventa código; só evita esquecer de clicar.

### Detalhes técnicos

- Trigger usa `SECURITY DEFINER` e lê `supabase_url`/anon do `mcf_pay_config` (ou Vault) para evitar hardcode.
- Sweep roda como GET autenticado via service-role; horário UTC.
- Sem mudanças no schema além do trigger, da função do trigger e da nova coluna `source` (nullable) em `mcf_pay_dispatch_logs`.
