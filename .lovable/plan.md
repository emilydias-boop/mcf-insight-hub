

## Plano: Corrigir indicador "Lotado" — exibir badge sobre slots COM reuniões

### Problema raiz
O indicador "Lotado" nunca aparece porque a lógica atual só renderiza o cadeado quando **não há reuniões** no slot. Porém, um slot lotado (ex: 3/3 leads) **sempre tem reuniões**, então o branch de "Lotado" nunca é alcançado — o código renderiza os cards de reunião e pula o indicador.

### Solução
Adicionar um badge "Lotado X/Y" sobreposto no canto do card de reunião quando o slot está na capacidade máxima. O badge aparece **junto** com as reuniões, não como alternativa a elas.

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/components/crm/CloserColumnCalendar.tsx` | Dentro do branch `hasMeetings` (linha ~381), após o botão de `UserPlus`, adicionar badge "Lotado" quando `totalAttendees >= maxLeads`. Badge posicionado no canto inferior direito do card. |
| `src/components/crm/AgendaCalendar.tsx` (day view) | No render de `closerMeetings` (linha ~1199), adicionar badge sobre o card quando o closer está na capacidade. |
| `src/components/crm/AgendaCalendar.tsx` (week view) | No render de meetings (linha ~1487), adicionar badge no card quando `attendeeCount >= maxLeads`. |

### Detalhes — CloserColumnCalendar

Dentro de `{hasMeetings && firstMeeting ? (` (linha 380), após o `</TooltipProvider>` e o botão `UserPlus` (linhas 515-527), adicionar:

```tsx
{/* Lotado badge overlay */}
{(() => {
  const { totalAttendees, maxLeads } = getSlotCapacityInfo(closer.id, slot);
  if (totalAttendees >= maxLeads) {
    return (
      <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 bg-red-600 text-white rounded px-1 py-0 z-20">
        <Lock className="h-2.5 w-2.5" />
        <span className="text-[9px] font-bold">{totalAttendees}/{maxLeads}</span>
      </div>
    );
  }
  return null;
})()}
```

Remover o branch morto na linha 541-552 (o `isSlotConfigured ? Lotado...`) já que nunca é atingido.

### Detalhes — AgendaCalendar (day view)

Na seção de render de meetings por closer (após o card de meeting, linha ~1199), adicionar badge similar verificando capacidade do closer naquele slot.

### Detalhes — AgendaCalendar (week view)

No render de meetings no grid (linha ~1526), após o card do meeting, adicionar badge de capacidade quando `attendeeCount >= maxLeads` para aquele closer.

### Visual
- Badge vermelho sólido (`bg-red-600 text-white`) no canto inferior-direito do card de reunião
- Ícone de cadeado pequeno + contador "3/3"
- Altamente visível sobre o fundo verde dos cards de reunião

