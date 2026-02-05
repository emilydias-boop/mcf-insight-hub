
# Corrigir Plano OTE da Carol Correa e Sincronização com Catálogo

## Problema Identificado

A Carol Correa (SDR N2) possui um plano de compensação (`sdr_comp_plan`) com valores desatualizados:

| Campo | Plano Atual | Catálogo Correto |
|-------|------------|------------------|
| OTE Total | R$ 4.350 | R$ 4.500 |
| Variável | R$ 1.200 | R$ 1.350 |
| Fixo | R$ 3.150 | R$ 3.150 |

O plano foi criado em 01/11/2025 e está vigente até hoje (`vigencia_fim = null`).

---

## Parte 1: Correção Imediata (Carol Correa)

### Opção A: Correção via SQL (mais rápida)

Executar um UPDATE direto na tabela `sdr_comp_plan`:

```sql
UPDATE sdr_comp_plan
SET 
  ote_total = 4500,
  variavel_total = 1350,
  updated_at = NOW()
WHERE id = '4cceabd7-4b98-46c6-a94d-3c8a4b5bbe8a';
```

### Opção B: Correção via Interface

Usar o botão "Editar" na aba "Planos OTE" do Fechamento para ajustar os valores manualmente.

---

## Parte 2: Funcionalidade de Sincronização em Massa

### Objetivo

Adicionar um botão "Sincronizar com Catálogo" na aba `PlansOteTab` que:

1. Identifica colaboradores com divergência entre `sdr_comp_plan` e `cargos_catalogo`
2. Exibe lista de divergências para revisão
3. Permite sincronizar todos de uma vez ou individualmente

### Mudanças Necessárias

#### 2.1. Adicionar lógica de detecção de divergências em `PlansOteTab.tsx`

```typescript
// Calcular divergências
const divergencias = useMemo(() => {
  return employeesWithPlans.filter(emp => {
    if (!emp.comp_plan || !emp.cargo_catalogo) return false;
    
    return (
      emp.comp_plan.ote_total !== emp.cargo_catalogo.ote_total ||
      emp.comp_plan.fixo_valor !== emp.cargo_catalogo.fixo_valor ||
      emp.comp_plan.variavel_total !== emp.cargo_catalogo.variavel_valor
    );
  });
}, [employeesWithPlans]);
```

#### 2.2. Adicionar botão e dialog de sincronização

```typescript
// Estado do dialog
const [syncDialog, setSyncDialog] = useState(false);

// Mutation para sincronizar
const syncWithCatalog = useMutation({
  mutationFn: async (empIds: string[]) => {
    for (const emp of employeesWithPlans.filter(e => empIds.includes(e.id))) {
      if (!emp.sdr_id || !emp.cargo_catalogo || !emp.comp_plan) continue;
      
      await supabase
        .from('sdr_comp_plan')
        .update({
          ote_total: emp.cargo_catalogo.ote_total,
          fixo_valor: emp.cargo_catalogo.fixo_valor,
          variavel_total: emp.cargo_catalogo.variavel_valor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', emp.comp_plan.id);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sdr-comp-plans'] });
    toast.success('Planos sincronizados com sucesso');
    setSyncDialog(false);
  },
});
```

#### 2.3. UI do Botão e Dialog

Na header do Card, adicionar:

```tsx
{divergencias.length > 0 && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setSyncDialog(true)}
    className="text-yellow-600 border-yellow-600"
  >
    <AlertTriangle className="h-4 w-4 mr-2" />
    {divergencias.length} divergência(s)
  </Button>
)}
```

Dialog mostrando lista de divergências:

```tsx
<Dialog open={syncDialog} onOpenChange={setSyncDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Sincronizar Planos com Catálogo</DialogTitle>
    </DialogHeader>
    
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Plano Atual</TableHead>
          <TableHead>Catálogo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {divergencias.map(emp => (
          <TableRow key={emp.id}>
            <TableCell>{emp.nome_completo}</TableCell>
            <TableCell>
              OTE: {formatCurrency(emp.comp_plan!.ote_total)}
            </TableCell>
            <TableCell>
              OTE: {formatCurrency(emp.cargo_catalogo!.ote_total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    
    <DialogFooter>
      <Button onClick={() => syncWithCatalog.mutate(divergencias.map(d => d.id))}>
        Sincronizar Todos
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| **SQL** | UPDATE para corrigir plano da Carol Correa |
| `src/components/fechamento/PlansOteTab.tsx` | Adicionar detecção de divergências, botão de alerta e dialog de sincronização |

---

## Sequência de Implementação

1. **Corrigir Carol Correa** via SQL UPDATE (imediato)
2. **Adicionar funcionalidade de sincronização** em `PlansOteTab.tsx` para futuras divergências
