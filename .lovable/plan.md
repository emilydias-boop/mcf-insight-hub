

## Plano: Migrar Emails para Brevo + Novos Fluxos (NFSe → Financeiro/Supervisor, Relatório Semanal)

### Resumo

Substituir ActiveCampaign e Resend por **Brevo (API v3)** como provedor único de email transacional, e adicionar 3 novos fluxos de envio.

### Sobre o remetente (pergunta 3)

Para descobrir qual email remetente está verificado no Brevo:
- Acesse **app.brevo.com → Configurações → Remetentes, domínios e IPs dedicados → Remetentes**
- Lá você verá os emails verificados (ex: `notificacoes@minhacasafinanciada.com`)
- Me informe qual é, e eu configuro no sistema

Enquanto isso, vou preparar a implementação usando um placeholder que você substituirá.

---

### Fase 1: Criar Edge Function `brevo-send`

**Novo arquivo:** `supabase/functions/brevo-send/index.ts`

- Endpoint centralizado que substitui `activecampaign-send` e `send-document-email`
- Usa `POST https://api.brevo.com/v3/smtp/email` com header `api-key`
- Aceita: `to` (email), `name`, `subject`, `htmlContent`, `cc` (array opcional), `tags` (array opcional)
- Remetente: placeholder `MCF Gestão <notificacoes@minhacasafinanciada.com>` (ajustaremos quando você confirmar)
- **Requer secret:** `BREVO_API_KEY`

### Fase 2: Migrar chamadas existentes

| Arquivo | De | Para |
|---------|-----|------|
| `src/lib/notifyDocumentAction.ts` | `activecampaign-send` | `brevo-send` |
| `supabase/functions/automation-processor/index.ts` | `activecampaign-send` | `brevo-send` |

A Edge Function `send-document-email` (Resend) fica obsoleta mas não será deletada ainda — apenas deixa de ser chamada.

### Fase 3: NFSe → Email para Financeiro + Supervisor

Quando colaborador envia NFSe (nos modais `EnviarNfseModal` e `EnviarNfseFechamentoModal`):

1. **Email para `financeiro@minhacasafinanciada.com`**: contendo nome do colaborador, mês de referência, número da NFSe, valor
2. **Email para o supervisor (gestor)**: buscar `gestor_id` do colaborador na tabela `employees`, pegar o `email_pessoal` do gestor, enviar notificação

Ambos via `brevo-send`, usando o template HTML padrão MCF já existente em `notifyDocumentAction.ts`.

### Fase 4: Relatório Semanal por BU → Diretor

**Novo arquivo:** `supabase/functions/weekly-bu-report/index.ts`

- Busca dados de performance da semana anterior (Sábado a Sexta) de cada BU:
  - Incorporador: receita bruta via `hubla_transactions`
  - Consórcio: via `consortium_cards`
  - Crédito: se disponível
- Monta email HTML com tabela resumo (BU, meta semanal, apurado, % atingimento)
- Envia para `grimaldo.neto@minhacasafinanciada.com` via `brevo-send`
- **Agendamento:** pg_cron toda segunda-feira às 07:00 (primeiro horário do dia)

### Fase 5: Config e Deploy

- Adicionar `brevo-send` e `weekly-bu-report` ao `supabase/config.toml`
- Solicitar o secret `BREVO_API_KEY` ao usuário
- Deploy de todas as functions modificadas

### Arquivos criados/modificados

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/brevo-send/index.ts` |
| Criar | `supabase/functions/weekly-bu-report/index.ts` |
| Editar | `src/lib/notifyDocumentAction.ts` |
| Editar | `supabase/functions/automation-processor/index.ts` |
| Editar | `src/components/meu-rh/EnviarNfseModal.tsx` |
| Editar | `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx` |
| Editar | `supabase/config.toml` |

### Pré-requisito

Preciso que você adicione o secret `BREVO_API_KEY` — vou solicitar na implementação.

