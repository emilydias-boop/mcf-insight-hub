
# Plano: Corrigir Exibição de Leads no CRM da BU Crédito

## Problemas Identificados

### Problema 1: Mapeamento de BU incompleto
O `bu_origin_mapping` para Crédito está configurado com o grupo `BU - MCF CAPITAL` (ID: `8d33bad6-46ab-4f9c-a570-dc7b74be2ac9`), que contém a origem correta `INSIDE SALES - CREDITO` (ID: `7f74499a-6474-4b9d-ad28-1fbc85579bc2`) com 1.231 leads.

Porém, o fallback hardcoded em `NegociosAccessGuard.tsx` aponta para a pipeline do Incorporador:
```
credito: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c']  // PIPELINE INSIDE SALES (Incorporador)
```

### Problema 2: Pipeline padrão errada
O `BU_DEFAULT_ORIGIN_MAP` também usa a origem do Incorporador como fallback:
```
credito: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'  // PIPELINE INSIDE SALES (Incorporador)
```

### Problema 3: UX - Exigir seleção manual de funil
O usuário precisa clicar no funil para ver leads, ao invés do sistema mostrar automaticamente todos os leads da BU.

## Solução Proposta

### Etapa 1: Atualizar mapeamentos hardcoded
Corrigir os fallbacks em `src/components/auth/NegociosAccessGuard.tsx` para apontar para a pipeline correta do Crédito.

**Alterações:**

```typescript
// BU_PIPELINE_MAP
credito: [
  '8d33bad6-46ab-4f9c-a570-dc7b74be2ac9',  // Grupo: BU - MCF CAPITAL
  '7f74499a-6474-4b9d-ad28-1fbc85579bc2',  // Origem: INSIDE SALES - CREDITO
],

// BU_GROUP_MAP
credito: ['8d33bad6-46ab-4f9c-a570-dc7b74be2ac9'],  // BU - MCF CAPITAL

// BU_DEFAULT_ORIGIN_MAP
credito: '7f74499a-6474-4b9d-ad28-1fbc85579bc2',  // INSIDE SALES - CREDITO

// BU_DEFAULT_GROUP_MAP
credito: '8d33bad6-46ab-4f9c-a570-dc7b74be2ac9',  // BU - MCF CAPITAL

// SDR_ORIGIN_BY_BU
credito: '7f74499a-6474-4b9d-ad28-1fbc85579bc2',  // INSIDE SALES - CREDITO
```

### Etapa 2: Ajustar lógica de carregamento inicial
Modificar `src/pages/crm/Negocios.tsx` para que, ao abrir o CRM de uma BU, o sistema:

1. Se houver um default configurado (`BU_DEFAULT_ORIGIN_MAP`), seleciona automaticamente
2. Se não houver default, carrega todos os leads das origens mapeadas para a BU (em vez de não mostrar nada)

**Alteração na lógica de `effectiveOriginId`:**
Quando não há pipeline selecionada mas existe uma BU ativa, usar todas as origens da BU em vez de exigir seleção.

### Etapa 3: Melhorar UX - Mostrar todos os leads da BU por default
Modificar `src/hooks/useCRMData.ts` para aceitar um array de `originIds` como alternativa ao `originId` único, permitindo carregar leads de múltiplas origens simultaneamente.

**Comportamento esperado:**
- Ao entrar em `/bu-credito/crm/negocios`: Mostrar todos os leads da BU Crédito automaticamente (1.231 leads)
- Se clicar em um funil específico: Filtrar por aquele funil
- Se não tiver mapeamento: Mostrar warning e nenhum lead (não mostrar leads de outra BU)

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/NegociosAccessGuard.tsx` | Atualizar IDs de pipeline/grupo/origem para Crédito |
| `src/pages/crm/Negocios.tsx` | Ajustar lógica de seleção inicial para usar o default da BU |

## Diagrama de Fluxo

```text
Usuário acessa /bu-credito/crm/negocios
         │
         ▼
   BUContext → bu = 'credito'
         │
         ▼
   useActiveBU() → 'credito'
         │
         ▼
   useBUPipelineMap('credito')
         │
         ├──(banco)──► Grupo: BU - MCF CAPITAL
         │             └── Origem: INSIDE SALES - CREDITO
         │
         └──(fallback)──► BU_DEFAULT_ORIGIN_MAP['credito']
                          = '7f74499a-6474-4b9d-ad28-1fbc85579bc2'
         │
         ▼
   setSelectedPipelineId(defaultOrigin)
         │
         ▼
   useCRMDeals({ originId: '7f74499a...' })
         │
         ▼
   Kanban exibe 1.231 leads do Crédito ✓
```

## Resultado Esperado

Após implementação:

1. **Ao entrar em `/bu-credito/crm/negocios`**: Sistema carrega automaticamente os 1.231 leads da pipeline `INSIDE SALES - CREDITO`
2. **Sidebar de origens**: Mostra apenas o grupo `BU - MCF CAPITAL` e sua origem filha
3. **Dropdown de funil**: Mostra apenas funis mapeados para Crédito
4. **Sem vazamento de dados**: Leads do Incorporador não aparecem mais no CRM do Crédito
