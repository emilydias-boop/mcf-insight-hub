
# Plano: Renomear "Reuniões Agendadas" para "Agendamento"

## Visão Geral

Alterar o label do indicador de "Reuniões Agendadas" para "Agendamento" em todos os componentes de fechamento SDR, mantendo os dados e cálculos inalterados.

---

## Arquivos a Modificar

| Arquivo | Local | Alteração |
|---------|-------|-----------|
| `src/components/fechamento/SdrFechamentoView.tsx` | Linha 126 | "Reuniões Agendadas" → "Agendamento" |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Linha 359 | "Reuniões Agendadas" → "Agendamento" |
| `src/pages/fechamento-sdr/Detail.tsx` | Linha 219 (export CSV) | "Reuniões Agendadas" → "Agendamento" |
| `src/pages/fechamento-sdr/Index.tsx` | Linhas 225, 231 | "% Reuniões Agendadas" → "% Agendamento"<br>"Valor Reuniões Agendadas" → "Valor Agendamento" |
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Linhas 203, 476 | "Reuniões Agendadas" → "Agendamento" |

---

## Detalhes das Mudanças

### 1. SdrFechamentoView.tsx (Resumo dos Indicadores)
```tsx
// Linha 126: ANTES
<div className="text-xs text-muted-foreground/70">
  Reuniões Agendadas
</div>

// DEPOIS
<div className="text-xs text-muted-foreground/70">
  Agendamento
</div>
```

### 2. KpiEditForm.tsx (Edição de KPIs)
```tsx
// Linha 359: ANTES
<Label htmlFor="reunioes_agendadas" className="...">
  Reuniões Agendadas
  ...
</Label>

// DEPOIS
<Label htmlFor="reunioes_agendadas" className="...">
  Agendamento
  ...
</Label>
```

### 3. Detail.tsx (Exportação CSV Individual)
```tsx
// Linha 219: ANTES
`Reuniões Agendadas;${compPlan?.meta_reunioes_agendadas || 0};...`

// DEPOIS
`Agendamento;${compPlan?.meta_reunioes_agendadas || 0};...`
```

### 4. Index.tsx (Exportação CSV em Lote)
```tsx
// Linha 225: ANTES
"% Reuniões Agendadas",

// DEPOIS
"% Agendamento",

// Linha 231: ANTES
"Valor Reuniões Agendadas",

// DEPOIS
"Valor Agendamento",
```

### 5. Configuracoes.tsx (Notas Informativas)
```tsx
// Linhas 203 e 476: ANTES
<strong>Metas automáticas:</strong> Reuniões Agendadas usa meta diária...

// DEPOIS
<strong>Metas automáticas:</strong> Agendamento usa meta diária...
```

---

## O Que NÃO Muda

- **Nomes de campos no banco de dados**: `reunioes_agendadas` permanece igual
- **Nomes de variáveis no código**: `formData.reunioes_agendadas`, `kpi.reunioes_agendadas`, etc.
- **Cálculos e lógica de negócio**: Toda a lógica de métricas permanece inalterada
- **Dados puxados da Agenda**: Continuam vindo do hook `useSdrAgendaMetricsBySdrId`

---

## Resultado Visual

### Card de Indicadores (Antes)
```text
┌────────────────┐ ┌────────────────┐
│ Reuniões       │ │ Reuniões       │
│ Agendadas      │ │ Realizadas     │
│    85.5%       │ │    92.0%       │
└────────────────┘ └────────────────┘
```

### Card de Indicadores (Depois)
```text
┌────────────────┐ ┌────────────────┐
│ Agendamento    │ │ Reuniões       │
│    85.5%       │ │ Realizadas     │
│ Mult: 0.9x     │ │    92.0%       │
└────────────────┘ └────────────────┘
```

---

## Resumo Técnico

- **5 arquivos** modificados
- **6 ocorrências** de texto alteradas
- **Zero impacto** em lógica ou dados
- Apenas mudança de nomenclatura (label display)
