

## Correção: Reembolso não detectado para contatos sem email

### Causa raiz
O cruzamento com `hubla_transactions` para detectar reembolsos usa apenas email. Porém, Marco Aurélio Cunta e Monique Andrade têm `email = null` no `crm_contacts`. Seus reembolsos existem na Hubla (`sale_status = 'refunded'`, `product_name LIKE '%Contrato%'`), mas o match nunca acontece.

### Solução
Adicionar cross-reference por **telefone** como fallback quando email não está disponível.

### Alterações em `src/hooks/useContractLifecycleReport.ts`

1. **Coletar telefones refundidos**: Além de `refundedEmailsSet`, criar `refundedPhonesSet` com os `customer_phone` das transações refundidas (normalizados para sufixo de 9 dígitos)

2. **Mapear attendee → phone**: Além de `attendeeEmailMap`, criar `attendeePhoneMap` usando `att.attendee_phone || att.deal?.contact?.phone`

3. **Atualizar check de refund**: 
```ts
const contactEmail = attendeeEmailMap.get(att.id);
const contactPhone = attendeePhoneMap.get(att.id);
const isHublaRefunded = 
  (contactEmail ? refundedEmailsSet.has(contactEmail) : false) ||
  (contactPhone ? refundedPhonesSet.has(normalizePhone(contactPhone)) : false);
```

4. **Normalização de telefone**: Usar sufixo de 9 dígitos (mesma lógica já usada no projeto para deduplicação) para evitar falsos negativos por formatação diferente (+55, com espaço, etc.)

### Seção técnica

A normalização será uma função simples:
```ts
function normalizePhoneSuffix(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-9);
}
```

Isso garante que `+5521985134202`, `21985134202` e `985134202` todos resolvam para o mesmo sufixo `985134202`.

Nenhuma alteração no painel — apenas no hook de dados.

