
# Correção: Ranking não encontra SDRs da BU Incorporador

## Problema Identificado

O ranking mostra apenas **Emily Segundario** porque a query atual filtra por `squad`, mas a maioria dos SDRs tem `squad = NULL`:

| SDR | Departamento | Squad |
|-----|-------------|-------|
| Alexsandro Dias | BU - Incorporador 50K | NULL |
| Antony Elias | BU - Incorporador 50K | NULL |
| Carol Correa | BU - Incorporador 50K | NULL |
| Carol Souza | BU - Incorporador 50K | NULL |
| Jessica Martins | BU - Incorporador 50K | NULL |
| Julia Caroline | BU - Incorporador 50K | NULL |
| Juliana Rodrigues | BU - Incorporador 50K | NULL |
| Leticia Nunes | BU - Incorporador 50K | NULL |
| Vinicius Rangel | BU - Incorporador 50K | NULL |
| Vitor Costta | BU - Incorporador 50K | NULL |
| Yanca Oliveira | BU - Incorporador 50K | NULL |
| **Emily Segundario** | TI | Inside Sales Produto |

A query atual busca employees onde `squad IN ('Comercial', 'Inside Sales Produto', 'Closer')`, mas ignora o campo `departamento`.

---

## Solução Proposta

Modificar a lógica para buscar colaboradores de duas formas:
1. **Por squad**: employees cujo `squad` pertence à BU
2. **Por departamento (fallback)**: employees cujo `departamento` = nome do departamento da BU

---

## Alterações Técnicas

### Arquivo: `src/components/premiacoes/RankingLeaderboard.tsx`

### Passo 1: Buscar também o nome do departamento da BU

```typescript
// Buscar squads e nome do departamento da BU
const { data: buData } = useQuery({
  queryKey: ['bu-data', premiacao.bu],
  queryFn: async () => {
    // 1. Buscar nome do departamento pelo código
    const { data: depto, error: deptoError } = await supabase
      .from('departamentos')
      .select('nome, codigo')
      .eq('codigo', premiacao.bu)
      .single();
    
    if (deptoError) throw deptoError;
    
    // 2. Buscar squads do departamento
    const { data: squads, error: squadsError } = await supabase
      .from('squads')
      .select('nome')
      .eq('departamento_id', depto.id);
    
    return {
      departamentoNome: depto.nome,
      squadNames: squads?.map(s => s.nome) || []
    };
  },
});
```

### Passo 2: Modificar query de employees para usar OR com departamento

```typescript
const { data: employees } = useQuery({
  queryFn: async () => {
    // Buscar employees que:
    // 1. Têm squad em squadNames OU
    // 2. Têm departamento = departamentoNome (fallback para squad null)
    const { data, error } = await supabase
      .from('employees')
      .select('id, nome_completo, cargo, squad, departamento')
      .eq('status', 'ativo')
      .or(`squad.in.(${squadNames.join(',')}),departamento.eq.${departamentoNome}`);
    
    // Filtrar cargos case-insensitive
    const cargosLower = premiacao.cargos_elegiveis.map(c => c.toLowerCase());
    return data?.filter(e => 
      cargosLower.includes(e.cargo?.toLowerCase())
    ) || [];
  },
});
```

---

## Resultado Esperado

Após a correção, o ranking exibirá **12+ SDRs** da BU Incorporador:
- Alexsandro Dias dos Santos
- Antony Elias Monteiro da silva
- Carol Correa
- Carol Souza
- Emily Segundario
- Jessica Martins
- Julia Caroline
- Juliana Rodrigues
- Leticia Nunes
- Vinicius Rangel
- Vitor Costta
- Yanca Oliveira

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/premiacoes/RankingLeaderboard.tsx` | Buscar departamento.nome além dos squads e usar OR na query de employees para incluir colaboradores sem squad mas com departamento correto |
