

## Plano: Vincular SDR manualmente na tela de Planos OTE

### Problema
Colaboradores que aparecem com "Sem vínculo SDR" não podem ter seus planos editados. A trigger automática só roda quando `profile_id` é preenchido, mas em alguns casos o vínculo não acontece (employee sem profile, email divergente, etc). Não existe opção manual.

### Solução
Adicionar um botão "Vincular SDR" na linha de cada colaborador sem `sdr_id`, que abre um dialog para:
1. Buscar um SDR existente na tabela `sdr` (por nome/email)
2. Ou criar um novo registro SDR automaticamente (usando nome/email do employee)

Após vincular, o `employees.sdr_id` é atualizado e o plano pode ser editado.

### Mudanças

**Arquivo:** `src/components/fechamento/PlansOteTab.tsx`

1. Adicionar um estado `linkDialog` para controlar o dialog de vinculação
2. Na célula onde aparece "Sem vínculo SDR", adicionar um botão clicável "Vincular"
3. Criar um dialog com:
   - Select pesquisável listando SDRs ativos sem vínculo a um employee
   - Botão "Criar novo SDR" que auto-preenche com dados do employee
4. Mutation para atualizar `employees.sdr_id` (e opcionalmente criar SDR)

**Lógica principal:**

```typescript
// Query: SDRs disponíveis (sem employee vinculado)
const { data: availableSdrs } = useQuery({
  queryKey: ['available-sdrs'],
  queryFn: async () => {
    const { data } = await supabase
      .from('sdr')
      .select('id, name, email, squad')
      .eq('active', true)
      .order('name');
    return data;
  },
});

// Vincular SDR existente
const linkSdr = useMutation({
  mutationFn: async ({ employeeId, sdrId }) => {
    await supabase
      .from('employees')
      .update({ sdr_id: sdrId })
      .eq('id', employeeId);
  },
});

// Criar novo SDR + vincular
const createAndLinkSdr = useMutation({
  mutationFn: async ({ employee }) => {
    const squad = mapDeptToSquad(employee.departamento);
    const { data: newSdr } = await supabase
      .from('sdr')
      .insert({ name, email, squad, role_type, active: true, meta_diaria: 7 })
      .select('id')
      .single();
    await supabase
      .from('employees')
      .update({ sdr_id: newSdr.id })
      .eq('id', employee.id);
  },
});
```

O botão "Vincular" substitui o texto "Sem vínculo SDR" e o dialog oferece as duas opções (selecionar existente ou criar novo).

