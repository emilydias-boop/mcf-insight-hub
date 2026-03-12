

## Problema: Closer R1, R2, SDR mostram nome do produto/canal ao invés de nomes reais

### Causa raiz

No `useAcquisitionReport.ts` (linhas 322-334), para origens automáticas (A010, Vitalício, Lançamento, Renovação), o hook retorna o **nome da origem** como `closerName` e `sdrName`:

```typescript
const closerName = closerId
  ? (closerNameMap.get(closerId) || 'Closer Desconhecido')
  : (isAutomatic ? origin : 'Sem Closer');  // ← "A010", "Vitalício" etc.

const sdrName = sdrId
  ? (...)
  : (isAutomatic ? origin : 'Sem SDR');  // ← mesma coisa
```

Isso é útil para agregação por dimensão (tabela de aquisição), mas na tabela de transações aparece "A010" na coluna Closer R1, confundindo com o produto.

### Correção

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

No `getEnrichedData`, filtrar valores que são nomes de origem automática e substituí-los por `'-'`:

```typescript
const AUTOMATIC_ORIGIN_NAMES = new Set(['A010', 'Lançamento', 'Renovação', 'Vitalício', 'Live', 'Bio Instagram', 'Outros', 'Contrato']);

const getEnrichedData = (row: any) => {
  const info = classifiedByTxId.get(row.id);
  const email = (row.customer_email || '').toLowerCase().trim();
  
  // Only show actual person names, not origin labels
  const closerR1 = info?.closerName && !AUTOMATIC_ORIGIN_NAMES.has(info.closerName) && info.closerName !== 'Sem Closer'
    ? info.closerName : '-';
  const sdr = info?.sdrName && !AUTOMATIC_ORIGIN_NAMES.has(info.sdrName) && info.sdrName !== 'Sem SDR'
    ? info.sdrName : '-';

  return {
    canal: info?.origin || '-',
    closerR1,
    closerR2: r2CloserByEmail.get(email) || '-',
    sdr,
    dtContrato: contractDates.get(email) || null,
    dtParceria: partnershipDates.get(email) || null,
  };
};
```

Isso garante que Closer R1, Closer R2, SDR só exibam nomes de pessoas reais. Quando não houver atribuição, mostra `'-'`.

