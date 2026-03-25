

## Fix: ScrollArea do mapeamento de campos não permite scroll

### Causa raiz
O `ScrollArea` do Radix precisa de uma altura fixa (`h-[...]`) para ativar o scroll interno. O `max-h-[200px]` sozinho não força o viewport do Radix a limitar a altura — o conteúdo transborda sem scrollbar.

### Solução
Em `src/components/crm/webhooks/IncomingWebhookFormDialog.tsx` (linha 460), trocar:

```tsx
<ScrollArea className="max-h-[200px] rounded-md border p-2">
```

por:

```tsx
<ScrollArea className="h-[200px] rounded-md border p-2">
```

Isso garante que a altura do container seja fixa em 200px e o Radix ScrollArea renderize a scrollbar vertical quando o conteúdo (26 campos) exceder esse espaço.

### Arquivo alterado
- `src/components/crm/webhooks/IncomingWebhookFormDialog.tsx` — linha 460

