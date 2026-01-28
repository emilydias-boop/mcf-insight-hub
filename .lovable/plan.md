

# Plano: Integração Planos OTE com Métricas Ativas

## Objetivo

Criar uma visualização integrada na aba "Planos OTE" que mostre os membros da equipe com as métricas ativas configuradas para aquele mês/cargo, permitindo ver qual plano cada pessoa está seguindo.

---

## Situação Atual

| Aba | O que mostra |
|-----|--------------|
| **Planos OTE** | Lista estática de planos OTE por SDR (baseado em `sdr_comp_plan`) |
| **Métricas Ativas** | Configuração global de métricas por cargo/mês (tabela `fechamento_metricas_mes`) |

**Problema:** As duas abas não estão conectadas - não é possível ver quais pessoas estão vinculadas a quais métricas para determinado mês.

---

## Solução Proposta

Reformular a aba "Planos OTE" para:

1. **Adicionar filtros no topo** (igual à aba Métricas Ativas):
   - Navegação por mês (Janeiro 2026, etc.)
   - Filtro por Cargo (do catálogo)
   - Filtro por BU/Squad

2. **Mostrar colaboradores da tabela `employees`** filtrados por cargo/BU selecionados

3. **Exibir as métricas ativas** configuradas para aquele mês em colunas extras ou em um painel de detalhes

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Planos OTE                                            [+ Novo Plano OTE]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [< Janeiro 2026 >]  Cargo: [SDR Inside N1 ▼]  BU: [Incorporador ▼]        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Métricas Ativas para este Mês/Cargo:                                  │ │
│  │ • Agendamentos R1 (30%)  • Contratos Pagos (40%)  • Organização (30%) │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐
│  │ Colaborador      │ Cargo           │ OTE Total │ Fixo    │ Variável    │
│  ├──────────────────┼─────────────────┼───────────┼─────────┼─────────────┤
│  │ Carol Souza      │ SDR Inside N1   │ R$ 4.000  │ R$ 2.800│ R$ 1.200    │
│  │ Julia Caroline   │ SDR Inside N1   │ R$ 4.000  │ R$ 2.800│ R$ 1.200    │
│  │ Juliana Rodrigues│ SDR Inside N1   │ R$ 4.000  │ R$ 2.800│ R$ 1.200    │
│  └─────────────────────────────────────────────────────────────────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### 1. Modificar o componente da aba Planos OTE

**Arquivo:** `src/pages/fechamento-sdr/Configuracoes.tsx`

Adicionar ao `TabsContent value="plans"`:

1. **Estados para filtros:**
   ```tsx
   const [selectedPlanDate, setSelectedPlanDate] = useState(new Date());
   const [selectedPlanCargo, setSelectedPlanCargo] = useState<string>('__all__');
   const [selectedPlanBU, setSelectedPlanBU] = useState<string>('__all__');
   ```

2. **Query para buscar employees com join em cargos_catalogo:**
   ```tsx
   const { data: employees } = useEmployees();
   const { data: cargos } = useQuery({
     queryKey: ['cargos-catalogo'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('cargos_catalogo')
         .select('*')
         .eq('ativo', true);
       if (error) throw error;
       return data;
     }
   });
   ```

3. **Query para buscar métricas ativas do mês/cargo selecionado:**
   ```tsx
   const anoMes = format(selectedPlanDate, 'yyyy-MM');
   const { data: metricasAtivas } = useFechamentoMetricas(
     anoMes,
     selectedPlanCargo === '__all__' ? undefined : selectedPlanCargo,
     selectedPlanBU === '__all__' ? undefined : selectedPlanBU
   );
   ```

4. **Filtrar employees pelo cargo/BU:**
   ```tsx
   const filteredEmployees = useMemo(() => {
     if (!employees) return [];
     return employees.filter(emp => {
       if (emp.status !== 'ativo') return false;
       if (selectedPlanCargo !== '__all__' && emp.cargo_catalogo_id !== selectedPlanCargo) return false;
       if (selectedPlanBU !== '__all__') {
         const buMapping = {
           'incorporador': 'BU - Incorporador 50K',
           'consorcio': 'BU - Consórcio',
           'credito': 'BU - Crédito',
           // etc
         };
         if (emp.departamento !== buMapping[selectedPlanBU]) return false;
       }
       return true;
     });
   }, [employees, selectedPlanCargo, selectedPlanBU]);
   ```

5. **Exibir painel de métricas ativas acima da tabela:**
   ```tsx
   {metricasAtivas && metricasAtivas.length > 0 && (
     <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
       <div className="text-sm font-medium mb-2">
         Métricas Ativas para {format(selectedPlanDate, 'MMMM yyyy', { locale: ptBR })}:
       </div>
       <div className="flex flex-wrap gap-2">
         {metricasAtivas.filter(m => m.ativo).map(m => (
           <Badge key={m.id} variant="secondary">
             {m.label_exibicao} ({m.peso_percentual}%)
           </Badge>
         ))}
       </div>
     </div>
   )}
   ```

6. **Tabela de colaboradores com valores do catálogo de cargos:**
   
   Para cada colaborador, puxar os valores de OTE do cargo vinculado (`cargo_catalogo_id`):
   - `fixo_valor` do cargo
   - `variavel_valor` do cargo
   - `ote_total` do cargo

---

### 2. Hook para buscar colaboradores com cargo detalhado

**Novo hook ou adaptar `useEmployees`:**

```tsx
export function useEmployeesWithCargo() {
  return useQuery({
    queryKey: ['employees-with-cargo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          cargo_catalogo:cargo_catalogo_id (
            id,
            nome_exibicao,
            cargo_base,
            area,
            nivel,
            fixo_valor,
            variavel_valor,
            ote_total
          )
        `)
        .eq('status', 'ativo')
        .order('nome_completo');
      
      if (error) throw error;
      return data;
    },
  });
}
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Adicionar filtros na aba Planos OTE, integrar com employees e métricas ativas |
| `src/hooks/useEmployees.ts` | Adicionar `useEmployeesWithCargo()` com join em cargos_catalogo |

---

## Fluxo de Uso

```text
1. Admin acessa "Planos OTE"
          ↓
2. Seleciona Mês: Janeiro 2026
          ↓
3. Seleciona Cargo: SDR Inside (ou Todos)
          ↓
4. Seleciona BU: Incorporador (ou Todas)
          ↓
5. Sistema mostra:
   - Painel com métricas ativas para aquele mês/cargo
   - Lista de colaboradores que pertencem ao cargo/BU
   - Valores de OTE, Fixo, Variável baseados no cargo do catálogo
          ↓
6. Admin pode ver exatamente quais métricas serão usadas
   para calcular o variável de cada pessoa naquele mês
```

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| Dados exibidos | Planos OTE antigos (tabela `sdr_comp_plan`) | Colaboradores filtrados por cargo/BU com OTE do catálogo |
| Métricas | Não aparecem na aba Planos | Badge mostrando métricas ativas do mês |
| Filtros | Nenhum | Mês, Cargo, BU |
| Vigência | Data fixa do plano | Mês selecionado dinamicamente |
| Fonte de valores OTE | Campo manual no plano | Catálogo de cargos (`cargos_catalogo`) |

---

## Dados que serão mostrados

Para cada colaborador:
- **Nome:** `employees.nome_completo`
- **Cargo:** `cargos_catalogo.nome_exibicao`
- **OTE Total:** `cargos_catalogo.ote_total`
- **Fixo:** `cargos_catalogo.fixo_valor`
- **Variável:** `cargos_catalogo.variavel_valor`
- **Métricas do Mês:** Da tabela `fechamento_metricas_mes` filtrada

