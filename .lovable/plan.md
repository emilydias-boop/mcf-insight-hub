
# Plano: Corrigir Cálculo do Fechamento SDR - Edge Function sem Fallback

## Diagnóstico do Problema

O botão "Salvar e Recalcular" não está calculando os valores porque:

1. **Fluxo atual**: O frontend salva o KPI e chama a edge function `recalculate-sdr-payout`
2. **Problema na Edge Function**: A função busca o `sdr_comp_plan` vigente com esta query:

```sql
WHERE sdr_id = ? 
  AND vigencia_inicio <= '2026-01-01'
  AND (vigencia_fim IS NULL OR vigencia_fim >= '2026-01-01')
```

3. **Situação de Cleiton Lima**:
   - Plano mais recente: inicia em 2026-02-01 (fevereiro) - **não cobre janeiro**
   - Plano anterior: terminou em 2025-10-31 (outubro)
   - Resultado: **nenhum plano cobre janeiro 2026**

4. **Consequência**: A edge function encontra `compPlan = null` e executa `continue`, pulando o SDR sem calcular nada

## Evidência nos Logs

```
⚠️ Plano de compensação não encontrado para Cleiton Lima
⚠️ Nenhuma métrica encontrada na RPC para Cleiton Lima  
📊 Resultado: 0 processados, 0 erros
```

## Solução Proposta

### Opção 1: Corrigir Dados (Solução Imediata)

Ajustar o plano existente para cobrir janeiro 2026:

```sql
UPDATE sdr_comp_plan 
SET vigencia_inicio = '2026-01-01'
WHERE id = '52584bcf-e8ac-4da3-92ce-1a9299fb2f6b';
-- OU aprovar o plano PENDING
```

### Opção 2: Adicionar Fallback na Edge Function (Solução Definitiva)

Modificar a edge function `recalculate-sdr-payout` para usar a mesma lógica de fallback implementada no frontend:

1. Se não encontrar comp_plan vigente, buscar `cargo_catalogo` do employee
2. Se não houver cargo_catalogo, usar valores padrão por nível do SDR
3. Opcionalmente, criar um comp_plan automático para rastreabilidade

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/recalculate-sdr-payout/index.ts` | Adicionar lógica de fallback quando não encontrar comp_plan |

## Implementacao Tecnica

### Adicionar Constantes de Fallback (linhas ~55-65)

```typescript
const DEFAULT_OTE_BY_LEVEL: Record<number, { 
  ote_total: number; 
  fixo_valor: number; 
  variavel_total: number 
}> = {
  1: { ote_total: 4000, fixo_valor: 2800, variavel_total: 1200 },
  2: { ote_total: 4500, fixo_valor: 3150, variavel_total: 1350 },
  3: { ote_total: 5000, fixo_valor: 3500, variavel_total: 1500 },
  4: { ote_total: 5500, fixo_valor: 3850, variavel_total: 1650 },
  5: { ote_total: 6000, fixo_valor: 4200, variavel_total: 1800 },
};
```

### Modificar Lógica de Busca do Comp Plan (linhas ~358-361)

Antes:
```typescript
if (compError || !compPlan) {
  console.log(`⚠️ Plano de compensação não encontrado para ${sdr.name}`);
  continue;
}
```

Depois:
```typescript
let effectiveCompPlan = compPlan;

if (compError || !compPlan) {
  console.log(`⚠️ Plano vigente não encontrado para ${sdr.name}. Criando fallback...`);
  
  // Buscar nivel do SDR
  const { data: sdrFull } = await supabase
    .from('sdr')
    .select('nivel')
    .eq('id', sdr.id)
    .single();
  
  const nivel = sdrFull?.nivel || 1;
  const fallback = DEFAULT_OTE_BY_LEVEL[nivel] || DEFAULT_OTE_BY_LEVEL[1];
  
  // Tentar usar cargo_catalogo se disponível
  if (employeeData?.cargo_catalogo_id) {
    const { data: cargo } = await supabase
      .from('cargos_catalogo')
      .select('ote_total, fixo_valor, variavel_valor')
      .eq('id', employeeData.cargo_catalogo_id)
      .single();
    
    if (cargo && cargo.ote_total > 0) {
      fallback.ote_total = cargo.ote_total;
      fallback.fixo_valor = cargo.fixo_valor;
      fallback.variavel_total = cargo.variavel_valor;
    }
  }
  
  // Criar comp_plan implícito para o mês
  const newPlan = {
    sdr_id: sdr.id,
    vigencia_inicio: monthStart,
    vigencia_fim: monthEnd,
    ote_total: fallback.ote_total,
    fixo_valor: fallback.fixo_valor,
    variavel_total: fallback.variavel_total,
    valor_meta_rpg: Math.round(fallback.variavel_total * 0.35),
    valor_docs_reuniao: Math.round(fallback.variavel_total * 0.35),
    valor_tentativas: Math.round(fallback.variavel_total * 0.15),
    valor_organizacao: Math.round(fallback.variavel_total * 0.15),
    ifood_mensal: 150,
    ifood_ultrameta: 50,
    meta_reunioes_agendadas: 15,
    meta_reunioes_realizadas: 12,
    meta_tentativas: 400,
    meta_organizacao: 100,
    dias_uteis: calendarData?.dias_uteis_final || 22,
    meta_no_show_pct: 30,
    status: 'APPROVED',
  };
  
  const { data: createdPlan, error: createError } = await supabase
    .from('sdr_comp_plan')
    .insert(newPlan)
    .select()
    .single();
  
  if (createError) {
    console.error(`❌ Erro ao criar comp_plan fallback: ${createError.message}`);
    continue;
  }
  
  effectiveCompPlan = createdPlan;
  console.log(`✅ Comp plan fallback criado para ${sdr.name}`);
}
```

## Teste Esperado

Apos a implementacao:
1. Acessar fechamento de janeiro 2026 para Cleiton Lima
2. Inserir os KPIs (217 agendadas, 157 realizadas, 100 organizacao)
3. Clicar em "Salvar e Recalcular"
4. Sistema deve criar comp_plan automatico e calcular:
   - Agendadas: 217 / 140 = 155% -> mult 1.5x
   - Realizadas: 157 / 152 = 103% -> mult 1x
   - Organizacao: 100 / 100 = 100% -> mult 1x

## Correcao Imediata (Dados)

Enquanto a implementacao nao e feita, o problema pode ser corrigido ajustando o plano existente:

```sql
-- Opcao A: Ajustar vigencia do plano pendente para cobrir janeiro
UPDATE sdr_comp_plan 
SET vigencia_inicio = '2026-01-01', status = 'APPROVED'
WHERE id = '52584bcf-e8ac-4da3-92ce-1a9299fb2f6b';

-- Opcao B: Criar plano especifico para janeiro
INSERT INTO sdr_comp_plan (sdr_id, vigencia_inicio, vigencia_fim, ote_total, fixo_valor, variavel_total, ...)
VALUES ('11111111-0001-0001-0001-000000000006', '2026-01-01', '2026-01-31', 4500, 3200, 1300, ...);
```
