
# Plano: Sistema de Indicadores 100% Dinâmico Baseado em Métricas Ativas

## Resumo do Problema

1. **Popup "Editar Plano Individual"** exibe campos fixos de SDR (Agendadas, Realizadas, Tentativas, Organização) mesmo para Closers
2. **Tela de detalhe do fechamento** não consome as métricas ativas configuradas - usa lógica hardcoded
3. **Cálculo do payout (edge function)** já busca métricas ativas, mas UI não está sincronizada
4. **Julio (Closer Inside)** está com `role_type = 'closer'` no banco, mas a UI não adapta os campos corretamente

## Solução: Sistema 100% Dinâmico

O sistema passará a consumir integralmente as métricas configuradas em `fechamento_metricas_mes` para:
- Exibir inputs corretos no formulário KPI
- Mostrar indicadores corretos na página de detalhe
- Exibir campos corretos no popup de edição de plano
- Calcular payout proporcionalmente aos pesos configurados

---

## Alterações Técnicas

### 1. Novo Hook: `useActiveMetricsForSdr`

Criar hook que busca métricas ativas para um colaborador específico baseado no `cargo_catalogo_id` do employee vinculado.

**Arquivo:** `src/hooks/useActiveMetricsForSdr.ts`

```typescript
// Busca métricas ativas para um SDR/Closer específico
// Usa: sdr_id → employees.cargo_catalogo_id → fechamento_metricas_mes
export const useActiveMetricsForSdr = (sdrId: string, anoMes: string) => {
  // 1. Buscar employee vinculado ao SDR
  // 2. Obter cargo_catalogo_id e squad
  // 3. Buscar métricas ativas para cargo/squad/mês
  return { metricas, isLoading, fonte: 'configuradas' | 'fallback' };
};
```

---

### 2. Adaptar `KpiEditForm.tsx`

Modificar para renderizar dinamicamente os campos baseado nas métricas ativas.

**Mudanças:**
- Adicionar prop `sdrId` para buscar métricas ativas
- Substituir campos hardcoded por mapeamento dinâmico:
  - `realizadas` → Campo R1 Realizadas (agenda)
  - `contratos` → Campo Contratos Pagos (hubla)
  - `r2_agendadas` → Campo R2 Agendadas (agenda)
  - `organizacao` → Campo Organização (manual)
  - `tentativas` → Campo Tentativas (twilio)
  - `agendamentos` → Campo Agendadas R1 (agenda)
  - `no_show` → Campo No-Shows (agenda)

**Lógica:**
```typescript
const { metricas } = useActiveMetricsForSdr(sdrId, anoMes);

// Renderizar apenas campos das métricas ativas
{metricas.map(m => (
  <DynamicKpiField 
    key={m.nome_metrica}
    metrica={m}
    value={getKpiValue(m.nome_metrica)}
    onChange={handleChange}
  />
))}
```

---

### 3. Adaptar `EditIndividualPlanDialog.tsx`

Modificar para exibir campos de valor por métrica baseado nas métricas ativas do cargo.

**Mudanças:**
- Adicionar prop `cargoId` e `anoMes`
- Buscar métricas ativas para o cargo
- Renderizar campos "Valores por Métrica" dinamicamente

**Antes (hardcoded):**
```
Agendadas (R$) | Realizadas (R$) | Tentativas (R$) | Organização (R$)
```

**Depois (dinâmico):**
```
// Para Closer Inside com métricas: realizadas, contratos, r2_agendadas, organizacao
R1 Realizadas (R$) | Contratos Pagos (R$) | R2 Agendadas (R$) | Organização (R$)
```

---

### 4. Adaptar `Detail.tsx` (Indicadores)

Modificar para renderizar indicadores baseado nas métricas ativas.

**Mudanças:**
- Buscar métricas ativas do colaborador
- Renderizar `<DynamicIndicatorCard>` para cada métrica ativa
- Remover lógica `isCloser ? <CloserIndicators> : <SdrIndicators>`

**Nova lógica:**
```typescript
const { metricas } = useActiveMetricsForSdr(payout.sdr_id, payout.ano_mes);

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  {metricas.map(m => (
    <DynamicIndicatorCard
      key={m.nome_metrica}
      metrica={m}
      kpi={kpi}
      payout={payout}
      compPlan={compPlan}
    />
  ))}
</div>
```

---

### 5. Novo Componente: `DynamicIndicatorCard`

Criar componente que renderiza o indicador correto baseado no tipo de métrica.

**Arquivo:** `src/components/fechamento/DynamicIndicatorCard.tsx`

| nome_metrica | Componente/Exibição |
|--------------|---------------------|
| agendamentos | SdrIndicatorCard (reunioes_agendadas) |
| realizadas | SdrIndicatorCard (reunioes_realizadas) |
| tentativas | SdrIndicatorCard (tentativas_ligacoes) |
| organizacao | SdrIndicatorCard (score_organizacao) |
| no_show | NoShowIndicator (inverso) |
| contratos | Card simples (intermediacoes_contrato) |
| r2_agendadas | Card simples (r2_agendadas) |
| outside_sales | Card simples (outside_sales) |

---

### 6. Expandir `sdr_month_kpi` (se necessário)

Verificar se a tabela já possui campos para R2 Agendadas e Outside Sales.

**Campos potenciais a adicionar:**
- `r2_agendadas: number` (se não existir)
- `outside_sales: number` (se não existir)

---

### 7. Atualizar Edge Function (ajuste fino)

A edge function já busca métricas ativas. Ajustar para:
- Incluir `r2_agendadas` e `outside_sales` no cálculo quando configurados
- Garantir que métricas não configuradas não zerem o variável

---

## Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `src/hooks/useActiveMetricsForSdr.ts` | Hook para buscar métricas ativas de um colaborador |
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Renderiza indicador baseado na métrica |
| `src/components/fechamento/DynamicKpiField.tsx` | Campo de input baseado na métrica |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Usar métricas ativas para renderizar campos |
| `src/components/fechamento/EditIndividualPlanDialog.tsx` | Campos de valor dinâmicos |
| `src/pages/fechamento-sdr/Detail.tsx` | Indicadores dinâmicos |
| `supabase/functions/recalculate-sdr-payout/index.ts` | Incluir r2_agendadas e outside_sales |

---

## Fluxo Visual

```text
┌──────────────────────────────────────────────────────────────┐
│              CONFIGURAÇÃO (Aba Métricas Ativas)              │
├──────────────────────────────────────────────────────────────┤
│ Cargo: Closer Inside │ BU: Incorporador │ Mês: 2026-01       │
│                                                              │
│ ☑ R1 Realizadas (25%) - fonte: agenda                        │
│ ☑ Contratos Pagos (25%) - fonte: hubla                       │
│ ☑ R2 Agendadas (25%) - fonte: agenda                         │
│ ☑ Organização (25%) - fonte: manual                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              POPUP EDITAR PLANO INDIVIDUAL                   │
├──────────────────────────────────────────────────────────────┤
│ Julio Caetano • Closer Inside                                │
│                                                              │
│ OTE: R$ 4.000  │  Fixo: R$ 2.800  │  Variável: R$ 1.200     │
│                                                              │
│ Valores por Métrica (dinâmico):                              │
│ ┌─────────────────┬─────────────────┐                        │
│ │ R1 Realizadas   │ Contratos Pagos │                        │
│ │ R$ 300          │ R$ 300          │                        │
│ ├─────────────────┼─────────────────┤                        │
│ │ R2 Agendadas    │ Organização     │                        │
│ │ R$ 300          │ R$ 300          │                        │
│ └─────────────────┴─────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              TELA DE DETALHE DO FECHAMENTO                   │
├──────────────────────────────────────────────────────────────┤
│ Julio • Closer • Fechamento 2026-01                          │
│                                                              │
│ Editar KPIs (campos dinâmicos):                              │
│ ┌─────────────────┬─────────────────┐                        │
│ │ R1 Realizadas   │ Contratos Pagos │                        │
│ │ [63]            │ [0] (Hubla)     │                        │
│ ├─────────────────┼─────────────────┤                        │
│ │ R2 Agendadas    │ Organização     │                        │
│ │ [12]            │ [85] (Manual)   │                        │
│ └─────────────────┴─────────────────┘                        │
│                                                              │
│ Indicadores de Meta (dinâmicos):                             │
│ ┌────────────┬────────────┬────────────┬────────────┐        │
│ │ R1 Realiz. │ Contratos  │ R2 Agend.  │ Organiz.   │        │
│ │ 74.0%      │ 0          │ 12         │ 85.0%      │        │
│ │ 0.5x       │ (Hubla)    │ (Agenda)   │ 0.5x       │        │
│ │ R$ 150     │            │            │ R$ 150     │        │
│ └────────────┴────────────┴────────────┴────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

---

## Normalização de Nomes (Banco)

Os nomes de métricas já estão consistentes no banco:
- `agendamentos` → Agendamentos R1
- `realizadas` → R1 Realizadas
- `contratos` → Contratos Pagos
- `tentativas` → Tentativas de Ligação
- `organizacao` → Organização
- `no_show` → No-Show (inverso)
- `r2_agendadas` → R2 Agendadas

Não é necessária migração de dados.

---

## Resultado Esperado

Após implementação:

1. **Julio (Closer Inside)** verá:
   - No popup: campos R1 Realizadas, Contratos, R2 Agendadas, Organização
   - Na edição de KPIs: mesmos campos dinâmicos
   - Nos indicadores: cards correspondentes às 4 métricas configuradas

2. **SDR Inside N1** verá:
   - No popup: campos Agendadas, Realizadas, Tentativas, Organização
   - Na edição de KPIs: campos padrão SDR
   - Nos indicadores: cards correspondentes

3. **Qualquer novo cargo**: basta configurar as métricas na aba "Métricas Ativas" e o sistema se adapta automaticamente
