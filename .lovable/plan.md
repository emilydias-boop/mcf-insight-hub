

# Corrigir busca por email retornando resultados errados no agendamento R2

## Problema

Ao buscar por `victorsaraiva1777@gmail.com`, o sistema:
1. Extrai os dígitos do texto: `"1777"`
2. Como tem 4+ dígitos, adiciona filtro `phone.ilike.%1777%`
3. Isso retorna contatos como Bruna (`19998871777`) que contêm "1777" no telefone

## Causa raiz

Linha 873-874 de `useAgendaData.ts`:
```typescript
const normalizedQuery = query.replace(/\D/g, '');
const phoneFilter = normalizedQuery.length >= 4 ? ... : '';
```

Não distingue se o input é email ou telefone — extrai dígitos de qualquer texto.

## Solução

No `useSearchDealsForSchedule` (`src/hooks/useAgendaData.ts`, linhas 872-875):

Só aplicar o filtro de telefone quando a query original parecer um número de telefone (maioria dos caracteres são dígitos), e não quando for claramente um email ou nome:

```typescript
// Antes
const normalizedQuery = query.replace(/\D/g, '');
const phoneFilter = normalizedQuery.length >= 4 ? `,phone.ilike.%${normalizedQuery}%` : '';

// Depois
const normalizedQuery = query.replace(/\D/g, '');
const isLikelyPhone = normalizedQuery.length >= 4 && (normalizedQuery.length / query.length) > 0.5;
const phoneFilter = isLikelyPhone ? `,phone.ilike.%${normalizedQuery}%` : '';
```

A heurística `normalizedQuery.length / query.length > 0.5` garante que:
- `"86988436557"` → 100% dígitos → busca por telefone ✓
- `"victorsaraiva1777@gmail.com"` → 4/28 = 14% dígitos → NÃO busca por telefone ✓
- `"43998693444"` → 100% dígitos → busca por telefone ✓

