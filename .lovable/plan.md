
# Plano: Conectar Meta de Contratos e Fonte de Dados da Agenda

## Status: ✅ IMPLEMENTADO

## Resumo das Mudanças

### 1. Meta de contratos agora vem das métricas ativas
- `Detail.tsx` busca `activeMetrics` via `useActiveMetricsForSdr`
- Extrai `meta_valor` da métrica "contratos" → `metaContratosDiaria`
- Passa ao `KpiEditForm` via prop

### 2. Contratos e Vendas Parceria vêm da Agenda
- `useSdrAgendaMetricsBySdrId` agora retorna `contratos` e `vendas_parceria`
- `Detail.tsx` usa `agendaMetrics.data?.contratos` para Closers
- Labels atualizados para "Auto (Agenda)" em vez de "Auto (Hubla)"

### 3. KpiEditForm mostra fonte correta
- Campo "Contratos Pagos": mostra `(da Agenda)` e valor da agenda
- Campo "Vendas Parceria": mostra `(da Agenda)` e valor da agenda
- Meta calculada: `metaContratosDiaria × diasUteisMes`

---

## Onde Configurar Meta de Contrato por Dia

**Localização:** `/fechamento-sdr` → Aba "Métricas Ativas"

1. Selecione o **Cargo** (ex: "Closer Inside N1")
2. Ative a métrica **"Contratos Pagos"**
3. No campo **"Meta"**, digite o valor diário (ex: `1` para 1 contrato/dia)
4. Clique em **Salvar**

O sistema calcula: `Meta Mensal = Meta Diária × Dias Úteis`

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrAgendaMetricsBySdrId.ts` | Adicionado `vendas_parceria` ao retorno |
| `src/pages/fechamento-sdr/Detail.tsx` | Busca métricas ativas, passa `metaContratosDiaria` e `vendasParceria` |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Labels atualizados para "Auto (Agenda)" |
