## Objetivo

Adicionar aba **Histórico** no drawer da carta (ConsorcioCardDrawer) com **linha do tempo completa** de toda movimentação relacionada àquela carta: parcelas, boletos, documentos e edição da carta. Cada evento mostra **o que mudou, quando e por quem**.

## O que será registrado

| Categoria | Eventos |
|---|---|
| Parcelas | Marcada como paga / Pagamento revertido / Valor alterado / Vencimento alterado / Forma de pagamento alterada / Estorno / Recálculo em massa |
| Boletos | Upload / Substituição / Exclusão / Envio ao cliente |
| Documentos | Anexo adicionado / Anexo removido |
| Carta | Edição de campo (grupo, cota, vendedor, dia de vencimento, etc.) / Mudança de status (Ativo, Cancelado, Contemplado) / Criação |

Cada linha do log mostrará: ícone do tipo, descrição em português ("João marcou parcela 14 como paga via PIX por R$ 1.250"), valor antes → depois quando aplicável, autor (nome + avatar), data/hora em BRT.

## UI

- Nova tab `Histórico` ao lado de Parcelas / Dados do Cliente / Documentos no `ConsorcioCardDrawer`.
- Componente `CardActivityHistoryTab.tsx`: timeline vertical agrupada por dia, com filtros por categoria (Parcelas, Boletos, Documentos, Carta) e busca textual.
- Mesma permissão de visualização da carta (todos que abrem o drawer veem).

## Arquitetura técnica

### Nova tabela `consortium_card_activity_log`
Campos: `card_id`, `subscription_id`, `installment_id`, `boleto_id`, `event_type` (enum), `event_category` (parcela/boleto/documento/carta), `description`, `before_value` jsonb, `after_value` jsonb, `actor_id`, `actor_name`, `metadata` jsonb, `created_at`.

RLS: SELECT para authenticated; INSERT só via SECURITY DEFINER triggers/funções.

### Triggers automáticos
- `billing_installments` AFTER UPDATE/INSERT/DELETE → loga pagamento, reversão, mudança de valor/vencimento/forma.
- `consorcio_boletos` AFTER INSERT/UPDATE/DELETE → loga upload, substituição, exclusão.
- `consortium_cards` AFTER UPDATE → diff de colunas relevantes (status, grupo, cota, vendedor, dia_vencimento, etc.) gera um evento por campo alterado.

Triggers capturam `auth.uid()` e resolvem o nome via `profiles`.

### Eventos disparados pela aplicação
- Upload/remoção de documentos da carta (não há tabela hoje? — verificar; se for storage puro, criar registro no log via RPC `log_card_event`).
- Recálculo manual (já existe no drawer): inserir 1 evento "Recálculo executado por X" + N eventos detalhados via trigger das parcelas.

### Backfill básico
Migração popula log retroativo a partir de:
- `billing_installments` com `status='pago'` → evento `installment_paid` (autor desconhecido se não houver registro, mostra "Sistema").
- `consorcio_boletos` existentes → evento `boleto_uploaded` usando `uploaded_by` e `created_at`.
- `billing_history` existente → mapeia para eventos do novo log.
- Cartas existentes: 1 evento `card_created` por carta com `created_at`.

### Hook e queries
- `useConsortiumCardHistory(cardId)` faz SELECT no log filtrando por `card_id`, ordenado desc, com paginação.
- Invalidação adicionada nas mutations existentes (marcar pago, recalcular, editar carta, upload boleto) para refetch automático.

## Arquivos a criar / alterar

**Criar**
- Migration: tabela + enum + triggers + funções + backfill.
- `src/hooks/useConsortiumCardHistory.ts`
- `src/components/consorcio/CardActivityHistoryTab.tsx`
- `src/components/consorcio/CardActivityRow.tsx`

**Alterar**
- `src/components/consorcio/ConsorcioCardDrawer.tsx` — adicionar `TabsTrigger` e `TabsContent` "Histórico"; invalidar query do histórico após mutations.
- Pontos de upload/remoção de documentos → chamar RPC `log_card_event` para registrar (frontend).

## Memória do projeto

Após implementar, salvar memória `features/consortium-card-activity-log` documentando: tabela central, triggers automáticos, categorias de evento e que toda nova mutation em carta/parcela/boleto deve gerar log (via trigger preferencialmente).