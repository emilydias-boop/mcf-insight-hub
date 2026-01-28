
# Ajustes no Carrinho R2 - Dados, Contagem e Exportação

## Problemas Identificados

### 1. No-Show Mostra 16, Real é 7
**Causa raiz:** O hook `useR2MetricsData` conta no-shows diretamente pelo status `att.status === 'no_show'` sem excluir:
- Quem já reagendou (tem `parent_attendee_id` apontando para o registro original)
- Quem solicitou reembolso (flag `reembolso_solicitado` no deal)

O hook `useR2NoShowLeads` já faz essa exclusão corretamente, mas `useR2MetricsData` não.

### 2. Próxima Semana / Reprovados / Desistentes
Os números no banco de dados atual (17-23/01):
- Aprovados: 48
- Desistentes: 3 (sistema mostra 2, falta 1)
- Reembolso: 8
- Reprovados: 2 (sistema mostra 2, esperado 3)
- Próxima Semana: 0 (esperado 3)

**Ação:** Verificar se os status foram marcados corretamente na interface. Se não estiverem, é um problema de dados que precisa ser corrigido manualmente na UI do R2.

### 3. Lógica de "Reembolsos" (Fluxo de Reembolso)
O usuário quer que o card "Reembolsos" seja calculado como a **soma de Reprovados + Desistentes** (leads que vão/já solicitaram reembolso).

### 4. Cálculo de Leads Perdidos (Sem Duplicidade)
Fórmula atual causa duplicidade:
```
leadsPerdidos = desistentes + reprovados + reembolsos + noShow
```
O mesmo lead pode estar em "Reembolso" e também ser "no_show".

**Nova fórmula:** 
```
leadsPerdidos = foraDoCarrinho (que já agrupa todos esses status) + noShow_limpos
```

### 5. Exportação de Lista (Agenda R2)
Implementar função para exportar a lista de agendamentos com **nomes e telefones** (demanda da Bruna às segundas).

### 6. Formatação do Relatório "Copiar"
Remover os números/índices de cada linha da lista de quem não comprou.
Manter apenas o total no cabeçalho.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useR2MetricsData.ts` | Corrigir contagem de no-show (excluir reagendados/reembolsados) |
| `src/hooks/useR2MetricsData.ts` | Ajustar cálculo de "Reembolsos" para ser Reprovados + Desistentes |
| `src/hooks/useR2MetricsData.ts` | Corrigir fórmula de Leads Perdidos sem duplicidade |
| `src/components/crm/R2AprovadosList.tsx` | Remover índices numéricos do relatório copiado |
| `src/pages/crm/AgendaR2.tsx` | Adicionar botão de exportar lista |
| `src/components/crm/R2ListViewTable.tsx` | Implementar função de exportação com nomes/telefones |

---

## Detalhamento das Mudanças

### Parte 1: Corrigir No-Show em useR2MetricsData

Adicionar verificação de reagendamento e reembolso antes de contar no-show:

```typescript
// 1. Coletar IDs de no-shows
const noShowIds = allAttendees
  .filter(att => att.status === 'no_show')
  .map(att => att.id);

// 2. Buscar quais foram reagendados (têm filho com parent_attendee_id)
const { data: rescheduledChildren } = await supabase
  .from('meeting_slot_attendees')
  .select('parent_attendee_id')
  .in('parent_attendee_id', noShowIds);

const rescheduledIds = new Set(rescheduledChildren?.map(c => c.parent_attendee_id));

// 3. Buscar deals com reembolso_solicitado
const noShowDealIds = allAttendees
  .filter(att => att.status === 'no_show' && att.deal_id)
  .map(att => att.deal_id);

const { data: refundedDeals } = await supabase
  .from('crm_deals')
  .select('id, custom_fields')
  .in('id', noShowDealIds);

const refundedDealIds = new Set(
  refundedDeals?.filter(d => d.custom_fields?.reembolso_solicitado).map(d => d.id)
);

// 4. Contar no-shows excluindo reagendados e reembolsados
const noShow = allAttendees.filter(att => 
  att.status === 'no_show' &&
  !rescheduledIds.has(att.id) &&
  !refundedDealIds.has(att.deal_id)
).length;
```

### Parte 2: Ajustar Cálculo de "Reembolsos"

O card "Reembolsos" mostrará a soma de Reprovados + Desistentes:

```typescript
// Fluxo de reembolso = leads que vão solicitar/já solicitaram reembolso
const fluxoReembolso = reprovados + desistentes;

// Atualizar interface para mostrar "Reembolsos" como fluxoReembolso
```

### Parte 3: Corrigir Leads Perdidos

Evitar duplicidade na soma:

```typescript
// Leads "fora do carrinho" já estão categorizados por status R2
// No-shows são categoria separada (status do attendee, não do R2)
// Não somar "reembolsos" como categoria separada pois será Reprovados+Desistentes

const leadsPerdidosCount = desistentes + reprovados + proximaSemana + noShow;
const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidosCount / totalLeads) * 100 : 0;
```

### Parte 4: Remover Índices do Relatório

Em `R2AprovadosList.tsx`, função `generateReport`:

**Antes:**
```typescript
displayedAttendees.forEach((att, idx) => {
  report += `${idx + 1} ${name}\t${phone}\t*Aprovado*\t${closer}${suffix}\n`;
});
```

**Depois:**
```typescript
report += `*SELECIONADOS ${attendees.length}*\n\n`;
report += `LISTA DOS QUE NÃO COMPRARAM AINDA: ${displayedAttendees.length}\n\n`;

displayedAttendees.forEach((att) => {
  report += `${name}\t${phone}\t${closer}${suffix}\n`;
});
```

### Parte 5: Exportação de Lista (Agenda R2)

Adicionar botão "Exportar Lista" no header da Agenda R2 e na R2ListViewTable:

```typescript
const handleExportList = () => {
  const headers = ['Nome', 'Telefone', 'Closer', 'Data/Hora', 'Status'];
  const rows = meetings.map(m => {
    const att = m.attendees?.[0];
    return [
      att?.name || att?.deal?.name || 'Sem nome',
      att?.phone || att?.deal?.contact?.phone || '-',
      m.closer?.name || '-',
      format(new Date(m.scheduled_at), 'dd/MM HH:mm'),
      m.status
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Download CSV
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `agenda-r2-${format(new Date(), 'dd-MM-yyyy')}.csv`;
  link.click();
};
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| No-Show | 16 (com reagendados) | 7 (limpo) |
| Reembolsos | 8 (status separado) | Reprovados + Desistentes |
| Leads Perdidos | Com duplicidade | Soma única |
| Relatório Aprovados | Com índices (1, 2, 3...) | Só total no topo |
| Agenda R2 | Sem export | Com botão "Exportar Lista" |

---

## Sequência de Implementação

1. Corrigir `useR2MetricsData.ts` - contagem de no-show
2. Ajustar cálculo de Reembolsos e Leads Perdidos
3. Modificar `R2AprovadosList.tsx` - remover índices do relatório
4. Adicionar exportação em `R2ListViewTable.tsx`
5. Adicionar botão de export em `AgendaR2.tsx`
