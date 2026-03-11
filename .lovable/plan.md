

## Diagnóstico: Slot 17:00 não aparece na visão "Por Sócio"

### O que aconteceu

Ao adicionar o horário 17:00 para Jessica Martins via configuração "Por Data", o slot foi salvo corretamente no banco (o dialog mostra 5 slots: 13:00-17:00). Porém a visão "Por Sócio" do calendário não exibiu o botão "+ Livre" no 17:00 para ela.

A linha do 17:00 EXISTE no calendário (Marcos Godoy aparece nesse horário para Claudia), mas a célula da Jessica Martins está vazia — sem reunião e sem botão "Livre". Isso indica que `isSlotConfiguredForCloser` retorna `false` para Jessica no 17:00.

### Causa raiz

O cache de `useR2DailySlotsForView` (staleTime: 30s) não foi refrescado a tempo. O console mostra **13 daily slots** — mas Jessica com 17:00 deveria gerar 14. O slot foi salvo, a invalidação disparou (`['r2-daily-slots-view']`), mas o refetch provavelmente retornou dados antigos por timing de replicação ou o componente da aba não disparou o refetch imediatamente.

### Correção

1. **Reduzir `staleTime`** de `useR2DailySlotsForView` de 30s para 5s — dados de configuração mudam frequentemente durante edição
2. **Forçar refetch ao fechar o dialog de configuração** — adicionar callback `onClose` no dialog que dispara `queryClient.invalidateQueries(['r2-daily-slots-view'])` explicitamente
3. **Adicionar `refetchOnWindowFocus: true`** ao hook para garantir dados frescos ao retornar à aba

### Arquivos a editar

- `src/hooks/useR2DailySlotsForView.ts` — reduzir staleTime e adicionar refetchOnWindowFocus
- `src/pages/crm/AgendaR2.tsx` — invalidar cache do slots map ao fechar dialog de configuração de closers

