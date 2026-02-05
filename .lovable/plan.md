
# Plano: Normalização Avançada de Tags para Matching Robusto

## Problema Identificado

O banco de dados contém variações da mesma tag:
- `Lead Lancamento` (sem acentos, com espaço)
- `Lead-Lançamento` (com acentos, com hífen)

A normalização atual não remove acentos nem padroniza separadores, fazendo com que o filtro não reconheça tags semanticamente idênticas.

## Solução

Criar uma função de normalização mais robusta que:
1. Remove acentos (NFD + remoção de diacríticos)
2. Normaliza separadores (espaços → hífens)
3. Aplica lowercase e trim

---

## Alterações

### Arquivo: `src/pages/crm/Negocios.tsx`

#### Modificar a função `normalizeTag` (linhas 434-437)

**Antes:**
```typescript
const normalizeTag = (t: string) => t.normalize('NFC').trim().toLowerCase();
```

**Depois:**
```typescript
// Normalização avançada: remove acentos, padroniza separadores
const normalizeTag = (t: string) => 
  t.normalize('NFD')                    // Decompose para separar acentos
   .replace(/[\u0300-\u036f]/g, '')     // Remove diacríticos (acentos)
   .replace(/\s+/g, '-')                // Espaços → hífens
   .trim()
   .toLowerCase();
```

---

## Explicação Técnica

### Por que isso funciona?

1. **NFD Decomposition**: Separa caracteres em base + acento
   - "ç" → "c" + "◌̧" (cedilha separada)
   - "á" → "a" + "◌́" (acento separado)

2. **Regex `[\u0300-\u036f]`**: Remove todos os combining marks (acentos)
   - Resultado: "lançamento" → "lancamento"

3. **Replace `\s+` → `-`**: Padroniza separadores
   - "Lead Lancamento" → "Lead-Lancamento"

### Resultado

```text
Entrada: "Lead-Lançamento"
Saída:   "lead-lancamento"

Entrada: "Lead Lancamento"  
Saída:   "lead-lancamento"

Ambas normalizam para a MESMA string → Match!
```

---

## Resultado Esperado

- Ao selecionar "Lead-Lançamento", TODOS os deals com variações como "Lead Lancamento" também aparecerão
- O filtro será insensível a:
  - Acentos (ç/c, á/a, ã/a, etc.)
  - Tipo de separador (espaço vs hífen)
  - Maiúsculas/minúsculas
