

# Correção de Nomenclatura: KPI vs Tab R2

## Problema Atual

| Local | Valor | O que conta |
|-------|-------|-------------|
| KPI "R2 Agendadas" | 16 | Apenas attendees em reuniões **ainda não realizadas** (scheduled, invited, pending) |
| Tab "R2 Agendadas" | 60 | **Todas** as R2 da semana (realizadas + pendentes) |

A nomenclatura igual ("R2 Agendadas") confunde, pois medem coisas diferentes.

---

## Solução Proposta

### Opção recomendada: Renomear para clareza

| Atual | Novo Nome | Significado |
|-------|-----------|-------------|
| KPI "R2 Agendadas" | **"R2 Pendentes"** | Reuniões que ainda vão acontecer |
| Tab "R2 Agendadas" | **"Todas R2s"** | Todas as R2 da semana (para gestão) |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/crm/R2Carrinho.tsx` | Renomear KPI para "R2 Pendentes" e tab para "Todas R2s" |

---

## Alterações

### 1. Renomear KPI (linha 82)

```typescript
// Antes
{ label: 'R2 Agendadas', value: kpis?.r2Agendadas ?? 0, color: 'bg-indigo-500' },

// Depois
{ label: 'R2 Pendentes', value: kpis?.r2Agendadas ?? 0, color: 'bg-indigo-500' },
```

### 2. Renomear Tab (linhas 147-152)

```typescript
// Antes
<TabsTrigger value="agendadas" className="flex items-center gap-2">
  R2 Agendadas
  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
    {agendadasData.length}
  </span>
</TabsTrigger>

// Depois  
<TabsTrigger value="agendadas" className="flex items-center gap-2">
  📋 Todas R2s
  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
    {agendadasData.length}
  </span>
</TabsTrigger>
```

---

## Resultado Esperado

```text
KPIs:
+----------------+---------------+---------------+------------------+-----------+
| Contratos (R1) | R2 Pendentes  | R2 Realizadas | Fora do Carrinho | Aprovados |
|      0         |     16        |      44       |        8         |    22     |
+----------------+---------------+---------------+------------------+-----------+

Tabs:
[ 📋 Todas R2s (60) ] [ Fora do Carrinho (8) ] [ ✓ Aprovados (22) ] [ 💰 Vendas ] [ 📊 Métricas ]
```

Agora fica claro:
- **KPI "R2 Pendentes"**: 16 reuniões ainda vão acontecer
- **Tab "Todas R2s"**: 60 attendees na semana (para acompanhamento geral)
- **KPI "Aprovados"**: 22 leads aprovados

