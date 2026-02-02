
# Plano: Mostrar Todas as Pipelines no CRM Consórcio

## Problema Identificado

No CRM do Consórcio (`/consorcio/crm/negocios`), apenas **UMA pipeline** aparece no dropdown de funis. Isso acontece porque:

1. O `BU_GROUP_MAP` define que Consórcio só pode ver o grupo `b98e3746-d727-445b-b878-fc5742b6e6b8` ("Perpétuo - Construa para Alugar")
2. Esse grupo tem apenas 1 origem cadastrada: "PIPE LINE - INSIDE SALES"
3. Existem vários outros grupos relacionados ao Consórcio no banco que não estão sendo mostrados

## Solução Proposta

Remover temporariamente a restrição de pipelines para a BU Consórcio, permitindo que **todos os funis** sejam visualizados. A restrição para SDRs/Closers será implementada em uma fase posterior.

---

## Alterações Técnicas

### Arquivo: `src/components/auth/NegociosAccessGuard.tsx`

| Alteração | Antes | Depois |
|-----------|-------|--------|
| `BU_GROUP_MAP.consorcio` | `['b98e3746-d727-445b-b878-fc5742b6e6b8']` | `[]` (array vazio = sem filtro) |
| `BU_PIPELINE_MAP.consorcio` | `[...IDs restritos]` | `[]` (array vazio = sem filtro) |

**Lógica:** Arrays vazios significam "sem restrição" — a sidebar e o dropdown mostrarão todas as pipelines disponíveis.

---

## Código a Modificar

```typescript
// NegociosAccessGuard.tsx

// ANTES:
export const BU_PIPELINE_MAP: Record<BusinessUnit, string[]> = {
  // ...
  consorcio: [
    'b98e3746-d727-445b-b878-fc5742b6e6b8',
    '4e2b810a-6782-4ce9-9c0d-10d04c018636',
  ],
  // ...
};

export const BU_GROUP_MAP: Record<BusinessUnit, string[]> = {
  // ...
  consorcio: ['b98e3746-d727-445b-b878-fc5742b6e6b8'],
  // ...
};

// DEPOIS:
export const BU_PIPELINE_MAP: Record<BusinessUnit, string[]> = {
  // ...
  consorcio: [], // Sem restrição = mostra todas as pipelines
  // ...
};

export const BU_GROUP_MAP: Record<BusinessUnit, string[]> = {
  // ...
  consorcio: [], // Sem restrição = mostra todos os funis
  // ...
};
```

---

## Comportamento Após a Mudança

| Elemento | Antes | Depois |
|----------|-------|--------|
| **Dropdown "Funil"** | Mostra apenas 1 grupo | Mostra todos os grupos disponíveis |
| **Sidebar "Origens"** | Mostra apenas origens do grupo restrito | Mostra todas as origens |
| **Negócios Kanban** | Carrega apenas deals do grupo restrito | Carrega deals da pipeline selecionada |

---

## Próximos Passos (Fase Futura)

Para restringir SDRs e Closers do Consórcio a pipelines específicas:

1. Criar uma constante `CONSORCIO_SDR_AUTHORIZED_ORIGINS` com os IDs permitidos
2. No `Negocios.tsx`, verificar se `activeBU === 'consorcio' && isSdr` para aplicar o filtro
3. Manter admins e managers do Consórcio com visão completa

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/NegociosAccessGuard.tsx` | Alterar `BU_GROUP_MAP.consorcio` e `BU_PIPELINE_MAP.consorcio` para arrays vazios |
