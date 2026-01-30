
# Plano: Corrigir Prioridade do Override Manual no Cálculo de Bruto

## Problema Identificado

O Rodrigo Jesus comprou A000 em março/2025, não deu seguimento, e voltou agora em janeiro/2026 pelo lançamento. O sistema está marcando como "Recorrente" porque encontra a compra antiga.

**Dado importante**: O registro novo já tem `gross_override: 497` definido, mas não está funcionando!

### Por que o override não funciona?

No arquivo `src/lib/incorporadorPricing.ts`, a ordem das regras está errada:

```javascript
// Regra 2: NÃO é a primeira = zera bruto  ← avalia PRIMEIRO
if (!isFirstOfGroup) {
  return 0;  // Retorna aqui e nunca chega no override!
}

// Regra 3: Override manual  ← NUNCA é alcançado
if (transaction.gross_override !== null) {
  return transaction.gross_override;
}
```

---

## Solução

**Inverter a ordem das regras**: O `gross_override` deve ter prioridade sobre a deduplicação, pois representa uma decisão manual explícita de forçar um valor bruto.

### Código Atual
```javascript
// Regra 1: Parcela > 1 = zera
// Regra 2: Não é primeiro = zera  ← PROBLEMA
// Regra 3: Override manual
// Regra 4-5: Cálculo normal
```

### Código Corrigido
```javascript
// Regra 1: Parcela > 1 = zera (mantém)
// Regra 2: Override manual  ← NOVA POSIÇÃO (prioridade!)
// Regra 3: Não é primeiro = zera (movida para depois)
// Regra 4-5: Cálculo normal
```

---

## Impacto

1. **Rodrigo Jesus**: Com o override de R$ 497 já cadastrado, o bruto vai aparecer corretamente
2. **Outros casos de lançamento**: Podem ser corrigidos adicionando `gross_override` na transação
3. **Retrocompatibilidade**: Transações sem override continuam funcionando igual

---

## Detalhes Técnicos

### Arquivo a modificar
`src/lib/incorporadorPricing.ts`

### Mudança na função `getDeduplicatedGross`

**Antes (linhas 78-90):**
```javascript
// Regra 2: NÃO é a primeira transação = bruto zerado
if (!isFirstOfGroup) {
  return 0;
}

// Regra 3: Se há override manual, usa ele
if (transaction.gross_override !== null && transaction.gross_override !== undefined) {
  return transaction.gross_override;
}
```

**Depois:**
```javascript
// Regra 2: Override manual tem prioridade absoluta (correções de lançamento, etc)
if (transaction.gross_override !== null && transaction.gross_override !== undefined) {
  return transaction.gross_override;
}

// Regra 3: NÃO é a primeira transação = bruto zerado
if (!isFirstOfGroup) {
  return 0;
}
```

---

## Validação

Após a alteração:
1. Rodrigo Jesus deve mostrar **Bruto R$ 497,00** (usando o override já cadastrado)
2. O indicador "(dup)" pode permanecer, mas o valor estará correto
3. Outros clientes de lançamento podem ser corrigidos adicionando `gross_override`
