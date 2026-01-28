
# Correção do Alinhamento e Filtro de Status na Tab "Todas R2s"

## Problemas Identificados

| Problema | Causa | Local no Código |
|----------|-------|-----------------|
| Coluna "Closer R2" desalinhada | Falta `width` fixa no `TableHead` | Linhas 418 e 443-452 |
| Filtro Status só mostra "Aprovado" | Só lista status existentes nos dados, ignora leads sem status | Linhas 122-131 |
| Leads sem status não têm badge | `renderStatusCell` não mostra "Pendente" para leads sem r2_status | Linhas 53-86 |

---

## Solução

### 1. Fixar largura da coluna "Closer R2"

Adicionar largura fixa no `TableHead` para manter alinhamento consistente:

```tsx
// Antes (linha 418)
<TableHead>Closer R2</TableHead>

// Depois
<TableHead className="w-[140px]">Closer R2</TableHead>
```

E na célula também garantir que não ultrapasse:

```tsx
// Linha 443-452 - adicionar max-width
<TableCell>
  <div className="flex items-center gap-2 max-w-[140px]">
    ...
  </div>
</TableCell>
```

### 2. Adicionar opção "Pendente (Sem avaliação)" no filtro

Modificar a lógica do filtro de status para incluir leads que **não têm** `r2_status_id`:

```typescript
// Adicionar opção especial para leads sem status
const r2Statuses = useMemo(() => {
  const unique = new Map<string, string>();
  let hasWithoutStatus = false;
  
  attendees.forEach(att => {
    if (att.r2_status_id && att.r2_status_name) {
      unique.set(att.r2_status_id, att.r2_status_name);
    } else {
      hasWithoutStatus = true;  // Existem leads sem status
    }
  });
  
  const statuses = Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  
  // Adicionar opção para filtrar leads sem status
  if (hasWithoutStatus) {
    statuses.unshift({ id: '__no_status__', name: 'Pendente (Sem avaliação)' });
  }
  
  return statuses;
}, [attendees]);
```

### 3. Ajustar lógica de filtragem

```typescript
// Na linha 167
if (statusFilter !== 'all') {
  if (statusFilter === '__no_status__') {
    // Filtrar leads SEM status R2
    if (att.r2_status_id) return false;
  } else {
    // Filtrar por status específico
    if (att.r2_status_id !== statusFilter) return false;
  }
}
```

### 4. Atualizar `renderStatusCell` para mostrar "Pendente"

```typescript
function renderStatusCell(att: R2CarrinhoAttendee) {
  const isContractPaid = att.status === 'contract_paid' || att.meeting_status === 'contract_paid';
  const isAprovado = att.r2_status_name?.toLowerCase().includes('aprovado');
  
  // Caso 1: Contrato Pago
  if (isContractPaid) { /* ... mantém igual ... */ }
  
  // Caso 2: Aprovado
  if (isAprovado) { /* ... mantém igual ... */ }
  
  // Caso 3: Tem status R2 definido (Em análise, Reprovado, etc)
  if (att.r2_status_name) {
    return (
      <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500 text-purple-500">
        {att.r2_status_name}
      </Badge>
    );
  }
  
  // Caso 4: Sem status R2 - Mostra posição (Realizada, No-show, Agendada)
  const positionInfo = STATUS_LABELS[att.status] || STATUS_LABELS[att.meeting_status] || STATUS_LABELS.scheduled;
  
  return (
    <Badge variant="outline" className={cn('text-xs', positionInfo.className)}>
      {positionInfo.label}
    </Badge>
  );
}
```

---

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/R2AgendadasList.tsx` | Corrigir larguras, adicionar opção "Sem status", melhorar badges |

---

## Resultado Esperado

### Filtro de Status com todas as opções:
```
▼ Todos Status
  ✓ Todos Status
  Pendente (Sem avaliação)   ← NOVO
  Aprovado
  Em análise
  Reprovado
  Desistente
  ...
```

### Coluna Status mostrando corretamente:
| Situação | Badge Exibido |
|----------|---------------|
| Contrato pago + Aprovado | `CP 28/01` + `Aprovado` |
| Aprovado (sem CP) | `Aprovado` (verde) |
| Reprovado/Desistente | `Reprovado` / `Desistente` (roxo) |
| Sem avaliação + Realizada | `Realizada` (verde) |
| Sem avaliação + No-show | `No-show` (vermelho) |
| Sem avaliação + Agendada | `Agendada` (azul) |

### Coluna Closer alinhada:
```
| Closer R2         |
|-------------------|
| ● Jessica Bellini |
| ● Jessica Bellini |
| ● Thobson Motta   |
```

Todas as linhas com alinhamento consistente graças à largura fixa.
