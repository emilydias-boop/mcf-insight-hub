

# Plano de Correção: Stages e Webhook do CRM por BU

## Problemas Identificados

### 1. Stages não aparecem no CRM Consórcio
O componente `Negocios.tsx` usa `useMyBU()` (BU do perfil do usuário) em vez de `useActiveBU()` (BU da rota).  
Quando você acessa `/consorcio/crm/negocios`, o sistema ainda busca pipelines baseados na BU do seu **perfil** e não no contexto da **rota**.

### 2. Webhook Consórcio (esclarecimento)
O webhook `webhook-consorcio` já existe e está funcionando, mas ele insere dados na tabela `consortium_cards` (gestão de cartas de consórcio), **não** no CRM de deals/Kanban.

Para receber leads no CRM do Consórcio (Kanban), deve-se usar o sistema `webhook-lead-receiver` que já existe, configurando um endpoint via interface do CRM.

---

## Correção Técnica

### Arquivo: `src/pages/crm/Negocios.tsx`

**Problema**: Linhas 64 e 72-75 usam `useMyBU()` que busca a BU do perfil do usuário.

**Solução**: Substituir por `useActiveBU()` que respeita o contexto da rota.

```typescript
// ANTES (linha 64):
const { data: myBU, isLoading: isLoadingBU } = useMyBU();

// DEPOIS:
import { useActiveBU } from '@/hooks/useActiveBU';
// ...
const activeBU = useActiveBU();
const isLoadingBU = false; // useActiveBU é síncrono
```

**E atualizar as referências**:
```typescript
// ANTES (linha 72-75):
const buAuthorizedOrigins = useMemo(() => {
  if (!myBU) return [];
  return BU_PIPELINE_MAP[myBU] || [];
}, [myBU]);

// DEPOIS:
const buAuthorizedOrigins = useMemo(() => {
  if (!activeBU) return [];
  return BU_PIPELINE_MAP[activeBU] || [];
}, [activeBU]);

// ANTES (linha 132):
if (myBU && BU_DEFAULT_ORIGIN_MAP[myBU]) {
  setSelectedPipelineId(BU_DEFAULT_ORIGIN_MAP[myBU]);

// DEPOIS:
if (activeBU && BU_DEFAULT_ORIGIN_MAP[activeBU]) {
  setSelectedPipelineId(BU_DEFAULT_ORIGIN_MAP[activeBU]);
```

---

## Verificação de Dados

Confirmei que as stages do Consórcio já existem no banco:

| origin_id | name | stage_order |
|-----------|------|-------------|
| `4e2b810a-...` | NOVO LEAD GRATUITO | 1 |
| `4e2b810a-...` | NOVO LEAD | 2 |
| `4e2b810a-...` | LEAD QUALIFICADO | 3 |
| `4e2b810a-...` | REUNIÃO 1 AGENDADA | 4 |
| ... | ... | ... |

A origem mapeada para `consorcio` é `4e2b810a-6782-4ce9-9c0d-10d04c018636` e já tem 9 stages configuradas.

---

## Resumo das Alterações

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/crm/Negocios.tsx` | Substituir `useMyBU()` por `useActiveBU()` |

---

## Resultado Esperado

Após a correção:
- `/consorcio/crm/negocios` → Mostrará as stages do Consórcio
- `/leilao/crm/negocios` → Mostrará as stages do Leilão
- `/crm/negocios` → Continuará usando a BU do perfil do usuário

---

## Webhook para CRM (Orientação)

Se desejar receber leads diretamente no Kanban do Consórcio:

1. Acessar o CRM Consórcio → Configurações da pipeline
2. Ir em **Integrações → Webhooks de Entrada**
3. Criar novo webhook (ex: slug `consorcio-leads`)
4. Endpoint gerado: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver?slug=consorcio-leads`

O webhook `webhook-consorcio` existente continuará servindo para a gestão de **cartas de consórcio** (tabela `consortium_cards`), que é um módulo diferente.

