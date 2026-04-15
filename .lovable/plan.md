

## Diagnóstico

A função `classifySituacao` não trata o status `completed` do attendee R2. Quando o lead comparece à R2 e ela é marcada como "Realizada" (`status = 'completed'`), o código cai no caso default e classifica como "Pendente".

Na screenshot, leads como Sarah Coelho Almeida e outros com R2 Status "Aprovado" e R2 realizada aparecem como "Pendente" quando deveriam mostrar "Realizada".

## Correção

**`src/hooks/useContractLifecycleReport.ts`** — adicionar caso para `completed` na função `classifySituacao`:

Adicionar entre o check de "Desistente" (linha 74) e o check de "Agendado" (linha 76):

```ts
// 4. Realizada
if (r2AttendeeStatus === 'completed' || r2AttendeeStatus === 'contract_paid') {
  return { situacao: 'realizada', label: '✅ Realizada' };
}
```

Atualizar o tipo `ContractSituacao` para incluir `'realizada'`.

**`src/components/crm/R2ContractLifecyclePanel.tsx`** — adicionar cor para o badge "Realizada" (verde/emerald) e incluir no KPI de "Agendados" ou criar KPI separado.

