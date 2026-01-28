
# Correção do Layout R2 Agendadas - Data e Status

## Problemas Identificados

### 1. Domingo Aparecendo em Vez de Segunda
**Causa raiz:** Bug de timezone no parsing de data.

Linha 110 em `R2AgendadasList.tsx`:
```typescript
{format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
```

Quando `day` é "2025-01-26", `new Date("2025-01-26")` interpreta como meia-noite UTC. No Brasil (UTC-3), isso vira "2025-01-25 21:00" (dia anterior!).

**Solução:** Usar `parseDateWithoutTimezone` de `dateHelpers.ts` que já existe no projeto.

### 2. Status "Aprovado" Não Destacado Corretamente
**Situação atual:** Maurício foi aprovado na R2 (Status Final = Aprovado), mas aparece como "Realizada ✓" com apenas o ícone de checkmark.

**Expectativa do usuário:** Mostrar "Aprovado" de forma mais visível, independente de ter pago contrato ou não.

**Nova lógica proposta para coluna Status:**
- Se `contract_paid`: "CP DD/MM" + badge "Aprovado" (se aprovado)
- Se apenas `aprovado` (sem CP): Badge "Aprovado" verde prominente
- Se não aprovado: Badge do status (Agendada, Realizada, No-show, etc)

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/R2AgendadasList.tsx` | Corrigir parsing de data + ajustar lógica de status |

---

## Mudanças Detalhadas

### 1. Corrigir Parsing de Data (Linha 110)

**Antes:**
```typescript
{format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
```

**Depois:**
```typescript
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
// ...
{format(parseDateWithoutTimezone(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
```

### 2. Ajustar Função `renderStatusCell`

**Nova lógica:**
```typescript
function renderStatusCell(att: R2CarrinhoAttendee) {
  const isContractPaid = att.status === 'contract_paid' || att.meeting_status === 'contract_paid';
  const isAprovado = att.r2_status_name?.toLowerCase().includes('aprovado');
  
  // Caso 1: Contrato Pago
  if (isContractPaid) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-emerald-600 text-sm font-medium">
          CP {att.contract_paid_at ? format(new Date(att.contract_paid_at), 'dd/MM') : ''}
        </span>
        {isAprovado && (
          <Badge className="bg-emerald-500 text-white text-xs">Aprovado</Badge>
        )}
      </div>
    );
  }
  
  // Caso 2: Aprovado (sem contrato pago) - NOVA PRIORIDADE
  if (isAprovado) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Badge className="bg-emerald-500 text-white text-xs">Aprovado</Badge>
      </div>
    );
  }
  
  // Caso 3: Outros status (Agendada, Realizada, No-show, etc)
  const statusInfo = STATUS_LABELS[att.status] || STATUS_LABELS[att.meeting_status] || STATUS_LABELS.scheduled;
  
  return (
    <Badge variant="outline" className={cn('text-xs', statusInfo.className)}>
      {statusInfo.label}
    </Badge>
  );
}
```

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| Agrupamento por dia | Domingo (erro timezone) | Segunda-feira (correto) |
| Aprovado sem CP | "Realizada ✓" | Badge "Aprovado" verde |
| Com Contrato Pago | "CP DD/MM + Aprovado" | Mantém igual |
| Agendada/No-show | Badge colorido | Mantém igual |

---

## Sequência de Implementação

1. Adicionar import de `parseDateWithoutTimezone`
2. Corrigir linha do header do dia usando a função
3. Reescrever função `renderStatusCell` com nova prioridade de status
4. Testar visualização na aba "R2 Agendadas"
