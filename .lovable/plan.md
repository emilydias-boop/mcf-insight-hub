
# Plano: Corrigir Sobrescrita de KPIs Manuais no Fechamento

## Problema Identificado

O botão "Salvar e Recalcular" está apagando os valores manuais de **Reuniões Agendadas** e **Reuniões Realizadas** porque:

1. O frontend salva corretamente os valores digitados (ex: 217 agendadas, 157 realizadas)
2. Após salvar, chama a edge function `recalculate-sdr-payout`
3. A edge function busca dados na RPC `get_sdr_metrics_from_agenda`
4. Para SDRs do Consórcio (como Cleiton Lima), a RPC retorna 0 (pois usam outra fonte de dados)
5. A edge function **sobrescreve os valores manuais** com os dados da Agenda:

```typescript
// Linha 493-500 da edge function - PROBLEMA AQUI
const updateFields = {
  reunioes_agendadas: reunioesAgendadas,    // Sobrescreve valor manual com 0!
  reunioes_realizadas: reunioesRealizadas,  // Sobrescreve valor manual com 0!
  no_shows: noShows,
  taxa_no_show: taxaNoShow,
};
```

## Solução Proposta

Modificar a edge function para **preservar valores manuais quando já existem dados no KPI**:

```text
┌──────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (com bug)                     │
├──────────────────────────────────────────────────────────────┤
│ Frontend salva KPI (agendadas=217)                           │
│     ↓                                                        │
│ Edge function busca Agenda (retorna 0)                       │
│     ↓                                                        │
│ SOBRESCREVE: reunioes_agendadas = 0  ❌                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   FLUXO CORRIGIDO                            │
├──────────────────────────────────────────────────────────────┤
│ Frontend salva KPI (agendadas=217)                           │
│     ↓                                                        │
│ Edge function busca Agenda (retorna 0)                       │
│     ↓                                                        │
│ PRESERVA: reunioes_agendadas = 217 (valor do KPI) ✅         │
│ (Só sobrescreve se valor da Agenda > 0)                      │
└──────────────────────────────────────────────────────────────┘
```

## Implementação Técnica

### Arquivo a Modificar:
`supabase/functions/recalculate-sdr-payout/index.ts`

### Mudança (linhas ~493-500):

**Antes:**
```typescript
const updateFields: Record<string, unknown> = {
  reunioes_agendadas: reunioesAgendadas,
  reunioes_realizadas: reunioesRealizadas,
  no_shows: noShows,
  taxa_no_show: taxaNoShow,
  updated_at: new Date().toISOString(),
};
```

**Depois:**
```typescript
// PRESERVAR valores manuais se Agenda não tiver dados
// Só sobrescrever se a Agenda retornou valores > 0
const updateFields: Record<string, unknown> = {
  // Agendadas: usar Agenda apenas se > 0, senão manter valor existente
  reunioes_agendadas: reunioesAgendadas > 0 
    ? reunioesAgendadas 
    : existingKpi.reunioes_agendadas,
  
  // Realizadas: usar Agenda apenas se > 0, senão manter valor existente
  reunioes_realizadas: reunioesRealizadas > 0 
    ? reunioesRealizadas 
    : existingKpi.reunioes_realizadas,
  
  // No-shows: manter lógica atual (pode ser 0 legitimamente)
  // Só atualizar se reunioes_agendadas veio da Agenda
  no_shows: reunioesAgendadas > 0 
    ? noShows 
    : existingKpi.no_shows,
  
  // Taxa recalculada com base nos valores finais
  taxa_no_show: reunioesAgendadas > 0 
    ? taxaNoShow 
    : existingKpi.taxa_no_show,
  
  updated_at: new Date().toISOString(),
};

console.log(`   📊 Valores finais: Agendadas=${updateFields.reunioes_agendadas}, Realizadas=${updateFields.reunioes_realizadas} (${reunioesAgendadas > 0 ? 'Agenda' : 'Manual'})`);
```

## Comportamento Após Correção

| Cenário | Antes | Depois |
|---------|-------|--------|
| SDR com dados na Agenda | Usa Agenda ✅ | Usa Agenda ✅ |
| SDR manual (Consórcio) | Apaga valores ❌ | Preserva valores ✅ |
| SDR sem dados (novo) | Cria com 0 ✅ | Cria com 0 ✅ |

## Teste de Validação

1. Acessar fechamento de Cleiton Lima (janeiro 2026)
2. Inserir valores manuais:
   - Agendadas: 217
   - Realizadas: 157
   - Organização: 100
3. Clicar em "Salvar e Recalcular"
4. **Esperado**: Valores mantidos, percentuais calculados corretamente
5. **Esperado**: Agendamentos = 217 / 140 = 155% → mult 1.5x
