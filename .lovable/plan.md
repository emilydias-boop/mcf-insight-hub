

## Plano: Adicionar exportação de leads filtrados no Limbo

### Problema
A página Limbo só permite exportar "Não Encontrados". O usuário precisa exportar os leads **filtrados** (qualquer combinação de filtros).

### Mudança

**Arquivo:** `src/pages/crm/LeadsLimbo.tsx`

Adicionar um botão "Exportar Filtrados" ao lado do "Exportar Não Encontrados" (linha ~635). O botão exporta o array `filtered` (que já aplica todos os filtros ativos: status, estágio, dono, busca) para Excel.

```typescript
const exportFiltered = () => {
  if (!filtered.length) return;
  const wsData = filtered.map(r => ({
    'Nome (Clint)': r.excelName,
    Email: r.excelEmail,
    Telefone: r.excelPhone || '',
    Tags: r.excelStage || '',
    'Criado em': r.createdAt || '',
    'Últ. Mov.': r.lostAt || '',
    Status: r.status === 'com_dono' ? 'Com Dono' : r.status === 'sem_dono' ? 'Sem Dono' : 'Não Encontrado',
    'Dono Atual': r.localOwner || r.excelOwner || '',
  }));
  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads Filtrados');
  XLSX.writeFile(wb, `leads-limbo-filtrados-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  toast.success(`${filtered.length} leads exportados`);
};
```

Botão na barra de ações:
```tsx
<Button variant="outline" size="sm" onClick={exportFiltered} disabled={filtered.length === 0}>
  <Download className="h-4 w-4 mr-1" /> Exportar Filtrados ({filtered.length})
</Button>
```

