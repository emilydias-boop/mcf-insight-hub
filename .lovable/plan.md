

# Plano: Corrigir Filtro de Tags com Normalização de Strings

## Problema Identificado

Quando o usuário seleciona a tag "Lead-Lançamento", deals SEM essa tag estão aparecendo. A lógica de filtragem em `Negocios.tsx` usa comparação direta com `dealTags.includes(tag)`, que pode falhar devido a:

1. **Diferenças de encoding Unicode** - O caractere "ç" pode ter representações diferentes (NFC vs NFD)
2. **Espaços invisíveis** - Whitespace no início/fim das strings
3. **Case sensitivity** - Embora menos provável, variações de maiúsculas/minúsculas

## Solução

Normalizar ambos os lados da comparação para garantir matching preciso.

---

## Alterações

### Arquivo: `src/pages/crm/Negocios.tsx`

#### Modificar o filtro de tags (linhas 430-437)

**Antes:**
```typescript
// Filtro por tags selecionadas
if (filters.selectedTags.length > 0) {
  const dealTags = deal.tags || [];
  const hasMatchingTag = filters.selectedTags.some(tag => 
    dealTags.includes(tag)
  );
  if (!hasMatchingTag) return false;
}
```

**Depois:**
```typescript
// Filtro por tags selecionadas (com normalização para caracteres especiais)
if (filters.selectedTags.length > 0) {
  const dealTags = deal.tags || [];
  
  // Normalizar para comparação segura (NFC + trim + lowercase)
  const normalizeTag = (t: string) => t.normalize('NFC').trim().toLowerCase();
  const normalizedSelectedTags = filters.selectedTags.map(normalizeTag);
  const normalizedDealTags = dealTags.map((t: string) => normalizeTag(t));
  
  const hasMatchingTag = normalizedSelectedTags.some(selectedTag => 
    normalizedDealTags.includes(selectedTag)
  );
  
  if (!hasMatchingTag) return false;
}
```

---

## Explicação Técnica

### Por que isso acontece?

O caractere "ç" (c-cedilha) pode ser representado de duas formas em Unicode:
- **NFC (Composed):** Um único code point `U+00E7`
- **NFD (Decomposed):** Dois code points `U+0063` (c) + `U+0327` (combining cedilla)

Visualmente idênticos, mas `"ç".normalize('NFC') !== "ç".normalize('NFD')` retorna `true`.

### Fluxo de Dados Corrigido

```text
Usuário seleciona "Lead-Lançamento"
    |
    V
selectedTags = ["Lead-Lançamento"] (pode ser NFD)
    |
    V
Deal do banco tem tags = ["Lead-Lançamento"] (pode ser NFC)
    |
    V
ANTES: "Lead-Lançamento".includes("Lead-Lançamento") = false (encoding diferente)
    |
    V
DEPOIS: Ambos normalizados para NFC + lowercase
        "lead-lançamento" === "lead-lançamento" = true ✓
```

---

## Resultado Esperado

- Ao filtrar por "Lead-Lançamento", apenas deals com essa tag exata aparecerão
- A comparação será insensível a variações de encoding, case e espaços

