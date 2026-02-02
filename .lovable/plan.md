

# Plano Completo: Unificar Fechamento SDR com RH + Histórico de Departamento

## Visão Geral

Este plano resolve dois problemas relacionados de uma vez:

1. **Colaboradores na BU errada**: Filtrar corretamente por departamento do RH e excluir sócios R2
2. **Histórico de transferências**: Manter registro do departamento vigente em cada mês para colaboradores que mudam de área

---

## Alterações no Banco de Dados

### Migration: Nova Coluna

```sql
-- Adicionar coluna para congelar departamento no momento do fechamento
ALTER TABLE sdr_month_payout 
ADD COLUMN departamento_vigente TEXT;

COMMENT ON COLUMN sdr_month_payout.departamento_vigente IS 
  'Departamento do colaborador no momento do fechamento (fonte: employees.departamento)';
```

### Scripts de Correção de Dados

```sql
-- 1. Vincular Thaynar Tavares ao SDR correspondente
UPDATE employees 
SET sdr_id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2'
WHERE id = 'fbd5ed07-c45c-41af-9e55-37c2d7faf613';

-- 2. Vincular Julio Caetano ao SDR correspondente
UPDATE employees 
SET sdr_id = '21393c7b-faa7-42e2-b1d8-920e3a808b33'
WHERE id = '74d4da35-2f43-43f0-a0b0-29bd6d51c04a';

-- 3. Vincular Jéssica Bellini ao SDR correspondente
UPDATE employees 
SET sdr_id = '566e3075-5903-4b9b-941b-ef95b9fa09d8'
WHERE id = '93d0e6ac-2e66-4372-8974-2af228f07628';

-- 4. Desativar SDR de Claudia Carielo (sócia R2)
UPDATE sdr 
SET active = false 
WHERE id = '4eb4991d-e753-49e5-955b-c3ebceafe6e4';

-- 5. Desativar SDR de Thobson Motta (sócio R2)
UPDATE sdr 
SET active = false 
WHERE id = '761a3f5b-d854-46e3-8b0d-05c1b7680216';

-- 6. Preencher departamento_vigente para payouts existentes (baseado no RH atual)
UPDATE sdr_month_payout p
SET departamento_vigente = e.departamento
FROM employees e
WHERE e.sdr_id = p.sdr_id
AND p.departamento_vigente IS NULL;

-- 7. Corrigir manualmente o Vinicius em Janeiro (transferido em Fevereiro)
UPDATE sdr_month_payout 
SET departamento_vigente = 'BU - Incorporador 50K'
WHERE sdr_id = '11111111-0001-0001-0001-000000000010'
AND ano_mes = '2026-01';
```

---

## Alterações no Código

### 1. Arquivo: `src/types/sdr-fechamento.ts`

Adicionar campo ao tipo SdrMonthPayout:

```typescript
export interface SdrMonthPayout {
  // ... campos existentes ...
  departamento_vigente: string | null;  // NOVO
}
```

### 2. Arquivo: `src/hooks/useSdrFechamento.ts`

**Mudança A: Excluir sócios R2 do fechamento**

```typescript
// Após enriquecer payouts com employee data
result = result.filter(p => {
  const employee = (p as any).employee;
  // Excluir sócios R2 do fechamento
  if (employee?.cargo === 'Closer R2') {
    return false;
  }
  return true;
});
```

**Mudança B: Filtrar usando departamento_vigente com fallbacks**

```typescript
if (filters.squad && filters.squad !== 'all') {
  const expectedDept = SQUAD_TO_DEPT[filters.squad];
  result = result.filter(p => {
    // 1. Priorizar departamento congelado no payout
    const frozenDept = (p as any).departamento_vigente;
    if (frozenDept) {
      return frozenDept === expectedDept;
    }
    // 2. Fallback para employees.departamento (payouts sem vigente)
    const employee = (p as any).employee;
    if (employee?.departamento) {
      return employee.departamento === expectedDept;
    }
    // 3. Fallback final: sdr.squad (SDRs órfãos)
    return (p.sdr as any)?.squad === filters.squad;
  });
}
```

**Mudança C: Gravar departamento_vigente ao recalcular payout**

Na função `useRecalculatePayout`:

```typescript
// Buscar employee vinculado ao SDR para obter departamento
const { data: employee } = await supabase
  .from('employees')
  .select('departamento')
  .eq('sdr_id', sdrId)
  .maybeSingle();

// Incluir no upsert do payout
const { error } = await supabase
  .from('sdr_month_payout')
  .upsert({
    sdr_id: sdrId,
    ano_mes: anoMes,
    departamento_vigente: employee?.departamento || null,
    // ... outros campos calculados
  }, {
    onConflict: 'sdr_id,ano_mes',
  });
```

### 3. Arquivo: `src/hooks/useEmployees.ts`

**Registrar evento de transferência automaticamente ao mudar departamento**

```typescript
const updateEmployee = useMutation({
  mutationFn: async ({ id, data, previousData }: { 
    id: string; 
    data: Partial<Employee>;
    previousData?: { departamento?: string };
  }) => {
    const { data: result, error } = await supabase
      .from('employees')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    // Se departamento mudou, registrar evento de transferência
    if (previousData?.departamento && 
        data.departamento && 
        previousData.departamento !== data.departamento) {
      await supabase.from('employee_events').insert({
        employee_id: id,
        tipo_evento: 'transferencia',
        titulo: 'Transferência de Departamento',
        descricao: `Transferido de ${previousData.departamento} para ${data.departamento}`,
        data_evento: new Date().toISOString().split('T')[0],
      });
    }

    return result;
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employee', variables.id] });
    toast.success('Colaborador atualizado com sucesso');
  },
  onError: (error) => {
    toast.error('Erro ao atualizar colaborador: ' + error.message);
  },
});
```

### 4. Arquivo: `src/pages/fechamento-sdr/Index.tsx`

**Exibir departamento vigente na tabela**

```typescript
const getBuFromPayout = (payout: any) => {
  // 1. Priorizar departamento congelado
  if (payout.departamento_vigente) {
    return {
      label: payout.departamento_vigente.replace('BU - ', '').replace(' 50K', ''),
      isFromHR: true,
      hasWarning: false,
    };
  }
  // 2. Fallback para employee.departamento
  if (payout.employee?.departamento) {
    return {
      label: payout.employee.departamento.replace('BU - ', '').replace(' 50K', ''),
      isFromHR: true,
      hasWarning: false,
    };
  }
  // 3. Fallback para sdr.squad (sem vínculo RH)
  const squad = payout.sdr?.squad;
  return {
    label: getSquadLabel(squad),
    isFromHR: false,
    hasWarning: true,
  };
};
```

---

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FILTRO POR BU - CASCATA                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Passo 1: departamento_vigente existe?                          │
│     SIM → Usar (departamento congelado no fechamento)           │
│     NÃO → Continuar                                             │
│                                                                 │
│  Passo 2: employee.departamento existe?                         │
│     SIM → Usar (departamento atual do RH)                       │
│     NÃO → Continuar                                             │
│                                                                 │
│  Passo 3: sdr.squad (fallback para SDRs sem vínculo RH)         │
│     → Mostra com ícone de alerta ⚠️                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

### BU Incorporador (Janeiro 2026)

| Nome | Cargo | BU (vigente) |
|------|-------|--------------|
| Jessica Martins | SDR | Incorporador |
| Carol Correa | SDR | Incorporador |
| Leticia Nunes | SDR | Incorporador |
| Antony Elias | SDR | Incorporador |
| Vinicius Rangel | SDR | Incorporador |
| Jéssica Bellini | Closer | Incorporador |
| Julio Caetano | Closer | Incorporador |
| Thaynar Tavares | Closer | Incorporador |

### BU Crédito (Fevereiro 2026 em diante)

| Nome | Cargo | BU (vigente) |
|------|-------|--------------|
| Vinicius Rangel | SDR | Crédito |

### Não aparecerão mais

- Claudia Carielo (sócia R2 - desativada)
- Thobson Motta (sócio R2 - desativado)
- Cleiton Lima (aparece apenas em Consórcio)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/sdr-fechamento.ts` | Adicionar `departamento_vigente` ao tipo |
| `src/hooks/useSdrFechamento.ts` | Excluir R2, filtrar por vigente, gravar ao recalcular |
| `src/hooks/useEmployees.ts` | Registrar evento de transferência |
| `src/pages/fechamento-sdr/Index.tsx` | Exibir BU do departamento_vigente |

## Alterações no Banco

| Tipo | Descrição |
|------|-----------|
| ALTER TABLE | Adicionar coluna `departamento_vigente` |
| UPDATE | Vincular 3 employees aos SDRs |
| UPDATE | Desativar 2 SDRs de sócios R2 |
| UPDATE | Preencher departamento_vigente existentes |
| UPDATE | Corrigir Vinicius Janeiro como Incorporador |

