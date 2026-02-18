

# Corrigir Match por Telefone no CloserRevenueSummaryTable

## Problema Identificado

A logica de matching por telefone no `CloserRevenueSummaryTable.tsx` tem duas falhas:

1. **Telefone do attendee ignorado**: O componente so extrai telefone de `crm_deals.crm_contacts.phone` (linha 97), mas ignora `attendee_phone` (que esta disponivel na interface, linha 16). O `useAcquisitionReport.ts` ja faz isso corretamente (linhas 258-262).

2. **Sem match por sufixo**: Numeros brasileiros podem estar armazenados com ou sem codigo de pais (`55`). Exemplo: a transacao Hubla tem `+5511999887766` (normalizado: `5511999887766`) e o CRM tem `11999887766`. A comparacao exata falha. Precisamos comparar pelos ultimos 8-9 digitos (sufixo).

## Alteracoes

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

**Mudanca 1 - Indexar `attendee_phone` alem de `crm_contacts.phone`** (linhas 87-105):

Adicionar indexacao do `attendee_phone` no loop de construcao do mapa de contatos por closer, seguindo o mesmo padrao do `useAcquisitionReport.ts`.

**Mudanca 2 - Match por sufixo de telefone** (linhas 48-50 e 168-206):

Criar helper `phoneSuffix(phone)` que retorna os ultimos 9 digitos do telefone normalizado. Usar esse sufixo como chave no mapa `phones` e na comparacao de transacoes. Isso garante que `5511999887766` e `11999887766` resultem no mesmo sufixo `999887766`.

```text
// Novo helper
const phoneSuffix = (phone: string | null | undefined): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};
```

**Mudanca 3 - Tambem indexar `attendee_phone` para earliest meeting map**:

Garantir que o mapa `earliestMap` tambem registre o sufixo do `attendee_phone` para deteccao correta de "Outside".

### Arquivo: `src/hooks/useAcquisitionReport.ts`

**Mudanca 4 - Aplicar sufixo no useAcquisitionReport tambem** (linhas 253-264, 287-289):

Usar `phoneSuffix` em vez de `normalizePhone` nas chaves do `phoneMap` e na lookup de transacoes, para consistencia.

## Resultado

- Transacoes cujo telefone Hubla difere do CRM apenas pelo prefixo `55` serao corretamente atribuidas ao closer
- Transacoes cujo telefone esta no `attendee_phone` (mas nao no `crm_contacts.phone`) tambem serao encontradas
- Ambos os componentes (tabela resumo e relatorio de aquisicao) usarao a mesma logica de sufixo

