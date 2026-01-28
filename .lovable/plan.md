
# Correção do Filtro de Tentativas + Botão de Agendamento Rápido

## Problema 1: Filtro de tentativas não funciona

### Causa Raiz
O hook `useBatchDealActivitySummary` carrega os dados de forma assíncrona. Enquanto os dados não chegam:
- `activitySummaries` é `undefined`
- Para cada deal, `summary?.totalCalls || 0` retorna `0`
- Filtro `1 a 2` rejeita todos porque `0 < 1`

### Solução
Ignorar o filtro de tentativas enquanto `activitySummaries` ainda não carregou:

```typescript
// Filtro por quantidade de tentativas (range)
if (filters.attemptsRange && activitySummaries) {
  const summary = activitySummaries.get(deal.id);
  const totalCalls = summary?.totalCalls ?? 0;
  
  if (totalCalls < filters.attemptsRange.min || 
      totalCalls > filters.attemptsRange.max) {
    return false;
  }
}
```

A condição `&& activitySummaries` garante que o filtro só é aplicado quando os dados já carregaram.

---

## Problema 2: Botão de agendamento direto

### Objetivo
Adicionar um botão "Agendar" ao lado do "WhatsApp" no `QuickActionsBlock.tsx` para permitir agendamento rápido sem precisar navegar para a Agenda.

### Visual Esperado

```text
[ 📞 Ligar ]  [ 💬 WhatsApp ]  [ 📅 Agendar ]  |  [ Mover para... ▼ ]  [ → ]  |  [ ❌ Perdido ]
```

### Implementação

1. **Adicionar estado para controlar o modal**
2. **Importar `SdrScheduleDialog`** (que já existe e abre o `QuickScheduleModal`)
3. **Adicionar botão com ícone de calendário**

```tsx
// Novo estado
const [showScheduleDialog, setShowScheduleDialog] = useState(false);

// Novo botão (após WhatsApp)
<Button
  size="sm"
  variant="outline"
  className="h-8 border-blue-500/50 text-blue-600 hover:bg-blue-50"
  onClick={() => setShowScheduleDialog(true)}
>
  <Calendar className="h-3.5 w-3.5 mr-1.5" />
  Agendar
</Button>

// Modal no final do componente
<SdrScheduleDialog
  open={showScheduleDialog}
  onOpenChange={setShowScheduleDialog}
  dealId={deal?.id}
  contactName={contact?.name || deal?.name}
/>
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/crm/Negocios.tsx` | Corrigir condição do filtro para verificar se `activitySummaries` carregou |
| `src/components/crm/QuickActionsBlock.tsx` | Adicionar botão "Agendar" e integrar `SdrScheduleDialog` |

---

## Resultado Esperado

1. **Filtro de tentativas**: Funcionará corretamente após o carregamento inicial dos dados
2. **Botão Agendar**: Aparecerá ao lado do WhatsApp, abrindo modal de agendamento rápido

```text
+------------------+------------------+------------------+
| 📞 Ligar         | 💬 WhatsApp      | 📅 Agendar       |
+------------------+------------------+------------------+
```
