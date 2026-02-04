
# Plano: Adicionar Métrica "Agendamento" ao Painel de Fechamento

## Contexto

Existem duas métricas diferentes:
- **Agendamento** (`agendamentos`): Reuniões **criadas no período** (produção do SDR) - usa `created_at`/`booked_at`
- **R1 Agendada** (`r1_agendada`): Reuniões **marcadas para o período** - usa `scheduled_at`

A RPC `get_sdr_metrics_from_agenda` já retorna ambas, mas o hook `useSdrAgendaMetricsBySdrId` só captura `r1_agendada`. O painel de fechamento atualmente usa `r1_agendada` para calcular o KPI "Reuniões Agendadas", quando deveria usar `agendamentos`.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrAgendaMetricsBySdrId.ts` | Adicionar `agendamentos` ao retorno |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Usar `agendamentos` no campo "Agendamento" |

---

## Detalhes da Implementação

### 1. useSdrAgendaMetricsBySdrId.ts

Adicionar `agendamentos` à interface e ao retorno:

```typescript
// Interface atualizada (linha 5-11)
export interface SdrAgendaMetricsById {
  agendamentos: number;    // NOVO: reuniões criadas no período
  r1_agendada: number;
  r1_realizada: number;
  no_shows: number;
  contratos: number;
  vendas_parceria: number;
}

// Retorno atualizado (linhas 18, 30, 48, 62)
return { agendamentos: 0, r1_agendada: 0, r1_realizada: 0, ... };

// Extrair da response (linha 52-58)
const response = data as unknown as { metrics: Array<{
  agendamentos: number;  // NOVO
  r1_agendada: number;
  ...
}> };

// Retorno final (linha 62-68)
return {
  agendamentos: metrics?.agendamentos || 0,  // NOVO
  r1_agendada: metrics?.r1_agendada || 0,
  ...
};
```

### 2. KpiEditForm.tsx

Alterar o campo de "Agendamento" para usar `agendamentos` em vez de `r1_agendada`:

```tsx
// Onde mostra o valor automático da Agenda para "Agendamento" (linha ~380)
// ANTES:
autoValue={agendaMetrics.data?.r1_agendada}

// DEPOIS:
autoValue={agendaMetrics.data?.agendamentos}
```

---

## Fluxo de Dados Corrigido

```text
RPC get_sdr_metrics_from_agenda
        │
        ├── agendamentos ────► useSdrAgendaMetricsBySdrId ────► KpiEditForm
        │                      (NOVO campo adicionado)          (Campo "Agendamento")
        │
        └── r1_agendada ────► (não usado no fechamento)
```

---

## Resultado Visual

O campo "Agendamento" no painel de fechamento passará a mostrar:
- **Antes**: Reuniões marcadas PARA o mês (scheduled_at)
- **Depois**: Reuniões criadas pelo SDR no mês (booked_at) - métrica de produtividade

Isso alinha o painel de fechamento com os outros painéis (Reuniões Equipe, Tabela SDR).

---

## Resumo Técnico

- **2 arquivos** modificados
- **1 campo** adicionado ao hook (`agendamentos`)
- **1 referência** atualizada no formulário
- **Zero impacto** em outros componentes (campo `r1_agendada` permanece disponível)
