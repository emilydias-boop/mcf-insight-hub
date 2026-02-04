
# Plano: Correção da Visibilidade de SDRs no Fechamento do Consórcio

## Diagnóstico do Problema

Ithaline e Ygor **existem na tabela `sdr`** com `squad = 'consorcio'` e `active = true`, porém não aparecem no fechamento porque:

| SDR | Email | sdr_comp_plan | employees (RH) |
|-----|-------|---------------|----------------|
| Cleiton Lima | ✅ Tem | ✅ 4 planos | ✅ Vinculado |
| Ithaline | ❌ Nulo | ❌ Nenhum | ❌ Não vinculado |
| Ygor | ❌ Nulo | ❌ Nenhum | ❌ Não vinculado |

O sistema de fechamento (`useRecalculateAllPayouts`) **ignora SDRs sem plano de compensação**:
```typescript
if (!compPlan) continue;  // <-- Linha 817 - pula quem não tem plano
```

## Soluções Disponíveis

### Opção A: Cadastrar Planos Individuais (Correção via UI)
**Não requer código** - apenas configuração no sistema existente.

1. Acesse `/consorcio/fechamento/configuracoes` → aba **"Planos OTE"**
2. Para cada SDR sem plano (Ithaline e Ygor):
   - Clique em "Editar" na linha do colaborador
   - Defina os valores de OTE, Fixo, Variável
   - Salve o plano
3. Volte ao fechamento e clique em "Recalcular Todos"

**Problema**: Ithaline e Ygor não aparecem na aba Planos OTE porque:
- Não têm `cargo_catalogo_id` (não estão no RH com cargo vinculado)

### Opção B: Modificar Sistema para Usar Fallback (Recomendado)

Atualizar `useRecalculateAllPayouts` para:
1. Se não houver `sdr_comp_plan`, buscar valores do `cargo_catalogo` do funcionário no RH
2. Se também não houver funcionário no RH, usar **valores padrão** baseados no nível do SDR

Isso garante que **todos os SDRs ativos** apareçam no fechamento, mesmo sem configuração individual.

### Opção C: Criar Funcionalidade de Plano Rápido na Aba SDRs

Adicionar botão "Criar Plano OTE" diretamente na tabela de SDRs para quem não tem.

---

## Implementação Recomendada (Opção B + C Combinadas)

### Etapa 1: Fallback no Recálculo

Modificar `src/hooks/useSdrFechamento.ts` na função `useRecalculateAllPayouts`:

```text
┌──────────────────────────────────────────────────────────────┐
│           FLUXO ATUAL (com problema)                         │
├──────────────────────────────────────────────────────────────┤
│ Para cada SDR ativo:                                         │
│   → Buscar comp_plan                                         │
│   → SE não tem comp_plan → PULA (continue) ❌                │
│   → Calcular payout                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│           FLUXO PROPOSTO (com fallback)                      │
├──────────────────────────────────────────────────────────────┤
│ Para cada SDR ativo:                                         │
│   → Buscar comp_plan                                         │
│   → SE não tem comp_plan:                                    │
│       → Buscar cargo_catalogo via employee                   │
│       → SE tem cargo_catalogo → Usar OTE do catálogo ✅      │
│       → SE não tem → Usar valores padrão do nível ✅         │
│   → Calcular payout                                          │
└──────────────────────────────────────────────────────────────┘
```

### Etapa 2: Valores Padrão por Nível

Criar constante com OTE padrão para SDRs sem configuração:

```typescript
const DEFAULT_OTE_BY_LEVEL = {
  1: { ote_total: 4000, fixo_valor: 2800, variavel_total: 1200 },
  2: { ote_total: 4500, fixo_valor: 3150, variavel_total: 1350 },
  3: { ote_total: 5000, fixo_valor: 3500, variavel_total: 1500 },
  // ... etc
};
```

### Etapa 3: Criar/Atualizar Plano Implícito

Quando usar fallback, **criar automaticamente** um `sdr_comp_plan` para o SDR com os valores inferidos, garantindo rastreabilidade.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrFechamento.ts` | Adicionar fallback para cargo_catalogo e valores padrão em `useRecalculateAllPayouts` e `useRecalculatePayout` |

## Resultado Esperado

Após implementação:
1. **Clicar em "Recalcular Todos"** no fechamento de Consórcio
2. Sistema criará automaticamente payouts para Ithaline e Ygor usando valores padrão
3. Ambos aparecerão na lista de SDRs com status "Rascunho"

## Teste

1. Acessar `/consorcio/fechamento`
2. Clicar em "Recalcular Todos"
3. Verificar se Ithaline e Ygor aparecem na aba SDRs

---

## Resumo Técnico

A modificação principal está na função `useRecalculateAllPayouts` (linhas ~764-893):

**Antes (linha 817):**
```typescript
if (!compPlan) continue;
```

**Depois:**
```typescript
if (!compPlan) {
  // Fallback: criar comp_plan a partir de cargo_catalogo ou valores padrão
  compPlan = await createFallbackCompPlan(sdr.id, anoMes, employeeMap.get(sdr.id));
  if (!compPlan) continue; // Só pula se realmente não conseguir criar
}
```

A nova função `createFallbackCompPlan` irá:
1. Tentar usar `cargo_catalogo` do employee vinculado
2. Fallback para valores padrão baseados em `sdr.nivel`
3. Inserir registro em `sdr_comp_plan` para persistência
