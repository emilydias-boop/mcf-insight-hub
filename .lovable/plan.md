
# Plano: Diagnóstico e Correções para CRM Consórcio

## Problemas Identificados

### Problema 1: Webhook Consórcio Insere em Tabela Errada

**Situação Atual:**
O webhook `webhook-consorcio` que você mencionou (`https://...supabase.co/functions/v1/webhook-consorcio`) **existe e funciona**, mas ele insere dados na tabela **`consortium_cards`** (gestão de cartas de consórcio), **NÃO** no CRM (`crm_deals`).

**Por que isso acontece:**
- Este webhook foi criado especificamente para o módulo de Cartas de Consórcio
- Ele espera um payload específico com campos como `grupo`, `cota`, `valor_credito`, `tipo_pessoa`, etc.
- O destino são as cartas (`consortium_cards`), não os negócios do CRM

**Solução:**
Se você quer que leads externos entrem no **CRM**, deve usar o sistema de **Webhooks de Entrada** (como mostrado na sua imagem). Esse sistema já foi configurado na pipeline "Efeito Alavanca + Clube" e usa o `webhook-lead-receiver`, que insere na tabela `crm_deals`.

---

### Problema 2: "Nenhum Estágio Configurado" no Kanban

**Diagnóstico:**
As etapas estão **corretamente salvas** no banco de dados:
- "Efeito Alavanca + Clube" tem 13 etapas
- "Pipeline Leilão" tem 8 etapas

**Evidências do banco:**
```
origin_id: 7d7b1cb5-2a44-4552-9eff-c3b798646b78 (Efeito Alavanca + Clube)
stages_count: 13 etapas ativas
```

**Causa Raiz:**
O problema ocorre quando você:
1. Seleciona o **Funil "BU - LEILÃO"** no dropdown
2. **NÃO seleciona** uma origem específica na sidebar

Neste caso, o `effectiveOriginId` tenta pegar a primeira origem do grupo. Porém, há um **problema de timing/race condition** entre:
- O hook `useCRMOriginsByPipeline` que busca as origens do grupo
- O cálculo do `effectiveOriginId` que depende dessas origens
- O hook `useCRMStages` que busca as etapas

Quando `pipelineOrigins` ainda está `undefined` ou vazio no primeiro render, o `effectiveOriginId` retorna o próprio `selectedPipelineId` (que é o ID do grupo), mas não há etapas diretamente vinculadas ao grupo - elas estão nas origens filhas.

---

## Correções Propostas

### Correção 1: Melhorar lógica do `effectiveOriginId`

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/Negocios.tsx` | Adicionar espera pelo carregamento de `pipelineOrigins` antes de definir `effectiveOriginId` |

**Lógica:**
```typescript
const effectiveOriginId = useMemo(() => {
  if (isSdr) return SDR_AUTHORIZED_ORIGIN_ID;
  if (selectedOriginId) return selectedOriginId;
  
  // Se tem pipeline selecionado, verificar se é grupo
  if (selectedPipelineId) {
    // Se pipelineOrigins ainda está carregando, retornar undefined
    // para evitar buscar etapas do grupo (que não existem)
    if (!pipelineOrigins || (Array.isArray(pipelineOrigins) && pipelineOrigins.length === 0)) {
      return undefined; // Aguardar carregamento
    }
    
    // Se tem origens, pegar a primeira
    if (Array.isArray(pipelineOrigins) && pipelineOrigins.length > 0) {
      return (pipelineOrigins[0] as any).id;
    }
  }
  
  return undefined;
}, [selectedOriginId, selectedPipelineId, pipelineOrigins, isSdr]);
```

### Correção 2: Adicionar loading state enquanto etapas carregam

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/DealKanbanBoard.tsx` | Adicionar verificação de `isLoading` do hook de stages |

**Lógica:**
```typescript
const { data: stages, isLoading: isLoadingStages } = useCRMStages(originId);

// No render:
if (isLoadingStages) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

if (!stages || stages.length === 0) {
  return /* mensagem atual de "Nenhum estágio configurado" */;
}
```

---

## Sobre o Webhook do Consórcio

Se você precisa de um webhook que:
1. Receba leads externos
2. Crie negócios no CRM (`crm_deals`)
3. Atribua ao pipeline do Consórcio

**Use o sistema de Webhooks de Entrada** já configurado:
- URL: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver?slug=efeito-alavanca-clube`
- Este já está conectado à origem "Efeito Alavanca + Clube"
- Cria negócios diretamente no CRM

**O webhook `webhook-consorcio` deve continuar** para cadastrar **cartas de consórcio** (consortium_cards) - é outro propósito.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/Negocios.tsx` | Melhorar lógica do `effectiveOriginId` para evitar retornar ID de grupo |
| `src/components/crm/DealKanbanBoard.tsx` | Adicionar loading state para etapas |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Funil BU-LEILÃO selecionado, sem origem | "Nenhum estágio configurado" | Loading → Primeira origem selecionada automaticamente |
| Origem específica selecionada | Funciona (já estava OK) | Continua funcionando |
| Carregamento de etapas | Flash de "sem estágio" | Spinner de loading |
