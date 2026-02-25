

## Correcao: contrato duplicado sem vinculo causa falso Outside

### Problema

A correcao anterior so funciona quando o contrato tem `linked_attendee_id` preenchido. No caso do Edilson existem 2 transacoes de contrato:

```text
c31e5288 - Kiwify   - 24/02 20:58 - linked_attendee_id = 3a8e3764 (deal #2) ✓
95442e91 - Manual   - 24/02 21:06 - linked_attendee_id = NULL              ✗
```

O contrato manual sem vinculo continua sendo considerado para TODOS os deals do email, causando falso Outside no deal #3.

### Opcoes de correcao

**Opcao A - Vincular o contrato orfao manualmente (correcao pontual)**

Atualizar `linked_attendee_id` do contrato `95442e91` para apontar para o mesmo attendee `3a8e3764` do deal #2. Isso resolve o caso do Edilson, mas nao previne futuros casos.

**Opcao B - Melhorar a logica do hook (correcao sistemica)**

Quando existem contratos vinculados E nao-vinculados para o mesmo email, e os vinculados ja apontam para outro deal, ignorar tambem os nao-vinculados que tem o mesmo `product_name` e `sale_date` proximo (duplicatas). Logica:

```text
Para cada deal:
  1. Filtrar contratos onde linkedDealId = null OU linkedDealId = este deal
  2. Se existem contratos vinculados a OUTRO deal para este email,
     e os contratos nao-vinculados tem sale_date dentro de 24h dos vinculados,
     considerar como duplicata e IGNORAR tambem
```

**Opcao C - Ignorar contratos nao-vinculados quando existem vinculados (mais simples)**

Se para um dado email existem contratos COM `linked_attendee_id` preenchido, entao os contratos SEM vinculo sao considerados duplicatas/orfaos e sao ignorados para fins de Outside detection. So se NENHUM contrato tiver vinculo, ai considerar todos.

### Plano recomendado: Opcao C + limpeza de dados

**1. Alterar `useOutsideDetectionForDeals.ts` (logica no passo 6)**

Antes de filtrar contratos relevantes por deal, verificar se existem contratos vinculados para o email. Se sim, descartar os nao-vinculados:

```typescript
// No loop do passo 6, ANTES de filtrar por deal:
const hasLinkedContracts = emailContracts.some(c => c.linkedDealId !== null);

for (const entry of dealEntries) {
  const relevantContracts = emailContracts.filter(c => {
    // Se existem contratos vinculados, ignorar os nao-vinculados (duplicatas)
    if (hasLinkedContracts && !c.linkedDealId) return false;
    if (!c.linkedDealId) return true;
    return c.linkedDealId === entry.dealId;
  });
  // ... resto da logica
}
```

**2. Vincular contratos orfaos existentes (limpeza SQL)**

Para os contratos que sao claramente duplicatas (mesmo email, mesmo valor, mesma data), vincular ao mesmo attendee:

```sql
UPDATE hubla_transactions 
SET linked_attendee_id = '3a8e3764-bc29-42f0-8aee-735e88829f40'
WHERE id = '95442e91-88c9-4219-9af7-16a450e39717';
```

**3. Limpeza dos deals e contatos duplicados do Edilson**

Como ja planejado anteriormente:
- Cancelar R1 do deal #3 e mover para "Sem Interesse"
- Consolidar os 8 contatos duplicados em 1

### Secao tecnica

A alteracao e no arquivo `src/hooks/useOutsideDetectionForDeals.ts`, linhas 179-212. A mudanca e adicionar uma verificacao de 2 linhas antes do loop de deals:

```typescript
const hasLinkedContracts = emailContracts.some(c => c.linkedDealId !== null);
```

E no filtro (linha 190-193), adicionar a condicao:

```typescript
if (hasLinkedContracts && !c.linkedDealId) return false;
```

Isso garante que contratos duplicatas sem vinculo nao gerem falso Outside quando ja existem contratos vinculados para o mesmo email.

