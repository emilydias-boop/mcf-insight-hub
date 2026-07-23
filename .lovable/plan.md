## Objetivo

Fazer a mensagem "Confirmação Reunião Agendada — MCF Capital" sair **imediatamente** após o agendamento da R1, sem esperar os 5 minutos atuais.

## Diagnóstico do delay atual

Hoje existem **duas fontes** de atraso somando ~5–10 min:

1. **`delay_minutes = 5`** no step do fluxo "Confirmação R1 Agendada — (Incorporador)" em `automation_steps`. Isso faz o item ser enfileirado com `scheduled_for = now() + 5 min`.
2. **`pg_cron` roda o `automation-processor` a cada 5 minutos**. Mesmo com delay 0, a mensagem só sairia no próximo tick.

Sem tocar em nenhum dos dois, a fila espera os 5 min do step + até 5 min do cron.

## O que vou mudar

### 1. Zerar o delay do step
- `UPDATE automation_steps SET delay_minutes = 0 WHERE flow_id = <Confirmação R1 Agendada — (Incorporador)>`.
- Resultado: ao agendar, o item já entra na fila com `scheduled_for = now()`, pronto pra sair.

### 2. Disparo direto no momento do agendamento (envio imediato de verdade)
Em vez de depender do cron, invocar o `automation-processor` assim que a linha é criada em `automation_queue`:

- Criar trigger `AFTER INSERT ON automation_queue` que, quando `status = 'pending'` e `scheduled_for <= now()`, chama `net.http_post` para a URL do `automation-processor` com o `id` do item.
- O processor já é idempotente (usa `status='pending'` como lock antes de processar), então chamada duplicada com o cron não causa envio duplo.

Isso garante latência de **segundos**, não minutos, entre "SDR confirma agendamento" e "WhatsApp sai".

### 3. Reduzir o intervalo do cron como rede de segurança
- Trocar o `pg_cron` do `automation-processor` de `*/5 * * * *` para `* * * * *` (1 em 1 min).
- Serve pra pegar qualquer item que o trigger de INSERT não tenha conseguido despachar (ex.: erro de rede no `net.http_post`), sem esperar 5 min.

### 4. Observabilidade
- Adicionar log no processor: `[AUTOMATION-PROCESSOR] triggered_by=<cron|http_insert>` pra saber qual caminho disparou cada envio.
- Estender a view `v_automation_confirmacao_r1_health` com uma coluna `avg_latency_seconds` (diferença entre `created_at` do queue item e `sent_at` do log) pra você acompanhar se o "imediato" está sendo cumprido.

## O que NÃO muda

- Regra de resolução de link (fallbacks já implementados).
- Template SID e variáveis.
- Outros fluxos (Boas-vindas R2 etc.) — se quiser aplicar o mesmo padrão neles depois, é só me pedir.

## Arquivos / recursos afetados

- Migração SQL: `UPDATE automation_steps` + criação do trigger em `automation_queue` + reagendamento do cron.
- `supabase/functions/automation-processor/index.ts` — aceitar `queue_item_id` no body e logar `triggered_by`.
- Nenhuma mudança de UI.

## Perguntas antes de executar

1. Ok aplicar as 3 mudanças (delay=0, trigger HTTP no INSERT, cron 1 min) só no fluxo "Confirmação R1 Agendada — (Incorporador)", ou você quer que eu já estenda o mesmo padrão para os outros fluxos ativos (Boas-vindas R2, etc.)?
2. Confirma que quer o **cron a cada 1 min** como fallback? Alternativa é manter em 5 min e depender só do trigger — mais barato, mas se o `net.http_post` falhar o item espera até 5 min.
