
# Corrigir Valor Base da Organização para Closer Thayna

## Diagnóstico

A Closer Thayna possui um plano de compensação (`sdr_comp_plan`) com:
- `valor_organizacao = 1200`
- `status = PENDING` (não aprovado!)

O problema é que o hook `useSdrCompPlan` não filtra por status, retornando planos pendentes como se fossem válidos.

## Dados Encontrados

| Campo | Valor |
|-------|-------|
| cargo_catalogo.variavel_valor | R$ 2.400,00 |
| Peso Organização | 15% |
| Valor correto calculado | 2400 × 15% = **R$ 360,00** |
| valor_organizacao no plano PENDING | R$ 1.200,00 ← erro |

## Solução Recomendada

Adicionar filtro `.eq('status', 'approved')` no hook `useSdrCompPlan` para que apenas planos aprovados sejam utilizados nos cálculos.

### Arquivo a Alterar

`src/hooks/useSdrFechamento.ts` - linhas 107-115

### Código Atual
```typescript
const { data, error } = await supabase
  .from('sdr_comp_plan')
  .select('*')
  .eq('sdr_id', sdrId)
  .lte('vigencia_inicio', monthStart)
  .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
  .order('vigencia_inicio', { ascending: false })
  .limit(1)
  .single();
```

### Código Novo
```typescript
const { data, error } = await supabase
  .from('sdr_comp_plan')
  .select('*')
  .eq('sdr_id', sdrId)
  .eq('status', 'approved')  // Apenas planos aprovados
  .lte('vigencia_inicio', monthStart)
  .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
  .order('vigencia_inicio', { ascending: false })
  .limit(1)
  .single();
```

## Resultado Esperado

Após a correção:
- O plano PENDING será ignorado
- O sistema usará o cálculo dinâmico: `variavelTotal × peso%`
- Com cargo_catalogo.variavel_valor = 2400 e peso = 15%
- **Valor Base = R$ 360,00** (correto)

## Alternativa (Via Interface)

Se preferir manter o comportamento atual e corrigir apenas para a Thayna:
1. Aprovar o plano dela na interface de Configurações
2. Editar o `valor_organizacao` para 360 antes de aprovar

---

**Qual opção você prefere?**
- **Corrigir o Hook** (recomendado - garante consistência para todos)
- **Aprovar/Editar o Plano da Thayna** (solução pontual)
