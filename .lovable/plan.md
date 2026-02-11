
# Corrigir Parsing de Datas do Excel (Serial Numbers)

## Problema
O Excel armazena datas internamente como numeros seriais (dias desde 01/01/1900). Ao exportar para CSV/XLSX, algumas colunas vem como numeros (ex: `45388.52553240741`) em vez de strings de data formatadas. O `new Date()` do JavaScript nao entende esse formato, resultando em "Invalid Date".

## Solucao
Criar uma funcao auxiliar `parseExcelDate` que detecta se o valor e um numero serial do Excel e o converte para uma data valida. Se ja for uma string de data (ex: `25/11/2024 20:55:19`), parsear normalmente.

## Implementacao

### Arquivo: `src/pages/crm/LeadsLimbo.tsx`

Adicionar funcao utilitaria antes do componente:

```typescript
function parseExcelDate(value: string): Date | null {
  if (!value || value === '') return null;
  
  // Caso 1: Numero serial do Excel (ex: 45388.52553240741)
  const num = Number(value);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // Excel epoch: 01/01/1900, mas com bug do "leap year 1900"
    // Subtrair 25569 dias para converter para Unix epoch, multiplicar por 86400000 ms
    const date = new Date((num - 25569) * 86400000);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Caso 2: Data no formato DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY
  const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (brMatch) {
    const [, day, month, year, hour, min, sec] = brMatch;
    return new Date(+year, +month - 1, +day, +(hour || 0), +(min || 0), +(sec || 0));
  }
  
  // Caso 3: Tentar parse nativo
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
```

Atualizar as duas `TableCell` que exibem as datas para usar essa funcao:

```typescript
// Criado em
{row.excelCreatedAt ? (() => {
  const d = parseExcelDate(row.excelCreatedAt);
  return d ? format(d, 'dd/MM/yy') : '--';
})() : '--'}

// Ult. Mov.
{row.excelLostAt ? (() => {
  const d = parseExcelDate(row.excelLostAt);
  return d ? format(d, 'dd/MM/yy') : '--';
})() : '--'}
```

## Arquivo modificado
- `src/pages/crm/LeadsLimbo.tsx` - Adicionar `parseExcelDate` e atualizar renderizacao das colunas de data
