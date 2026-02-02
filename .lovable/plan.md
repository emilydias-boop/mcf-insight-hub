

# Plano: Integração Completa do Sistema de Fechamento

## Resumo do Problema

O sistema de fechamento não está "acompanhando" os dados porque existem várias desconexões entre as fontes de dados:

1. **OTE mostra R$ 4.000 (errado) em vez de R$ 8.000 (correto)**:
   - O plano de Thayna (`sdr_comp_plan`) tem `vigencia_inicio: 2026-02-01`
   - O fechamento é de **janeiro 2026**, então não encontra plano vigente
   - Cai no fallback hardcoded: `compPlan?.ote_total || 4000`
   - **Solução**: Quando não há `sdr_comp_plan`, usar dados do RH (`cargo_catalogo`)

2. **KPIs de Closer incorretos**:
   - Formulário de edição (`KpiEditForm`) mostra campos de SDR (tentativas, etc.) mesmo para Closers
   - Closers precisam de: Contratos (com meta diária) e Organização (manual)
   - Precisamos mostrar "Vendas Parceria" em vez de "Intermediações de Contrato"

3. **Meta de contratos não tem base diária**:
   - Não existe campo `meta_contratos_diaria` no `sdr` ou `sdr_comp_plan`
   - Precisamos definir como calcular a meta de contratos para Closers

---

## Solução Técnica

### A) Corrigir fonte de OTE/Fixo/Variável no Detail

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

Quando `compPlan` é null, buscar dados do `cargo_catalogo` via employee:

```typescript
// Hierarquia de valores:
// 1. compPlan vigente (sdr_comp_plan)
// 2. cargo_catalogo do RH (via employee)
// 3. fallback hardcoded

const effectiveOTE = compPlan?.ote_total 
  || employee?.cargo_catalogo?.ote_total 
  || 4000;

const effectiveFixo = compPlan?.fixo_valor 
  || employee?.cargo_catalogo?.fixo_valor 
  || 2800;

const effectiveVariavel = compPlan?.variavel_total 
  || employee?.cargo_catalogo?.variavel_valor 
  || 1200;
```

**Modificação necessária:**
- `useSdrPayoutDetail` precisa retornar também os dados do employee/cargo_catalogo
- Ou fazer um join adicional no Detail.tsx

### B) Modificar KpiEditForm para Closers

**Arquivo:** `src/components/sdr-fechamento/KpiEditForm.tsx`

Criar campos específicos para Closers:

**PARA SDRs** (atual):
- Reuniões Agendadas (auto/agenda)
- Reuniões Realizadas (auto/agenda)
- No-Shows (auto/agenda)
- Tentativas de Ligações (auto/twilio)
- Score de Organização (manual)
- Intermediações de Contrato (auto/hubla)

**PARA CLOSERS** (novo):
- Reuniões Alocadas (auto/agenda - R1 que receberam)
- Reuniões Realizadas (auto/agenda)
- No-Shows (auto/agenda)
- Contratos Pagos (auto/hubla) - **com meta: X/dia × dias úteis**
- Score de Organização (manual) - **coordenador preenche**
- Vendas Parceria (auto/hubla) - **substituir intermediações**

```typescript
// Adicionar campos específicos para Closer
{isCloser && (
  <>
    {/* Campo: Contratos Pagos - Meta diária */}
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-xs">
        Contratos Pagos
        <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
          <FileCheck className="h-2.5 w-2.5 mr-0.5" />
          Auto (Hubla)
        </Badge>
      </Label>
      <span className="text-[10px] text-muted-foreground/70 block">
        Meta: {metaContratos} ({metaContratosDiaria}/dia × {diasUteisMes} dias)
      </span>
      <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
        <span className="font-medium">{intermediacoes}</span>
      </div>
    </div>

    {/* Campo: Vendas Parceria - Novo */}
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-xs">
        Vendas Parceria
        <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
          Auto (Hubla)
        </Badge>
      </Label>
      <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
        <span className="font-medium">{vendasParceria}</span>
      </div>
    </div>

    {/* Campo: Organização Manual */}
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-xs">
        Organização (%)
        <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
          Manual
        </Badge>
      </Label>
      {/* ... campo de input */}
    </div>
  </>
)}
```

### C) Adicionar campo meta_contratos_diaria

**Opções:**

1. **Usar meta existente do sdr_comp_plan**: 
   - `meta_reunioes_realizadas` poderia ser a meta de contratos
   - Problema: nome confuso

2. **Adicionar campo no sdr_comp_plan**:
   - Novo campo: `meta_contratos_diaria`
   - Problema: precisa de migration

3. **Usar fechamento_metricas_mes.meta_valor**:
   - Já existe o campo `meta_valor` na configuração de métricas
   - **MELHOR OPÇÃO**: Usar a configuração existente

**Solução:** Ao configurar métricas ativas para Closer, definir `meta_valor` para "contratos".

### D) Modificar busca de employee no Detail

**Arquivo:** `src/hooks/useSdrFechamento.ts`

Modificar `useSdrPayoutDetail` para incluir employee e cargo_catalogo:

```typescript
export const useSdrPayoutDetail = (payoutId: string | undefined) => {
  return useQuery({
    queryKey: ['sdr-payout-detail', payoutId],
    queryFn: async () => {
      if (!payoutId) return null;
      
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, 
                     observacao, status, criado_por, aprovado_por, aprovado_em, 
                     created_at, updated_at, squad, role_type)
        `)
        .eq('id', payoutId)
        .single();
      
      if (error) throw error;
      
      // Fetch employee data for cargo_catalogo
      const { data: employeeData } = await supabase
        .from('employees')
        .select(`
          cargo_catalogo_id,
          departamento,
          cargo_catalogo:cargo_catalogo_id (
            id, nome_exibicao, nivel, ote_total, fixo_valor, variavel_valor
          )
        `)
        .eq('sdr_id', data.sdr_id)
        .eq('status', 'ativo')
        .maybeSingle();
      
      const payout = transformPayout(data);
      (payout as any).employee = employeeData;
      
      return payout;
    },
    enabled: !!payoutId,
  });
};
```

### E) Atualizar exibição de OTE no Detail.tsx

```typescript
// Get employee from payout (attached by hook)
const employee = (payout as any)?.employee;

// Effective values with priority cascade
const effectiveOTE = compPlan?.ote_total || employee?.cargo_catalogo?.ote_total || 4000;
const effectiveFixo = compPlan?.fixo_valor || employee?.cargo_catalogo?.fixo_valor || 2800;
const effectiveVariavel = compPlan?.variavel_total || employee?.cargo_catalogo?.variavel_valor || 1200;

// In Summary Cards:
<Card>
  <CardContent>
    <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
      <Target className="h-3.5 w-3.5" />
      OTE Total
      {!compPlan && employee?.cargo_catalogo && (
        <Badge variant="outline" className="text-[9px] h-4">RH</Badge>
      )}
    </div>
    <div className="text-xl font-bold mt-1">
      {formatCurrency(effectiveOTE)}
    </div>
  </CardContent>
</Card>
```

### F) Renomear "Intermediações de Contrato" para "Vendas Parceria"

**Arquivo:** `src/components/sdr-fechamento/IntermediacoesList.tsx`

Para Closers, mudar o título e lógica:

```typescript
// Prop para determinar tipo
interface IntermediacoesListProps {
  sdrId: string;
  anoMes: string;
  disabled?: boolean;
  isCloser?: boolean;
}

// No componente:
<CardTitle className="text-sm font-semibold">
  {isCloser ? 'Vendas Parceria' : 'Intermediações de Contrato'}
</CardTitle>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrFechamento.ts` | Modificar `useSdrPayoutDetail` para buscar employee/cargo_catalogo |
| `src/pages/fechamento-sdr/Detail.tsx` | Usar cascata OTE: compPlan → cargo_catalogo → fallback |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Reformular campos para Closers (Contratos, Organização, Vendas Parceria) |
| `src/components/sdr-fechamento/IntermediacoesList.tsx` | Renomear para Closers: "Vendas Parceria" |
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionar métrica "vendas_parceria" nos defaults de Closer |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANTES (desconectado)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detail busca compPlan → Não encontra para janeiro → Fallback R$ 4.000      │
│  KpiEditForm mostra campos SDR mesmo para Closer                            │
│  Meta de contratos não tem base diária                                      │
│  "Intermediações" confunde com vendas parceria                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPOIS (integrado)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Detail busca compPlan                                                   │
│     ↳ Se não encontra: busca cargo_catalogo do RH                           │
│     ↳ Thayna N2: OTE R$ 8.000, Fixo R$ 5.600, Variável R$ 2.400             │
│                                                                             │
│  2. KpiEditForm detecta isCloser                                            │
│     ↳ Mostra: Contratos (meta diária), Organização (manual)                 │
│     ↳ Oculta: Tentativas, Agendadas                                         │
│                                                                             │
│  3. Meta de contratos usa fechamento_metricas_mes.meta_valor                │
│     ↳ Configuração: Contratos peso 50%, meta_valor = 20 (ex)                │
│                                                                             │
│  4. "Vendas Parceria" para Closers                                          │
│     ↳ IntermediacoesList adapta título baseado em isCloser                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Para **Thayna (Closer N2)** no fechamento de **janeiro 2026**:

| Campo | Antes | Depois |
|-------|-------|--------|
| OTE Total | R$ 4.000 | R$ 8.000 (do cargo_catalogo N2) |
| Fixo | R$ 2.800 | R$ 5.600 (do cargo_catalogo N2) |
| Variável | R$ 150 | Recalculado com base correta |
| KPIs visíveis | Todos (SDR) | Contratos + Organização |
| Intermediações | Exibido | Renomeado "Vendas Parceria" |
| Meta contratos | Sem base | X/dia × dias úteis |

