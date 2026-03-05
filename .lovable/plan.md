

## Plano: Badge de parceiro com nome completo do produto

### Problema
O hook `usePartnerProductDetectionBatch` retorna apenas o código do produto (A001, A009, etc.) como `productName`. O usuário quer ver o nome completo da parceria (ex: "MCF INCORPORADOR COMPLETO").

### Alterações

**`src/hooks/usePartnerProductDetection.ts`**
- Alterar `emailToProduct` para guardar tanto o `label` quanto o `product_name` original da transação
- Retornar `productName` com o nome completo do produto da Hubla (ex: "MCF INCORPORADOR COMPLETO + THE CLUB") e `productLabel` com o código curto (A009)

**`src/components/crm/ContactCard.tsx`**
- Adicionar prop `partnerProduct?: PartnerProductInfo`
- Quando `isPartner === true`, renderizar badge amber na Row 1: `🤝 MCF INCORPORADOR COMPLETO`
- Usar `productName` (nome completo) no badge

**`src/pages/crm/Contatos.tsx`**
- Importar e chamar `usePartnerProductDetectionBatch` com array `{ id, email }` dos `filteredContacts`
- Passar `partnerProduct={partnerMap?.[contact.id]}` para cada `ContactCard`

### Resultado
- Cards de parceiros exibem badge com nome completo do produto (ex: `🤝 MCF INCORPORADOR COMPLETO`)
- Detecção em batch, sem queries individuais por contato

