
## Bug confirmado: filtro custom sem "Fim" busca tudo a partir do "Início"

### O que está acontecendo

Validei direto no banco para o usuário **cleiton.lima** (que está logado):

| Cenário UI | Mostra na UI | Banco real | Por quê |
|---|---|---|---|
| Filtro custom Início=14/04, Fim=vazio | **345** | 345 ligações de 14/04 em diante (sem limite) | Bug: sem `endDate`, hook busca TUDO a partir do início |
| Filtro custom Início=08/04, Fim=vazio | **564** | 564 ligações de 08/04 em diante (sem limite) | Mesmo bug |
| Filtro "Mês" abril | **631** | 631 ligações 01/04→30/04 | Correto ✅ |

Os 564 (a partir de 08/04) **não são menores que 631 (mês inteiro)** — são uma subset coerente. O problema é que o usuário esperava que "Início=08/04" significasse "**no dia 08/04**" (deveria dar 107), mas o sistema interpreta como "**a partir de 08/04 sem limite final**" (dá 564).

### Causa raiz

**Arquivo:** `src/pages/sdr/MinhasReunioes.tsx` linhas 64-68:

```ts
case 'custom':
  return { 
    startDate: customStartDate ? startOfDay(customStartDate) : null, 
    endDate: customEndDate ? endOfDay(customEndDate) : null   // ← null se não preencher Fim
  };
```

Combinado com `useSdrCallMetrics` (linhas 72-77) que aplica os filtros condicionalmente:
```ts
if (startDate) query = query.gte('created_at', ...);
if (endDate)   query = query.lte('created_at', ...);  // ← se endDate for null, NÃO limita
```

→ Resultado: filtra só por data de início, sem teto.

### Bug secundário (também precisa corrigir)

No mesmo `useSdrCallMetrics`, a paginação na linha 64-93 **não tem `.order()` explícito**. Sem ordem estável, o Postgres pode retornar linhas em ordem inconsistente entre páginas (`OFFSET 0-999`, `OFFSET 1000-1999`...), causando linhas duplicadas ou perdidas em SDRs com mais de 1000 ligações no período. Hoje só afeta uns poucos SDRs no mês inteiro, mas é um bug latente.

### Plano de correção

**1. Arquivo:** `src/pages/sdr/MinhasReunioes.tsx` (linhas 64-68)

Quando custom estiver ativo e o usuário preencheu só "Início" (ou só "Fim"), tratar como **filtro de um único dia** (mesmo dia para início e fim):

```ts
case 'custom': {
  // Se só preencheu uma data, usar ela como range único (dia específico)
  const start = customStartDate || customEndDate;
  const end = customEndDate || customStartDate;
  return {
    startDate: start ? startOfDay(start) : null,
    endDate: end ? endOfDay(end) : null,
  };
}
```

→ Início=14/04, Fim=vazio passa a significar "dia 14/04 inteiro" (resultado esperado: ~30-50 ligações daquele dia, não 345).

**2. Arquivo:** `src/hooks/useSdrCallMetrics.ts` (linha 67-70 e 199-204)

Adicionar `.order('created_at', { ascending: true })` antes do `.range()` em ambas as queries paginadas, garantindo ordem estável entre páginas:

```ts
let query = supabase
  .from('calls')
  .select('id, status, outcome, duration_seconds, started_at, ended_at, created_at')
  .eq('user_id', profile.id)
  .eq('direction', 'outbound')
  .order('created_at', { ascending: true })  // ← novo
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

**3. UI feedback (opcional — recomendo incluir):**

No filtro custom, quando o usuário seleciona só "Início", mostrar uma dica visual indicando "filtrando apenas o dia DD/MM/YYYY" para deixar claro o comportamento.

### Resultado esperado após correção

| Cenário UI | Vai mostrar | Cálculo |
|---|---|---|
| Início=14/04, Fim=vazio | ligações **só do dia 14/04** | startOfDay(14/04) → endOfDay(14/04) |
| Início=08/04, Fim=14/04 | ligações de **08 a 14/04** | range correto |
| Mês abril | 631 | continua igual |

### Não muda
- Sem alteração de banco
- Sem impacto em outros componentes que usam `useSdrCallMetrics` (hook continua com mesma assinatura)
- Cards de Reuniões/R2 continuam funcionando — eles vêm de outros hooks
- "Hoje", "Semana", "Mês" continuam idênticos
