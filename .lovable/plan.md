

## Diagnóstico do lead Atailson e proposta para histórico de tags

### Sobre o Atailson Filho da Costa Oliveira

Levantamento direto no banco:

- **Contato**: 1 único (`ea59a2e9...`), criado **17/04/2026 07:39**, telefone +55 17 99616-2691.
- **Deals**: 1 único na pipeline `PILOTO ANAMNESE / INDICAÇÃO`, sem outros deals em outras pipelines.
- **Compras Hubla/Kiwify**: **nenhuma** (zero registros em `hubla_transactions` por nome ou telefone).
- **Tags atuais**: `['ANAMNESE-INCOMPLETA']` — só essa.
- **Atividades do deal** (4 eventos):
  1. 17/04 07:39 — `lead_entered` via endpoint **"Anamnese Incompleta"** (webhook). É aqui que a tag foi adicionada.
  2. 17/04 17:21 — Movido `INCOMPLETA → Lead Qualificado` (Antony Elias).
  3. 17/04 17:27 — Movido auto ao agendar R1 (William Ferreira).
  4. 18/04 14:49 — Status `no_show` via Agenda Sync.

**Resposta direta**: o lead **não teve outra aquisição** nem retorno com tag de Anamnese (completa). A tag `ANAMNESE-INCOMPLETA` foi adicionada na entrada do webhook em 17/04 07:39 — antes de qualquer interação humana. Se ele tivesse preenchido a anamnese completa depois, o webhook adicionaria a tag `ANAMNESE` e moveria de estágio (lógica já existe no `webhook-lead-receiver` linhas 634-705). Como isso não ocorreu, ele continua só com a `INCOMPLETA`.

### O problema estrutural: não há histórico de tags

Verifiquei `audit_logs`: **0 registros** para `crm_contacts` e `crm_deals`. As tags são gravadas/sobrescritas in-place em vários pontos (webhook receiver, hubla handler, edição manual) sem nenhum registro de quem adicionou ou quando. Hoje você só vê o estado **atual** do array.

### Proposta: registrar adições/remoções de tags

#### Mudança 1 — Trigger no banco para auditar mudanças em `tags`
Criar trigger `AFTER UPDATE` em `crm_contacts` e `crm_deals` que, quando `OLD.tags IS DISTINCT FROM NEW.tags`, insere uma atividade em `deal_activities` (para deals) e em `audit_logs` (para contatos) com:
- `activity_type: 'tags_changed'`
- `description: 'Tags adicionadas: X, Y | Removidas: Z'` (calculado por diff)
- `metadata: { added: [...], removed: [...], previous: [...], new: [...], source: 'webhook|manual|hubla' }`
- `user_id: auth.uid()` (ou null para origem webhook)

Para inserções (deal/contato novo já com tags), também registrar uma entrada inicial `tags_added`.

#### Mudança 2 — Backfill da entrada atual
Para deals existentes com tags, criar uma entrada retroativa em `deal_activities` com `created_at = deal.created_at` e a fonte derivada da `data_source` do deal (`webhook`, `manual`, `hubla`). Assim o histórico volta ao Atailson com `ANAMNESE-INCOMPLETA — adicionada em 17/04 07:39 via webhook (Anamnese Incompleta)`.

#### Mudança 3 — Exibir no Timeline do drawer
No `LeadFullTimeline.tsx`, adicionar novo `TimelineEventType: 'tag_change'` com:
- Ícone Tag, cor azul.
- Título: "Tag adicionada: ANAMNESE-INCOMPLETA" / "Tag removida: X".
- Sub-info: autor (ou "Webhook: anamnese-incompleta"), timestamp.
- Filtro próprio na barra de filtros do timeline.

E no `useLeadFullTimeline` (hook), adicionar query para `deal_activities` com `activity_type IN ('tags_changed', 'tags_added')` para renderizar.

#### Mudança 4 — Mostrar fonte da tag no badge (opcional)
No `ContactInfoCard`/local onde as tags são exibidas, ao passar mouse mostrar tooltip: "Adicionada em DD/MM/YYYY HH:mm via [fonte]".

### Arquivos afetados

- `supabase/migrations/<nova>.sql` — função `log_tags_change()` + triggers em `crm_contacts` e `crm_deals` + backfill.
- `src/hooks/useLeadFullTimeline.ts` — incluir eventos `tags_changed`/`tags_added`.
- `src/components/crm/LeadFullTimeline.tsx` — novo tipo `tag_change` + filtro + renderização.
- (Opcional) `src/components/crm/drawers/sections/ContactInfoCard.tsx` (ou similar) — tooltip nas tags.

### Resultado esperado

No drawer do Atailson, na aba **Timeline**, você verá:
- 17/04 07:39 — **Tag adicionada: ANAMNESE-INCOMPLETA** (via Webhook Anamnese Incompleta)
- 17/04 14:21 — Estágio: INCOMPLETA → Lead Qualificado
- 17/04 14:27 — Reunião R1 agendada
- 17/04 14:46 — Nota geral
- 18/04 11:49 — R1 Agendada → No-Show

E para qualquer lead futuro: cada inclusão/remoção de tag fica visível com autor, data e origem. Resolve a dúvida "foi antes ou depois de receber tal tag?" definitivamente.

