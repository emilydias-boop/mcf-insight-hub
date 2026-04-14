

## Plano: Classificar Origem dos Leads R2 (A010 > ANAMNESE > LIVE)

### Problema atual

O código usa `slot.lead_type` (campo quase sempre vazio) para classificar origem dos R2 leads, resultando em 0/0/tudo em "Outros".

### Lógica correta (da agenda R2)

Para cada R2 attendee (não-parceiro, não-cancelado), classificar com prioridade:
1. **A010**: email do lead existe em `hubla_transactions` com `product_category = 'a010'` e `sale_status IN ('completed','paid')`
2. **ANAMNESE**: tags do contato ou nome da origin contém "anamnese" (e NÃO é A010)
3. **LIVE**: todos os demais

Verificação no banco (semana 04-10/04): ~43 A010, ~1 ANAMNESE, ~5 LIVE (total 49, restante são do range do carrinho/encaixados).

### Correções em `supabase/functions/weekly-manager-report/index.ts`

**1. Expandir SELECT dos R2 attendees para incluir deal_id**

Adicionar `deal_id` ao select dos R2 attendees (já existe no schema, só precisa incluir no select).

**2. Buscar emails e tags via deal → contact**

Após obter os R2 attendees, coletar todos os `deal_id`s e fazer uma query batch:
```ts
const dealIds = r2NonPartner.map(a => a.deal_id).filter(Boolean);
const { data: dealContacts } = await supabase
  .from('crm_deals')
  .select('id, contact_id, origin_id, crm_contacts(email, tags), crm_origins(name)')
  .in('id', dealIds);
```

**3. Buscar emails A010 em batch**

Coletar todos os emails dos contacts e verificar quais são A010:
```ts
const { data: a010Records } = await supabase
  .from('hubla_transactions')
  .select('customer_email')
  .eq('product_category', 'a010')
  .in('sale_status', ['completed', 'paid'])
  .in('customer_email', emails);
const a010Set = new Set(a010Records.map(r => r.customer_email.toLowerCase()));
```

**4. Classificar cada attendee**

No loop de contagem, substituir `slot.lead_type` pela lógica:
```ts
const email = dealContactMap[att.deal_id]?.email?.toLowerCase();
const tags = dealContactMap[att.deal_id]?.tags || [];
const originName = dealContactMap[att.deal_id]?.originName || '';

if (email && a010Set.has(email)) originA010++;
else if (tags.some(t => t.includes('anamnese')) || originName.includes('anamnese')) originAnamnese++;
else originLive++;
```

**5. Atualizar HTML**

Trocar os 3 cards para:
- **A010** (amarelo/default) — leads com compra A010 confirmada
- **ANAMNESE** (azul) — leads de anamnese sem A010
- **LIVE** (verde) — todos os demais

### Resultado esperado

Cards mostrarão a distribuição real: ~43 A010, ~1 ANAMNESE, ~5 LIVE (para semana 04-10/04).

