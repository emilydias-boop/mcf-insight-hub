
# Plano: Unificar Fechamento SDR com RH

## Resumo do Problema

O sistema de Fechamento SDR está desacoplado do módulo de RH:
- A tabela `sdr` possui sua própria coluna `squad` que não está sincronizada com `employees.departamento`
- Colaboradores aparecem em BUs erradas ou não aparecem
- Alguns closers/SDRs existem apenas na tabela `sdr` sem vínculo com o RH

### Inconsistências Encontradas:

| Colaborador | Squad (sdr) | Departamento (RH) | Status |
|-------------|-------------|-------------------|--------|
| Vitor Costta | projetos | BU - Incorporador 50K | Inconsistente |
| Cleiton Lima | consorcio | BU - Consórcio | OK |
| Claudia Carielo | incorporador | SEM VÍNCULO RH | Órfão |
| Jessica Bellini | incorporador | SEM VÍNCULO RH | Órfão |
| Julio | incorporador | SEM VÍNCULO RH | Órfão |

---

## Solução Proposta

### Parte 1: Modificar o Fechamento SDR para usar dados do RH

Em vez de filtrar pela coluna `sdr.squad`, o sistema passará a:
1. Buscar o employee vinculado via `employees.sdr_id`
2. Usar `employees.departamento` para determinar a BU

### Parte 2: Sincronizar dados

Quando houver inconsistência entre `sdr.squad` e `employees.departamento`:
- O sistema deve priorizar o RH como fonte de verdade
- Mostrar alertas quando houver SDRs órfãos (sem vínculo RH)

---

## Alterações Técnicas

### 1. Arquivo: `src/hooks/useSdrFechamento.ts`

Modificar a query `useSdrPayouts` para incluir o employee vinculado e usar seu departamento:

```typescript
// ANTES: Filtra por sdr.squad
result = result.filter(p => (p.sdr as any)?.squad === filters.squad);

// DEPOIS: Filtra pelo departamento do employee vinculado
const squadToDept: Record<string, string> = {
  'incorporador': 'BU - Incorporador 50K',
  'consorcio': 'BU - Consórcio',
  'credito': 'BU - Crédito',
  'projetos': 'BU - Projetos',
};
const expectedDept = squadToDept[filters.squad];
result = result.filter(p => p.employee?.departamento === expectedDept);
```

Adicionar join com employees na query:

```typescript
const { data, error } = await supabase
  .from('sdr_month_payout')
  .select(`
    *,
    sdr:sdr_id(...),
    employee:sdr_id!inner(
      employees!inner(id, departamento, nome_completo, cargo, status)
    )
  `)
```

### 2. Arquivo: `src/pages/fechamento-sdr/Index.tsx`

Atualizar para exibir o departamento do RH e não do `sdr.squad`:

```typescript
// Coluna BU
<TableCell className="text-center">
  <Badge variant="outline" className="text-xs">
    {payout.employee?.departamento?.replace('BU - ', '') || 
     getSquadLabel(sdrData?.squad)}
  </Badge>
</TableCell>
```

### 3. Arquivo: `src/pages/fechamento-sdr/Configuracoes.tsx`

A aba "Equipe" já está correta (usa employees). 
Precisamos garantir que as outras abas também sigam essa lógica.

---

## Considerações

### Abordagem Híbrida (Recomendada)

Durante a transição, manter compatibilidade:
1. Se o SDR tem employee vinculado → usar `employees.departamento`
2. Se o SDR não tem employee vinculado → usar `sdr.squad` como fallback + mostrar alerta

### Dados a Corrigir no Banco

Para resolver as inconsistências atuais:

```sql
-- 1. Corrigir Vitor Costta (squad errado)
UPDATE sdr 
SET squad = 'incorporador' 
WHERE id = '11111111-0001-0001-0001-000000000012';

-- 2. Vincular SDRs órfãos aos employees correspondentes
UPDATE employees 
SET sdr_id = '566e3075-5903-4b9b-941b-ef95b9fa09d8' 
WHERE nome_completo LIKE '%Jéssica Bellini%';
-- (repetir para outros)
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrFechamento.ts` | Modificar query para incluir employee e filtrar por departamento |
| `src/pages/fechamento-sdr/Index.tsx` | Exibir BU do employee, fallback para sdr.squad |
| `src/components/premiacoes/RankingLeaderboard.tsx` | Já corrigido, usar sdr_id + departamento |

---

## Resultado Esperado

Após as alterações:
- O filtro "Incorporador" mostrará apenas colaboradores com `departamento = 'BU - Incorporador 50K'`
- O filtro "Consórcio" mostrará apenas colaboradores com `departamento = 'BU - Consórcio'`
- SDRs sem vínculo RH aparecerão com um alerta visual
- Vitor Costta aparecerá corretamente na BU Incorporador

---

## Migração de Dados (Opcional)

Script SQL para sincronizar `sdr.squad` com `employees.departamento`:

```sql
UPDATE sdr s
SET squad = 
  CASE e.departamento
    WHEN 'BU - Incorporador 50K' THEN 'incorporador'
    WHEN 'BU - Consórcio' THEN 'consorcio'
    WHEN 'BU - Crédito' THEN 'credito'
    WHEN 'BU - Projetos' THEN 'projetos'
  END
FROM employees e
WHERE e.sdr_id = s.id
AND e.departamento IS NOT NULL
AND s.squad != (
  CASE e.departamento
    WHEN 'BU - Incorporador 50K' THEN 'incorporador'
    WHEN 'BU - Consórcio' THEN 'consorcio'
    WHEN 'BU - Crédito' THEN 'credito'
    WHEN 'BU - Projetos' THEN 'projetos'
  END
);
```
