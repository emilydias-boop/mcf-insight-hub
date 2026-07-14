# Kanban de Cobrança — /financeiro/a-receber

Nova aba "Kanban Cobrança" na página A Receber, com pipeline visual de 3 colunas para gerenciar títulos em aberto. Cada título de `ar_titulos` fica em um stage; o grid atual passa a exibir um tag colorido indicando o stage.

## Stages

1. **Cobrança do mês** — títulos com parcelas pendentes vencendo no mês vigente (ainda não vencidas ou vencidas hoje).
2. **Cobrança em atraso** — títulos com ao menos uma parcela vencida (data_vencimento < hoje) e não paga.
3. **Cobrança judicial** — movido manualmente pelos advogados/financeiro; permanece nesta coluna até baixa ou cancelamento.

Regra:
- Stage 3 é sempre manual (persistido).
- Stages 1 e 2 são calculados por data automaticamente, mas o usuário pode arrastar entre 1 e 2 (override manual persistido).
- Títulos `quitado`/`cancelado` não aparecem no Kanban.

## Persistência

Nova coluna em `ar_titulos`:
- `cobranca_stage` text (`'mes' | 'atraso' | 'judicial'`) — nullable; quando null, stage é derivado por data.
- `cobranca_stage_manual` boolean default false — indica se o usuário fixou manualmente (previne recomputo automático).
- `cobranca_stage_updated_at` timestamptz.

Função `public.compute_cobranca_stage(titulo_id uuid)` retorna o stage derivado (consulta `ar_parcelas`). Usada como fallback quando `cobranca_stage_manual = false`.

## UI

**Aba nova** em `src/pages/AReceber.tsx` (ou wrapper equivalente): `Listagem` | `Kanban Cobrança`.

**Componente** `src/components/financeiro/aReceber/KanbanCobranca.tsx`:
- 3 colunas com contador e soma de valor_pendente.
- Cards com: cliente, produto, valor pendente, próxima parcela vencendo, dias em atraso (badge vermelho quando aplicável), responsável.
- Drag-and-drop entre colunas (dnd-kit já usado no projeto).
- Ações no card:
  - **Baixar parcela** — abre modal existente de baixa (reuso do fluxo do A Receber).
  - **Registrar contato** — mini-dialog que insere linha em `ar_historico` (`tipo = 'contato_cobranca'`).
  - **Mover para judicial** — atalho que seta stage=judicial e loga em `ar_historico`.
  - **Abrir detalhes** — abre o drawer atual do título.

**Grid A Receber**: nova coluna "Stage" com badge colorido (azul=mês, âmbar=atraso, vermelho=judicial). Filtro por stage na barra de filtros.

## Hooks / dados

- `useCobrancaKanban()` — busca todos os títulos `status='aberto'` com enriquecimento de parcelas + stage efetivo.
- `useUpdateCobrancaStage()` — grava `cobranca_stage`, `cobranca_stage_manual=true`, `cobranca_stage_updated_at`, e registra `ar_historico` com `tipo='mudanca_stage'`.
- `useRegisterCobrancaContato()` — insere em `ar_historico`.
- Reuso: `useMarkArParcelaPaga`, `useArHistorico`.

## Migração (schema)

```sql
ALTER TABLE public.ar_titulos
  ADD COLUMN cobranca_stage text CHECK (cobranca_stage IN ('mes','atraso','judicial')),
  ADD COLUMN cobranca_stage_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN cobranca_stage_updated_at timestamptz;

CREATE INDEX idx_ar_titulos_cobranca_stage ON public.ar_titulos(cobranca_stage) WHERE status = 'aberto';
```
Função SQL `compute_cobranca_stage` para derivação por data (usada em views/queries e no client).

Sem novas tabelas → RLS/GRANTs existentes de `ar_titulos` cobrem os novos campos.

## Fora de escopo

- Notificações automáticas por WhatsApp/email a partir do Kanban.
- Régua de cobrança automatizada (será tratada em outro épico se necessário).
- Alteração das regras de baixa financeira existentes.
