# Marcações Especiais na Agenda R2

Sistema configurável (não hardcoded para Letícia) para destacar visualmente leads que combinam Closer R1 + canal + contrato pago, com cor/ícone/label escolhidos pelo gestor.

## 1. Banco de dados

Nova tabela `r2_special_markings` (gerenciada via modal na própria Agenda R2):

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Nome interno ("Anamnese — Letícia Faustino") |
| `closer_r1_employee_id` | uuid → employees | Closer R1 alvo (Letícia). Obrigatório |
| `required_channel` | text | 'ANAMNESE' \| 'A010' \| 'OUTRO' \| null (qualquer) |
| `require_contract_paid` | boolean | Default `true` — só marca depois do pagamento |
| `bg_color` | text | HSL ou hex (ex. `#7c3aed`) |
| `text_color` | text | Cor do texto/badge |
| `icon` | text | Emoji ou nome lucide (📋, 🔥, etc.) |
| `badge_label` | text | "Anamnese Letícia" |
| `active` | boolean | Default `true` |
| `created_at`, `updated_at`, `created_by` | — | Auditoria |

RLS: SELECT para `authenticated`; INSERT/UPDATE/DELETE para `admin`/`diretor`/`gestor` via `has_role`.

## 2. Configuração (na Agenda R2)

Novo botão **"Marcações"** no header da Agenda R2 (ao lado de "Status/Tags" e "Closers"), visível só para não-closers.

Abre `R2SpecialMarkingsConfigModal` com:
- Lista de regras existentes (cards mostrando preview da cor/badge).
- Botão "Nova Marcação" → form: Closer R1 (select de employees ativos), Canal (Anamnese/A010/Outro/Qualquer), Exigir Contrato Pago (switch, default ON), Background, Texto, Ícone, Label, Ativo.
- Editar / Excluir cada regra.

## 3. Aplicação visual

Hook `useR2SpecialMarkings()` carrega regras ativas e expõe `matchMarking(attendee)` que retorna a primeira regra que casa:

1. Channel do attendee (via `useAttendeeChannels` já existente) bate com `required_channel` (ou regra é "qualquer").
2. `m.r1_closer.id` (do `R2MeetingRow`) bate com `closer_r1_employee_id`.
3. Se `require_contract_paid=true`: deal está em estágio "Contrato Pago" OU `contract_paid_at IS NOT NULL`.

Onde aplicar:
- **Calendário** (`AgendaCalendar` slots da Agenda R2): aplica `style={{ backgroundColor: marking.bg_color, color: marking.text_color }}` no card e injeta `{marking.icon} {marking.badge_label}` em vez do emoji genérico do canal.
- **Lista** (`R2ListViewTable`): linha ganha barra lateral colorida + badge.
- **Drawer** (`R2MeetingDetailDrawer`): banner no topo (acima de "Participantes") com `bg_color` cheio: ícone + label + texto "Closer R1: {name} • Canal: {channel} • Contrato Pago".

## 4. Fluxo de detecção do "contrato pago"

Reusa o que já existe — não calcula nada novo:
- `deal.stage_name === 'Contrato Pago'` OU
- `deal.contract_paid_at IS NOT NULL` (já carregado em vários lugares; adicionar no `useR2MeetingsExtended` se ainda não vier).

## 5. Detalhes técnicos

- Migração cria tabela + RLS + índice em `(closer_r1_employee_id, active)`.
- Tipos: `src/types/r2SpecialMarking.ts`.
- Hooks: `src/hooks/useR2SpecialMarkings.ts` (CRUD + matcher).
- Componentes novos: `R2SpecialMarkingsConfigModal.tsx`, `R2SpecialMarkingForm.tsx`, `R2MarkingBadge.tsx`.
- AgendaR2 passa `r1_closer` (já existe em `R2MeetingRow`) para o `AgendaCalendar` via `meetingsAsMeetingSlots` (atualmente perdido — adicionar campo `r1_closer` na slot).
- Sem mudança de regra de negócio: é só camada de visualização + config administrativa.

## Fora de escopo

- Não cria tags reais no CRM nem altera dados do deal — é apenas marcação visual derivada das regras.
- Não envia notificação automática quando uma marca é atribuída (pode ser próxima iteração).
