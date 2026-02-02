

# Plano: Corrigir Visão de Negócios para SDRs do Consórcio

## Problema Identificado

Os SDRs do Consórcio estão vendo **negócios do Incorporador** em vez de negócios do Consórcio porque:

1. O código em `Negocios.tsx` (linha 100-103) **ignora a BU ativa** para SDRs:
   ```typescript
   if (isSdr) {
     return SDR_AUTHORIZED_ORIGIN_ID; // ← Hardcoded para Incorporador!
   }
   ```

2. `SDR_AUTHORIZED_ORIGIN_ID` é fixo como `'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'` (PIPELINE INSIDE SALES do **Incorporador**)

3. O Consórcio tem sua própria pipeline: `'4e2b810a-6782-4ce9-9c0d-10d04c018636'` (PIPELINE - INSIDE SALES - VIVER DE ALUGUEL)

---

## Solução: Usar Pipeline da BU Ativa para SDRs

Modificar a lógica para que SDRs usem a origem padrão da sua BU em vez de um ID hardcoded global.

### 1. Criar Mapeamento de Origens SDR por BU

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

Adicionar novo mapeamento:
```typescript
// Origem padrão para SDRs de cada BU
export const SDR_ORIGIN_BY_BU: Record<BusinessUnit, string> = {
  incorporador: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', // PIPELINE INSIDE SALES
  consorcio: '4e2b810a-6782-4ce9-9c0d-10d04c018636',    // PIPELINE - INSIDE SALES - VIVER DE ALUGUEL
  credito: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',      // Fallback (a definir)
  projetos: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',     // Fallback (a definir)
  leilao: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',       // Pipeline Leilão
};
```

### 2. Modificar `effectiveOriginId` em Negocios.tsx

**Arquivo:** `src/pages/crm/Negocios.tsx` (linhas 99-103)

De:
```typescript
if (isSdr) {
  return SDR_AUTHORIZED_ORIGIN_ID;
}
```

Para:
```typescript
if (isSdr) {
  // Usar origem da BU ativa (da rota ou perfil)
  if (activeBU && SDR_ORIGIN_BY_BU[activeBU]) {
    return SDR_ORIGIN_BY_BU[activeBU];
  }
  // Fallback para Incorporador se não tem BU definida
  return SDR_AUTHORIZED_ORIGIN_ID;
}
```

### 3. Modificar Definição de Pipeline Padrão

**Arquivo:** `src/pages/crm/Negocios.tsx` (linhas 138-142)

De:
```typescript
if (isSdr) {
  setSelectedPipelineId(SDR_AUTHORIZED_ORIGIN_ID);
  return;
}
```

Para:
```typescript
if (isSdr) {
  if (activeBU && SDR_ORIGIN_BY_BU[activeBU]) {
    setSelectedPipelineId(SDR_ORIGIN_BY_BU[activeBU]);
  } else {
    setSelectedPipelineId(SDR_AUTHORIZED_ORIGIN_ID);
  }
  return;
}
```

---

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/NegociosAccessGuard.tsx` | Adicionar `SDR_ORIGIN_BY_BU` com mapeamento por BU |
| `src/pages/crm/Negocios.tsx` | Usar `SDR_ORIGIN_BY_BU[activeBU]` em vez de `SDR_AUTHORIZED_ORIGIN_ID` hardcoded |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| SDR acessa `/consorcio/crm/negocios` | Vê negócios do Incorporador | Vê negócios do Consórcio |
| SDR acessa `/crm/negocios` (global) | Vê negócios do Incorporador | Vê negócios da sua BU (perfil) |
| SDR acessa `/incorporador/crm/negocios` | Vê negócios do Incorporador | Mantém (correto) |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  SDR do Consórcio acessa /consorcio/crm/negocios                    │
│  1. useActiveBU() → 'consorcio' (da rota)                           │
│  2. isSdr = true                                                    │
│  3. effectiveOriginId → SDR_ORIGIN_BY_BU['consorcio']               │
│     = '4e2b810a-...' (PIPELINE - INSIDE SALES - VIVER DE ALUGUEL)   │
│  4. useCRMDeals filtra por esta origem                              │
│  5. Kanban mostra apenas negócios do Consórcio ✓                    │
└─────────────────────────────────────────────────────────────────────┘
```

