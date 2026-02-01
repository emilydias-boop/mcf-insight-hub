
# Correção: Ranking não encontra participantes elegíveis

## Problema Identificado

Ao criar uma premiação com:
- **BU**: incorporador
- **Cargo**: SDR

O ranking mostra "Nenhum participante elegível encontrado" porque a query atual está incorreta.

---

## Diagnóstico Técnico

A query atual em `RankingLeaderboard.tsx`:

```typescript
const { data, error } = await supabase
  .from('employees')
  .select('id, nome_completo, cargo, squad')
  .eq('squad', premiacao.bu)        // ❌ Compara 'incorporador' com 'Comercial'
  .in('cargo', premiacao.cargos_elegiveis);  // ❌ Compara 'sdr' com 'SDR'
```

### Problema 1: Mapeamento Squad → BU incorreto

| Esperado | Valor no banco |
|----------|----------------|
| `squad = 'incorporador'` | `squad = 'Comercial'`, `'Inside Sales Produto'`, etc. |

A estrutura correta é:
- **departamentos.codigo** = `'incorporador'` (valor da BU)
- **squads.departamento_id** → departamentos.id
- **employees.squad** = nome do squad (ex: `'Comercial'`)

### Problema 2: Case sensitivity no cargo

| Premiação | Banco de dados |
|-----------|----------------|
| `'sdr'` (minúsculo) | `'SDR'` (maiúsculo) |

---

## Solução Proposta

Modificar a query para:

1. Fazer JOIN com `squads` e `departamentos` para filtrar pela BU
2. Usar comparação case-insensitive para cargos

### Nova Query

```typescript
const { data, error } = await supabase
  .from('employees')
  .select(`
    id, 
    nome_completo, 
    cargo, 
    squad
  `)
  .eq('status', 'ativo')
  .filter('squad', 'in', `(
    SELECT s.nome FROM squads s 
    JOIN departamentos d ON s.departamento_id = d.id 
    WHERE d.codigo = '${premiacao.bu}'
  )`)
  .ilike('cargo', premiacao.cargos_elegiveis[0]); // Para múltiplos, usar OR
```

**Alternativa mais simples** (recomendada):
Buscar os nomes dos squads primeiro, depois filtrar employees:

```typescript
// 1. Buscar squads da BU
const { data: buSquads } = await supabase
  .from('squads')
  .select('nome, departamentos!inner(codigo)')
  .eq('departamentos.codigo', premiacao.bu);

const squadNames = buSquads?.map(s => s.nome) || [];

// 2. Buscar employees nesses squads com cargo case-insensitive
const cargosLower = premiacao.cargos_elegiveis.map(c => c.toLowerCase());
const { data, error } = await supabase
  .from('employees')
  .select('id, nome_completo, cargo, squad')
  .eq('status', 'ativo')
  .in('squad', squadNames);

// Filtrar cargos no JavaScript (case-insensitive)
const filtered = data?.filter(e => 
  cargosLower.includes(e.cargo?.toLowerCase())
);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/premiacoes/RankingLeaderboard.tsx` | Corrigir query para buscar employees por BU via join com squads/departamentos e usar comparação case-insensitive para cargos |

---

## Resultado Esperado

Após a correção, a premiação "Carro!!" com:
- **BU**: Incorporador MCF
- **Cargo**: SDR

Irá encontrar pelo menos 2 participantes elegíveis:
- Emily Segundario (squad: Inside Sales Produto)
- Antony Elias Monteiro da silva (squad: Comercial)

---

## Validação

Testar criando uma nova premiação e verificando se:
1. Os SDRs aparecem no ranking
2. Os dados de métrica são exibidos (atualmente simulados)
3. O Top 3 visual funciona corretamente
