
# Plano: Unificar A010 na PIPELINE INSIDE SALES + Badge de Reembolso

## Diagnóstico Confirmado

### Situação Atual
- Compras A010 via Hubla criam deals em origem "A010 Hubla" (3.734 origens duplicadas)
- Leads que vieram de LIVE/BIO vão para "PIPELINE INSIDE SALES"
- Quando o mesmo lead compra A010, cria OUTRO deal porque o `origin_id` é diferente
- Reembolso atualiza apenas `hubla_transactions`, não adiciona badge no CRM

### Exemplo do Problema
```text
1. Lorran Pinho entra como LIVE → Deal na PIPELINE INSIDE SALES (owner: Matheus)
2. Lorran compra A010 → NOVO Deal na "A010 Hubla" (sem owner)
3. Resultado: 2 deals para mesma pessoa, SDRs diferentes veem o lead
```

## Solução em 3 Partes

### Parte 1: Direcionar A010 para PIPELINE INSIDE SALES

**Arquivo**: `supabase/functions/hubla-webhook-handler/index.ts`

Alterar a função `createOrUpdateCRMContact` para:
1. Usar "PIPELINE INSIDE SALES" como origem padrão para A010 (não criar "A010 Hubla")
2. Buscar deal existente para o contato ANTES de criar novo
3. Se já existe deal, apenas ATUALIZAR tags/valor (não criar novo)

```typescript
// ANTES:
originName: 'A010 Hubla'

// DEPOIS:
originName: 'PIPELINE INSIDE SALES'

// E adicionar lógica:
// 1. Buscar contato por email/telefone
// 2. Se contato existe, buscar deal existente
// 3. Se deal existe → ATUALIZAR com tag A010 e valor
// 4. Se deal NÃO existe → CRIAR no estágio "Novo Lead"
```

### Parte 2: Adicionar Badge de Reembolso no Deal

**Arquivo**: `supabase/functions/hubla-webhook-handler/index.ts`

Quando receber evento `invoice.refunded`:
1. Buscar contato pelo email
2. Buscar deal associado ao contato
3. Atualizar `custom_fields.reembolso_solicitado = true`
4. Adicionar tag "Reembolso"

```typescript
// NOVA lógica no bloco invoice.refunded:
if (eventType === 'invoice.refunded') {
  // ... código existente ...
  
  // NOVO: Atualizar deal no CRM com badge de reembolso
  const customerEmail = invoice.customer?.email || invoice.customer_email;
  if (customerEmail) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', customerEmail)
      .limit(1)
      .maybeSingle();
    
    if (contact) {
      // Atualizar todos os deals do contato
      await supabase
        .from('crm_deals')
        .update({
          custom_fields: {
            reembolso_solicitado: true,
            reembolso_em: new Date().toISOString(),
            motivo_reembolso: 'Reembolso automático via Hubla'
          },
          tags: supabase.sql`array_append(tags, 'Reembolso')`
        })
        .eq('contact_id', contact.id);
    }
  }
}
```

### Parte 3: Badge Visual no Kanban

**Arquivo**: `src/components/crm/DealKanbanCard.tsx`

Adicionar badge vermelho "Reembolso" quando `deal.custom_fields?.reembolso_solicitado === true`:

```tsx
{/* Badge de Reembolso (se existir) */}
{(deal.custom_fields as any)?.reembolso_solicitado && (
  <Badge 
    variant="outline" 
    className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300 
               dark:bg-red-950 dark:text-red-400 dark:border-red-700"
  >
    Reembolso
  </Badge>
)}
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Alterar origem A010 e adicionar lógica de reembolso no CRM |
| `src/components/crm/DealKanbanCard.tsx` | Adicionar badge visual de reembolso |

## Diagrama do Novo Fluxo

```text
┌─────────────────┐     ┌──────────────────────────┐
│  Compra A010    │────▶│ Buscar contato existente │
│  (Hubla)        │     │ por email/telefone       │
└─────────────────┘     └──────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
           ┌───────────────┐             ┌───────────────────┐
           │ Contato EXISTE│             │ Contato NÃO existe│
           └───────┬───────┘             └─────────┬─────────┘
                   │                               │
                   ▼                               ▼
        ┌─────────────────┐           ┌───────────────────────┐
        │ Buscar deal     │           │ Criar contato + deal  │
        │ existente       │           │ em PIPELINE INSIDE    │
        └────────┬────────┘           │ SALES (Novo Lead)     │
                 │                    └───────────────────────┘
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌───────────────────┐
│ Deal EXISTE   │  │ Deal NÃO existe   │
│ → Atualizar   │  │ → Criar deal      │
│ tags + valor  │  │ em PIPELINE INSIDE│
└───────────────┘  │ SALES (Novo Lead) │
                   └───────────────────┘
```

```text
┌─────────────────┐     ┌───────────────────────────┐
│  Reembolso      │────▶│ Buscar contato por email  │
│  (Hubla)        │     └───────────┬───────────────┘
└─────────────────┘                 │
                                    ▼
                         ┌─────────────────────┐
                         │ Atualizar deal:     │
                         │ • reembolso_solicit │
                         │ • tag "Reembolso"   │
                         └─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Badge vermelho      │
                         │ aparece no Kanban   │
                         └─────────────────────┘
```

## Resultado Esperado

### Antes
- A010 cria deal em "A010 Hubla" (origem separada)
- Leads duplicados (mesma pessoa em pipelines diferentes)
- Reembolso não aparece no CRM
- SDRs diferentes podem ver/agendar o mesmo lead

### Depois
- A010 vai para "PIPELINE INSIDE SALES" (mesma origem dos leads LIVE/BIO)
- Se lead já existe, ATUALIZA o deal (adiciona tag A010 + valor)
- Se lead NÃO existe, cria no estágio "Novo Lead"
- Reembolso adiciona badge vermelho no card do Kanban
- Impossível duplicar porque o origin_id é sempre o mesmo

## Limpeza de Dados (Opcional - Após Testes)

Depois de validar o novo fluxo, podemos executar SQL para:
1. Deletar as 3.734 origens "A010 Hubla" vazias
2. Mover deals órfãos da "A010 Hubla" para "PIPELINE INSIDE SALES"
