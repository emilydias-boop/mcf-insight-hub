

# Plano: Deduplicar Total Leads e Criar Métrica de Leads Ativos

## Problema Identificado

| Situação Atual | Problema |
|----------------|----------|
| **Total Leads = 80** | Conta cada registro de attendee, incluindo duplicatas de reagendamentos |
| **Mesmo lead** | Pode aparecer 2-3x se foi reagendado ou tem múltiplas reuniões |
| **Resultado** | Números inflados que não refletem a realidade |

### Exemplo do Problema

```text
Lead: Igor Willian
- R2 em 24/01 → No-show ⚠️
- R2 em 27/01 → Reagendado (Aprovado) ✅

Contagem atual: 2 leads
Contagem correta: 1 lead único
```

---

## Solução Proposta

Criar **deduplicação por deal_id** e adicionar 2 métricas claras:

| Métrica | Descrição |
|---------|-----------|
| **Total Leads** | Leads únicos que passaram pelo R2 (deduplicados por deal_id) |
| **No Carrinho** | Leads únicos ativos = Total - Reembolsos - No-Show - Próx. Semana - Desistentes - Reprovados |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useR2MetricsData.ts` | Adicionar deduplicação por deal_id e nova métrica `leadsAtivos` |
| `src/components/crm/R2MetricsPanel.tsx` | Exibir "No Carrinho" ao lado de "Total Leads" |

---

## Implementação Técnica

### useR2MetricsData.ts - Deduplicação

```typescript
// Interface atualizada
export interface R2MetricsData {
  totalLeads: number;      // Leads ÚNICOS que passaram pelo R2
  leadsAtivos: number;     // Leads únicos realmente no carrinho
  // ... resto das métricas
}

// Lógica de deduplicação
// Criar Map para agrupar attendees por deal_id
const leadsByDeal = new Map<string, {
  deal_id: string;
  status: string;
  r2_status: string;
  scheduled_at: string;
}>();

meetings?.forEach(meeting => {
  attendees.forEach(att => {
    const key = att.deal_id || att.id; // Usar ID se não tiver deal
    const existing = leadsByDeal.get(key);
    
    // Manter o registro mais recente ou o mais relevante
    if (!existing || new Date(meeting.scheduled_at) > new Date(existing.scheduled_at)) {
      leadsByDeal.set(key, {
        deal_id: key,
        status: att.status,
        r2_status: statusMap.get(att.r2_status_id) || '',
        scheduled_at: meeting.scheduled_at
      });
    }
  });
});

// Total = leads únicos
const totalLeads = leadsByDeal.size;

// Contar por status (usando leads únicos)
let desistentes = 0, reembolsos = 0, reprovados = 0, proximaSemana = 0, noShow = 0, aprovados = 0;

leadsByDeal.forEach(lead => {
  if (lead.r2_status.includes('desistente')) desistentes++;
  else if (lead.r2_status.includes('reembolso')) reembolsos++;
  // ... etc
});

// Leads ativos = total - perdidos
const leadsPerdidos = desistentes + reembolsos + reprovados + proximaSemana + noShow;
const leadsAtivos = totalLeads - leadsPerdidos;
```

### R2MetricsPanel.tsx - Nova Exibição

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEADS DO CARRINHO                                                           │
├─────────────┬─────────────┬───────────┬───────────┬───────────┬─────────────┤
│ Total Leads │ No Carrinho │ Desist.   │ Reemb.    │ Reprov.   │ ...         │
│     54      │     42      │     0     │     6     │     0     │             │
│  (únicos)   │  (ativos)   │           │           │           │             │
└─────────────┴─────────────┴───────────┴───────────┴───────────┴─────────────┘
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Total Leads | 80 (inflado) | ~54 (únicos) |
| No Carrinho | Não existia | ~42 (ativos) |
| Perdidos % | Calculado sobre 80 | Calculado sobre 54 |

### Lógica de Deduplicação

```text
Para cada lead (deal_id):
1. Se tem múltiplas reuniões → manter a mais recente
2. Se foi reagendado → contar como 1 lead com o status atual
3. Se fez no-show e depois participou → contar como 1 lead (status atual)
```

---

## Impacto nas Outras Métricas

| Métrica | Impacto |
|---------|---------|
| Desistentes | Agora conta leads únicos |
| Reembolsos | Agora conta leads únicos |
| No-Show | Exclui reagendados corretamente |
| Aprovados | Já estava deduplicado (confirmado) |
| % Perdidos | Agora usa base correta (total único) |

