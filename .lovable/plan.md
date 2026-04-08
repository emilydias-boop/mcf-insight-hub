

# Adicionar botão "Mover" na aba Pré-Agendados R2

## Problema

Na aba "Pré-Agendados", quando o horário não funciona para o closer, não há como mover o lead para outro horário/closer. Só existe "Confirmar" ou "Cancelar".

## Solução

Adicionar um botão **"Mover"** (com ícone de transferência) ao lado de "Confirmar" e "Cancelar", que abre o `R2AttendeeTransferModal` já existente. Isso permite escolher outro closer, data e horário disponível.

## Mudanças

| Arquivo | Alteração |
|---|---|
| `src/components/crm/R2PreScheduledTab.tsx` | Importar `R2AttendeeTransferModal`, adicionar state para controlar modal e lead selecionado, renderizar botão "Mover" e o modal |

### Detalhes

1. **State novo**: `transferTarget` com `{ attendee, meeting }` ou `null`
2. **Botão "Mover"**: Aparece antes de "Confirmar", com ícone `ArrowRightLeft` e cor neutra
3. **Adaptação dos dados**: Converter o `lead` do pré-agendamento para os tipos `R2AttendeeExtended` e `R2MeetingRow` que o modal espera (mapear `id`, `name`, `phone`, `deal_id`, `status` do attendee e `id`, `scheduled_at`, `closer` do meeting)
4. **Após transferir**: O lead sai da lista de pré-agendados automaticamente (pois muda de status), sem necessidade de invalidação extra

