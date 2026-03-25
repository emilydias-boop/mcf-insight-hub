
## Context

The user wants two things for the **BU-Consórcio CRM**:

1. **XLSX support in ImportarNegocios** — the `handleFileChange` function only accepts `.csv` and rejects anything else. The upload `<input>` also has `accept=".csv"`. The XLSX library is already imported in the project.

2. **Lead validator (SpreadsheetCompareDialog) accessible in Consórcio** — the "Importar Planilha" button in `Negocios.tsx` (line 688) is gated to `admin || manager`. `coordenador` users in Consórcio never see it. The `SpreadsheetCompareDialog` is the full validator: scans all CRM contacts by name/email/phone across ALL pipelines, shows "Nesta pipeline / Em outra pipeline / Novo" per lead, and lets the user block or allow before importing.

3. **`ImportarNegocios.tsx` BU fix** — the `queryKey` and `bu` filter are hardcoded to `'incorporador'` so Consórcio pipelines never appear.

## Files to Change

### 1. `src/pages/crm/Negocios.tsx` — line 688
Add `coordenador` to the role guard so the "Importar Planilha" button (and the full `SpreadsheetCompareDialog` validator) appears for Consórcio users.

```tsx
// Before
{(role === 'admin' || role === 'manager') && (

// After
{(role === 'admin' || role === 'manager' || role === 'coordenador') && (
```

### 2. `src/pages/crm/ImportarNegocios.tsx` — three changes

**a) XLSX support in file input (line 438)**
```tsx
// Before
accept=".csv"
// After
accept=".csv,.xlsx,.xls"
```

**b) File validation in `handleFileChange` (line 136)**
```tsx
// Before: rejects anything not .csv
if (!selectedFile.name.endsWith('.csv')) {
  toast.error('Por favor, selecione um arquivo CSV');
  return;
}
// After: accept csv, xlsx, xls
const ext = selectedFile.name.split('.').pop()?.toLowerCase();
if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
  toast.error('Formato inválido. Use CSV, XLSX ou XLS');
  return;
}
```

**c) BU-aware pipeline query (lines 52-94)**
```tsx
// Before: hardcoded 'incorporador'
import { useActiveBU } from '@/hooks/useActiveBU';

const activeBU = useActiveBU();
// Update queryKey and .eq('bu', activeBU || 'incorporador')
```

Since `ImportarNegocios` sends the file to the `import-deals-csv` edge function via FormData, XLSX parsing happens server-side. But the edge function likely only handles CSV. We need to parse XLSX on the client side and convert to CSV before sending — OR add a step that uses the `XLSX` library (already a dependency) to convert XLSX to CSV text client-side, then send that as a blob.

**Approach**: On file select, if the file is XLSX/XLS, parse it with the `XLSX` library into a CSV string and store it as a synthetic File object. The rest of the upload flow is unchanged.

```tsx
import * as XLSX from 'xlsx';

const handleFileChange = async (e) => {
  const selectedFile = e.target.files?.[0];
  const ext = selectedFile.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'xlsx' || ext === 'xls') {
    // Convert to CSV client-side
    const data = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(data);
    const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    const csvFile = new File([csvText], selectedFile.name.replace(/\.[^.]+$/, '.csv'), { type: 'text/csv' });
    setFile(csvFile);
  } else {
    setFile(selectedFile);
  }
};
```

This is clean — no edge function changes needed, just transparent XLSX→CSV conversion before upload.

## Summary

| File | Change |
|---|---|
| `src/pages/crm/Negocios.tsx` | Add `coordenador` to role guard (1 line) |
| `src/pages/crm/ImportarNegocios.tsx` | Add XLSX→CSV conversion on file select; fix BU to use `useActiveBU()`; update file input accept |
