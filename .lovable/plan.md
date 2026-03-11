

## Fix: Botão "Reagendar R2" cortado no modal

O modal já tem `ScrollArea` com `max-h-[90vh]`, mas o botão "Reagendar R2" está **dentro** da área de scroll e fica oculto em telas menores ou quando há muitos campos.

### Solução

Mover o botão de submit para **fora** do `ScrollArea`, fixando-o no rodapé do dialog. O conteúdo scrollável fica acima.

**Arquivo**: `src/components/crm/R2RescheduleModal.tsx`

- Mover o `<Button>` de submit (linhas 454-460) para **depois** do `</ScrollArea>`, dentro de um `<div className="flex-shrink-0 pt-4">` fixo no fundo
- Reduzir altura do ScrollArea para `h-[calc(90vh-180px)]` para acomodar o botão fixo abaixo

