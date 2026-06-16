## Problema identificado

89 deals com tag `A010 Em Aberto` no CRM:
- 64 sem nome
- 19 sem telefone
- 84 sem valor

**Causa raiz**: o handler `lead.abandoned_checkout` em `hubla-webhook-handler/index.ts` (linhas 3193-3209) procura o nome em `ev.userName`, `ev.customer.name`, `ev.lead.name` — mas a Hubla envia em **`event.lead.fullName`**. O valor também é lido errado (vem em `event.lead.amount.totalCents`).

**Regra de negócio nova (você definiu agora):** telefone é obrigatório. Sem telefone, descartar — a equipe não consegue trabalhar o lead.

## Boa notícia: não precisamos da API Hubla

O payload completo de cada `lead.abandoned_checkout` já está salvo em `hubla_webhook_logs.event_data`. Reconstruímos nome/telefone/email/valor direto de lá.

## Plano (3 partes)

### Parte 1 — Corrigir o handler (futuros leads)

Em `supabase/functions/hubla-webhook-handler/index.ts`, bloco `lead.abandoned_checkout`:

- Adicionar `ev?.lead?.fullName` no início dos fallbacks de `customerName`.
- Adicionar `ev?.lead?.amount?.totalCents` aos fallbacks de `valueRaw` (dividir por 100).
- **Regra de descarte**: se `customerPhone` for nulo/vazio após todos os fallbacks → **não criar lead**, logar `🚪 [ABANDONO A010] Sem telefone — descartado` e retornar.
- Manter as chaves antigas para compatibilidade.

### Parte 2 — Backfill dos 89 deals "A010 Em Aberto"

Edge function one-shot `backfill-a010-em-aberto-from-logs`:

1. Ler `hubla_webhook_logs` onde `event_type = 'lead.abandoned_checkout'`.
2. Para cada log, extrair `lead.fullName`, `lead.email`, `lead.phone`, `lead.amount.totalCents/100`, `products[0].name`.
3. Localizar o deal: por email do contato; fallback pelos últimos 9 dígitos do telefone.
4. **`UPDATE` no `crm_contacts`**: preencher `name`, `email`, `phone` **somente se nulos** (não sobrescreve dados já corretos).
5. **`UPDATE` no `crm_deals`**: preencher `name` (`"<fullName> - A010"`), `value`, `custom_fields.a010_produto` quando vazios. Adicionar `backfill_em_aberto: true`.
6. Retornar resumo: processados, atualizados, sem-match.

### Parte 3 — Limpar os "A010 Em Aberto" sem telefone

Após o backfill, rodar query que **arquiva** (soft-delete via `is_archived=true` + `archived_at=now()`) todos os deals com tag `A010 Em Aberto` onde o contato continua sem telefone (`crm_contacts.phone IS NULL OR phone = ''`). Esses são os casos em que a Hubla nunca enviou o telefone — irrecuperáveis.

Você verá o número exato antes de eu arquivar (relatório dry-run primeiro).

### Validação

- Recontar deals "A010 Em Aberto": deve cair para apenas os com telefone, todos com nome + valor.
- Confirmar via SQL que nenhum "A010 Em Aberto" ativo está sem telefone.

## Fora de escopo

- A010 fechados (já estão completos).
- Outros eventos do webhook handler.
- Chamadas à API Hubla.
