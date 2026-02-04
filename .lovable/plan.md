
# Plano: Corrigir Valores do Comp Plan e Pesos de Métricas

## Diagnóstico Detalhado

Comparando o sistema com a planilha de referência, encontrei **5 problemas**:

### 1. Fixo Incorreto
| | Sistema | Planilha |
|--|---------|----------|
| Fixo | R$ 3.200,00 | R$ 3.150,00 |

O Fixo deveria ser **70% do OTE** = 70% × R$ 4.500 = **R$ 3.150,00**

### 2. Variável Base Incorreto
| | Sistema | Planilha |
|--|---------|----------|
| Variável | R$ 1.300,00 | R$ 1.350,00 |

O Variável deveria ser **30% do OTE** = 30% × R$ 4.500 = **R$ 1.350,00**

### 3. Pesos das Métricas Incorretos
| Métrica | Sistema | Planilha (correto) |
|---------|---------|-------------------|
| Agendadas | R$ 470 (36%) | R$ 472,50 (**35%**) |
| Realizadas | R$ 750 (58%) | R$ 742,50 (**55%**) |
| Organização | R$ 195 (15%) | R$ 135,00 (**10%**) |

O fallback está usando 35%/35%/15%/15%, mas deveria ser **35%/55%/10%**.

### 4. iFood Mensal Incorreto
| | Sistema | Planilha |
|--|---------|----------|
| iFood | R$ 600,00 | R$ 570,00 |

O iFood correto para SDR 2 é **R$ 570,00**.

### 5. Resultado da Diferença

| Descrição | Sistema | Planilha | Diferença |
|-----------|---------|----------|-----------|
| Agendadas | R$ 811,13 | R$ 708,75 | +R$ 102,38 |
| Realizadas | R$ 1.274,63 | R$ 1.113,75 | +R$ 160,88 |
| Organização | R$ 154,50 | R$ 135,00 | +R$ 19,50 |
| Fixo | R$ 3.200,00 | R$ 3.150,00 | +R$ 50,00 |
| **Total** | **R$ 5.440,25** | **R$ 5.107,50** | **+R$ 332,76** |

## Solução

### Arquivo a Modificar
`supabase/functions/recalculate-sdr-payout/index.ts`

### Alteração 1: Corrigir DEFAULT_OTE_BY_LEVEL (linhas 63-68)

O nível 2 está com fixo incorreto:

```typescript
// ANTES (linha 65)
2: { ote_total: 4500, fixo_valor: 3150, variavel_total: 1350 },

// Está correto no fallback, mas o comp_plan criado está usando valores errados
```

### Alteração 2: Corrigir Pesos do Fallback (linhas 424-427)

```typescript
// ANTES
valor_meta_rpg: Math.round(fallbackValues.variavel_total * 0.35),      // Agendadas
valor_docs_reuniao: Math.round(fallbackValues.variavel_total * 0.35), // Realizadas (ERRADO!)
valor_tentativas: Math.round(fallbackValues.variavel_total * 0.15),   // Tentativas
valor_organizacao: Math.round(fallbackValues.variavel_total * 0.15),  // Organização (ERRADO!)

// DEPOIS (pesos corretos da planilha)
valor_meta_rpg: Math.round(fallbackValues.variavel_total * 0.35),      // Agendadas = 35%
valor_docs_reuniao: Math.round(fallbackValues.variavel_total * 0.55), // Realizadas = 55%
valor_tentativas: 0,                                                   // Tentativas = 0% (SDR Consórcio não usa)
valor_organizacao: Math.round(fallbackValues.variavel_total * 0.10),  // Organização = 10%
```

### Alteração 3: Corrigir iFood no Fallback (linha 428)

```typescript
// ANTES
ifood_mensal: 150,

// DEPOIS (usar valor correto por nível)
ifood_mensal: nivel === 2 ? 570 : 600,  // SDR 2 = R$ 570
```

### Alteração 4: Corrigir o Comp Plan Existente

O comp_plan criado automaticamente (`id: 0a3f1e45-d1e7-4675-ae29-fdd424871cba`) precisa ser corrigido na base:

```sql
UPDATE sdr_comp_plan 
SET 
  fixo_valor = 3150,
  variavel_total = 1350,
  valor_meta_rpg = 472.50,
  valor_docs_reuniao = 742.50,
  valor_tentativas = 0,
  valor_organizacao = 135.00
WHERE id = '0a3f1e45-d1e7-4675-ae29-fdd424871cba';
```

E atualizar o payout para usar o iFood correto:

```sql
UPDATE sdr_month_payout
SET ifood_mensal = 570
WHERE id = 'd0cff632-7f99-4e5b-a3e1-f7b867e1ead2';
```

## Cálculo Esperado Após Correção

| Métrica | Base (100%) | Mult | Valor Final |
|---------|-------------|------|-------------|
| Agendadas (35%) | R$ 472,50 | 1.5x | **R$ 708,75** |
| Realizadas (55%) | R$ 742,50 | 1.5x | **R$ 1.113,75** |
| Organização (10%) | R$ 135,00 | 1.0x | **R$ 135,00** |
| **Subtotal Variável** | | | **R$ 1.957,50** |
| Fixo (70%) | | | **R$ 3.150,00** |
| **Total Conta** | | | **R$ 5.107,50** |
| iFood | | | **R$ 570,00** |

## Resumo das Alterações

1. Corrigir pesos no fallback: 35%/55%/0%/10%
2. Corrigir iFood por nível
3. Atualizar comp_plan existente na base
4. Recalcular payout
