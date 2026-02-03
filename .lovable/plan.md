
# Plano: Habilitar Escolha de Pipelines APENAS para SDRs do Consórcio

## Objetivo

Permitir que SDRs da BU **Consórcio** escolham entre múltiplas pipelines, enquanto SDRs de outras BUs (Incorporador, Crédito, Projetos, Leilão) mantêm o comportamento atual de pipeline fixa.

---

## Solução Proposta

### 1. Criar Constante de BUs com Sidebar Liberada para SDRs

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

Adicionar uma constante que define quais BUs permitem SDRs verem a sidebar:

```typescript
// BUs onde SDRs podem escolher múltiplas pipelines
export const SDR_MULTI_PIPELINE_BUS: BusinessUnit[] = ['consorcio'];
```

---

### 2. Ajustar Lógica de Visibilidade da Sidebar

**Arquivo:** `src/pages/crm/Negocios.tsx`

Modificar a lógica de `showSidebar` para ser condicional por BU:

```typescript
// DE:
const showSidebar = !isSdr;

// PARA:
const sdrCanSeeSidebar = isSdr && activeBU && SDR_MULTI_PIPELINE_BUS.includes(activeBU);
const showSidebar = !isSdr || sdrCanSeeSidebar;
```

**Resultado:**
- SDRs do Consórcio: `showSidebar = true`
- SDRs de outras BUs: `showSidebar = false` (comportamento atual)
- Não-SDRs: `showSidebar = true` (comportamento atual)

---

### 3. Ajustar Lógica de Origem Efetiva

**Arquivo:** `src/pages/crm/Negocios.tsx`

Modificar o cálculo de `effectiveOriginId` para respeitar a seleção manual apenas para SDRs do Consórcio:

```typescript
// Para SDRs
if (isSdr) {
  // SDRs de BUs com multi-pipeline podem navegar manualmente
  if (activeBU && SDR_MULTI_PIPELINE_BUS.includes(activeBU)) {
    if (selectedOriginId) return selectedOriginId;
  }
  
  // Default ou BUs com pipeline fixa
  if (activeBU && SDR_ORIGIN_BY_BU[activeBU]) {
    return SDR_ORIGIN_BY_BU[activeBU];
  }
  return SDR_AUTHORIZED_ORIGIN_ID;
}
```

---

## Detalhes Técnicos

### Comportamento por BU

| BU | SDR vê Sidebar? | SDR pode trocar pipeline? |
|---|---|---|
| **Consórcio** | ✅ Sim | ✅ Sim |
| Incorporador | ❌ Não | ❌ Não |
| Crédito | ❌ Não | ❌ Não |
| Projetos | ❌ Não | ❌ Não |
| Leilão | ❌ Não | ❌ Não |

### Expansão Futura

Para liberar outras BUs no futuro, basta adicionar à constante:

```typescript
export const SDR_MULTI_PIPELINE_BUS: BusinessUnit[] = ['consorcio', 'leilao'];
```

---

## Arquivos a Modificar

1. **`src/components/auth/NegociosAccessGuard.tsx`**
   - Adicionar constante `SDR_MULTI_PIPELINE_BUS`

2. **`src/pages/crm/Negocios.tsx`**
   - Importar `SDR_MULTI_PIPELINE_BUS`
   - Ajustar lógica de `showSidebar`
   - Ajustar lógica de `effectiveOriginId`

---

## Resultado Esperado

- **SDRs do Consórcio**: Sidebar visível, podem navegar entre as 5 pipelines mapeadas
- **SDRs de outras BUs**: Comportamento inalterado (pipeline fixa, sem sidebar)
- **Managers/Admins/Coordenadores**: Sem alteração (já veem tudo)
