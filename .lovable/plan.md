
# Plano: Adicionar Opção "Intercalado (parcelas ímpares)"

## Objetivo

Adicionar uma terceira opção para o tipo de contrato, permitindo que a empresa pague as parcelas **ímpares** (1, 3, 5, 7...) em vez das pares.

## Alterações Necessárias

### 1. Migration SQL - Alterar constraint do banco

A tabela `consortium_cards` tem uma constraint que limita os valores permitidos:
```sql
CHECK (tipo_contrato IN ('normal', 'intercalado'))
```

Precisamos alterá-la para aceitar o novo valor:
```sql
ALTER TABLE consortium_cards 
DROP CONSTRAINT IF EXISTS consortium_cards_tipo_contrato_check;

ALTER TABLE consortium_cards 
ADD CONSTRAINT consortium_cards_tipo_contrato_check 
CHECK (tipo_contrato IN ('normal', 'intercalado', 'intercalado_impar'));
```

---

### 2. Atualizar tipos TypeScript

**Arquivo:** `src/types/consorcio.ts`

Alterar o tipo `TipoContrato`:
```typescript
// Antes
export type TipoContrato = 'normal' | 'intercalado';

// Depois
export type TipoContrato = 'normal' | 'intercalado' | 'intercalado_impar';
```

---

### 3. Atualizar schema do formulário

**Arquivo:** `src/components/consorcio/ConsorcioCardForm.tsx`

Alterar o schema Zod (linha 117):
```typescript
// Antes
tipo_contrato: z.enum(['normal', 'intercalado']).optional(),

// Depois
tipo_contrato: z.enum(['normal', 'intercalado', 'intercalado_impar']).optional(),
```

Alterar os casts nos defaultValues e reset (linhas 229, 483, etc.):
```typescript
// Antes
tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado' | undefined,

// Depois
tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado' | 'intercalado_impar' | undefined,
```

Adicionar nova opção no Select (linha 1112-1113):
```typescript
<SelectContent>
  <SelectItem value="normal">Normal (primeiras parcelas)</SelectItem>
  <SelectItem value="intercalado">Intercalado (parcelas pares)</SelectItem>
  <SelectItem value="intercalado_impar">Intercalado (parcelas ímpares)</SelectItem>
</SelectContent>
```

---

### 4. Atualizar lógica de geração de parcelas

**Arquivo:** `src/hooks/useConsorcio.ts`

Alterar a lógica que determina se a parcela é da empresa ou do cliente (linhas 222-232):

```typescript
// Determine if this installment is paid by client or company
let tipo: 'cliente' | 'empresa';

if (input.tipo_contrato === 'intercalado') {
  // Intercalado PAR: empresa paga as primeiras N parcelas PARES (2, 4, 6, 8...)
  const ehPar = i % 2 === 0;
  const qualParcelaParEhEssa = i / 2;
  tipo = (ehPar && qualParcelaParEhEssa <= input.parcelas_pagas_empresa) ? 'empresa' : 'cliente';
  
} else if (input.tipo_contrato === 'intercalado_impar') {
  // Intercalado ÍMPAR: empresa paga as primeiras N parcelas ÍMPARES (1, 3, 5, 7...)
  const ehImpar = i % 2 === 1;
  const qualParcelaImparEhEssa = Math.ceil(i / 2); // 1→1, 3→2, 5→3, 7→4...
  tipo = (ehImpar && qualParcelaImparEhEssa <= input.parcelas_pagas_empresa) ? 'empresa' : 'cliente';
  
} else {
  // Normal: empresa paga as primeiras N parcelas sequenciais
  tipo = i <= input.parcelas_pagas_empresa ? 'empresa' : 'cliente';
}
```

**Exemplo com 8 parcelas ímpares:**
| Parcela | Cálculo | Resultado |
|---------|---------|-----------|
| 1 | `ceil(1/2) = 1` ≤ 8 | Empresa |
| 3 | `ceil(3/2) = 2` ≤ 8 | Empresa |
| 5 | `ceil(5/2) = 3` ≤ 8 | Empresa |
| 7 | `ceil(7/2) = 4` ≤ 8 | Empresa |
| 9 | `ceil(9/2) = 5` ≤ 8 | Empresa |
| 11 | `ceil(11/2) = 6` ≤ 8 | Empresa |
| 13 | `ceil(13/2) = 7` ≤ 8 | Empresa |
| 15 | `ceil(15/2) = 8` ≤ 8 | Empresa (8ª e última) |
| 17 | `ceil(17/2) = 9` > 8 | Cliente |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar `intercalado_impar` na constraint |
| `src/types/consorcio.ts` | Adicionar ao tipo `TipoContrato` |
| `src/components/consorcio/ConsorcioCardForm.tsx` | Schema, casts e Select options |
| `src/hooks/useConsorcio.ts` | Lógica de cálculo das parcelas |

---

## Resultado Esperado

```
┌─────────────────────────────────────────────┐
│  Tipo de Contrato *                         │
│  ┌───────────────────────────────────────┐  │
│  │ Normal (primeiras parcelas)       ▼ │  │
│  └───────────────────────────────────────┘  │
│    ┌─────────────────────────────────────┐  │
│    │ ✓ Normal (primeiras parcelas)      │  │
│    │   Intercalado (parcelas pares)     │  │
│    │   Intercalado (parcelas ímpares)   │  │
│    └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```
