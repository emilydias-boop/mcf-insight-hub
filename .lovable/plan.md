
# Plano: Automação de Criação de Deals para Produtos Hubla no CRM de Consórcio

## Resumo Executivo

Implementar automação no webhook da Hubla para criar deals automaticamente no pipeline **"Efeito Alavanca + Clube"** quando os seguintes produtos são vendidos:

| Produto | Etapa de Destino | Valor Ref. |
|---------|------------------|------------|
| Clube do Arremate | CLUBE DO ARREMATE | R$ 297 |
| A006 - Renovação Parceiro MCF | RENOVAÇÃO HUBLA | R$ 1.000 |
| Contrato - Clube do Arremate | CLUBE DO ARREMATE | R$ 497 |

## Arquitetura da Solução

```text
┌──────────────────────────────────────────────────────────────────┐
│                          HUBLA WEBHOOK                           │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│            hubla-webhook-handler (Edge Function)                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Detectar categoria do produto                          │  │
│  │    - 'clube_arremate' → CLUBE DO ARREMATE                 │  │
│  │    - 'renovacao' → RENOVAÇÃO HUBLA                        │  │
│  │    - 'contrato_clube_arremate' → CLUBE DO ARREMATE        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 2. createDealForConsorcioProduct()                         │  │
│  │    - Buscar/criar contato                                  │  │
│  │    - Verificar deal existente em QUALQUER pipeline         │  │
│  │    - Criar novo deal no Consórcio                          │  │
│  │    - Vincular via custom_fields.linked_deal_id             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Mapeamento de Produtos → Etapas

| Produto Hubla | Categoria | Origin ID (Pipeline) | Stage ID (Etapa) |
|---------------|-----------|----------------------|------------------|
| Clube do Arremate | clube_arremate | 7d7b1cb5-2a44-4552-9eff-c3b798646b78 | bf370a4f-1476-4933-8c70-01a38cfdb34f |
| Contrato - Clube do Arremate | contrato_clube_arremate | 7d7b1cb5-2a44-4552-9eff-c3b798646b78 | bf370a4f-1476-4933-8c70-01a38cfdb34f |
| A006 - Renovação Parceiro MCF | renovacao | 7d7b1cb5-2a44-4552-9eff-c3b798646b78 | 3e545cd2-4214-4510-9ec4-dfcc6eccede8 |

## Detalhes de Implementação

### 1. Atualizar Mapeamento de Categorias

Adicionar novas categorias ao `PRODUCT_MAPPING` existente:

```typescript
const PRODUCT_MAPPING = {
  // ... (existente)
  
  // Consórcio - Clube do Arremate
  'CLUBE DO ARREMATE': 'clube_arremate',
  'CLUBE ARREMATE': 'clube_arremate',
  'CONTRATO - CLUBE DO ARREMATE': 'contrato_clube_arremate',
  
  // Consórcio - Renovação (A006 já está mapeado como 'renovacao')
};
```

### 2. Nova Função: `createDealForConsorcioProduct()`

Lógica principal:

1. **Buscar contato existente** por email ou telefone
2. **Verificar deal existente** do cliente em qualquer pipeline
3. **Criar novo deal** no pipeline "Efeito Alavanca + Clube"
4. **Vincular ao deal existente** (se houver) via `custom_fields.linked_deal_id`
5. **Registrar atividade** no deal de origem (se existir)

### 3. Constantes de Configuração

```typescript
// IDs fixos do pipeline Consórcio
const CONSORCIO_ORIGIN_ID = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';
const STAGE_CLUBE_ARREMATE = 'bf370a4f-1476-4933-8c70-01a38cfdb34f';
const STAGE_RENOVACAO_HUBLA = '3e545cd2-4214-4510-9ec4-dfcc6eccede8';

// Mapeamento categoria → stage
const CONSORCIO_STAGE_MAP = {
  'clube_arremate': STAGE_CLUBE_ARREMATE,
  'contrato_clube_arremate': STAGE_CLUBE_ARREMATE,
  'renovacao': STAGE_RENOVACAO_HUBLA,
};
```

### 4. Integração no Fluxo do Webhook

Após salvar a transação em `hubla_transactions`, verificar se é produto de consórcio:

```typescript
// Após upsert da transação
if (['clube_arremate', 'contrato_clube_arremate', 'renovacao'].includes(productCategory)) {
  // Apenas primeira parcela cria deal
  if (installment === 1) {
    await createDealForConsorcioProduct(supabase, {
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
      productName: productName,
      productCategory: productCategory,
      value: netValue,
      saleDate: saleDate,
    });
  }
}
```

### 5. Vinculação com Deal Existente

Quando o cliente já tem deal em outro pipeline:

1. Encontrar o deal mais recente do contato
2. Armazenar `linked_deal_id` no `custom_fields` do novo deal
3. Criar atividade "🔗 Deal criado no Consórcio" no deal original

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Adicionar função `createDealForConsorcioProduct()` e integrar no fluxo |

## Teste da Implementação

Após deploy, simular webhook com payload de "Clube do Arremate":

```json
{
  "event": "NewSale",
  "productName": "Clube do Arremate",
  "userEmail": "teste@email.com",
  "userPhone": "+5511999998888",
  "userName": "Cliente Teste"
}
```

**Resultado esperado:**
- Novo deal criado em "Efeito Alavanca + Clube"
- Etapa inicial: "CLUBE DO ARREMATE"
- Se cliente tinha deal em outro pipeline → atividade registrada

## Mirroring de Stages (crm_stages)

As stages do `local_pipeline_stages` já estão espelhadas na tabela `crm_stages` com os mesmos IDs:

| Stage ID | Nome |
|----------|------|
| bf370a4f-1476-4933-8c70-01a38cfdb34f | CLUBE DO ARREMATE |
| 3e545cd2-4214-4510-9ec4-dfcc6eccede8 | RENOVAÇÃO HUBLA |

Isso garante compatibilidade com Foreign Keys e visualização correta no Kanban.

---

## Seção Técnica

### Detecção de Categoria (Atualização)

```typescript
function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  
  // Prioridade: Contrato - Clube do Arremate (específico)
  if (name.includes('CONTRATO') && name.includes('CLUBE')) {
    return 'contrato_clube_arremate';
  }
  
  // Clube do Arremate (genérico)
  if (name.includes('CLUBE') && name.includes('ARREMATE')) {
    return 'clube_arremate';
  }
  
  // A006 / Renovação (já existente)
  // ... resto do código existente
}
```

### Função Principal

```typescript
interface ConsorcioDealData {
  email: string | null;
  phone: string | null;
  name: string | null;
  productName: string;
  productCategory: string;
  value: number;
  saleDate: string;
}

async function createDealForConsorcioProduct(
  supabase: any, 
  data: ConsorcioDealData
): Promise<void> {
  // 1. Determinar stage de destino
  const stageId = CONSORCIO_STAGE_MAP[data.productCategory];
  if (!stageId) return;
  
  // 2. Buscar ou criar contato
  let contactId = await findOrCreateContact(supabase, data);
  if (!contactId) return;
  
  // 3. Verificar deal existente do contato (qualquer pipeline)
  const existingDeal = await findExistingDeal(supabase, contactId);
  
  // 4. Verificar se já existe deal neste pipeline para evitar duplicação
  const dealInConsorcio = await checkDealInOrigin(
    supabase, contactId, CONSORCIO_ORIGIN_ID
  );
  if (dealInConsorcio) {
    // Atualizar tags/value do deal existente
    await updateExistingDeal(supabase, dealInConsorcio, data);
    return;
  }
  
  // 5. Criar novo deal no Consórcio
  const newDealId = await createDeal(supabase, {
    contactId,
    originId: CONSORCIO_ORIGIN_ID,
    stageId,
    name: `${data.name} - ${data.productName}`,
    value: data.value,
    linkedDealId: existingDeal?.id || null,
  });
  
  // 6. Registrar atividade no deal original (se existir)
  if (existingDeal && newDealId) {
    await logActivityOnDeal(supabase, existingDeal.id, 
      `🔗 Cliente comprou "${data.productName}" - Deal criado no Consórcio`
    );
  }
}
```
