
# Sincronizar Painel Comercial com o RH

## Diagnóstico

O painel comercial (`/crm/reunioes-equipe`) está desatualizado por dois motivos:

| Problema | Causa | Impacto |
|----------|-------|---------|
| Lista de SDRs hardcoded | Usa constante `SDR_LIST` em `src/constants/team.ts` | Vinicius (saiu do Inside) aparece, Evellyn e Roger (entraram) não aparecem |
| Closers sem filtro por BU | Hook `useR1CloserMetrics` busca todos os closers ativos | João Pedro, Victoria, Luis Felipe, Thobson (Consórcio) aparecem no painel do Incorporador |

### Dados atuais no Banco

**SDRs ativos no Incorporador** (tabela `sdr`):
- Antony Elias, Carol Correa, Carol Souza, Cristiane Gomes, Jessica Bellini, Jessica Martins, Julia Caroline, Juliana Rodrigues, Julio, Leticia Nunes, Thayna, Yanca Oliveira

**Faltando na lista hardcoded:**
- **Evellyn** (evellyn.santos@minhacasafinanciada.com) - está em `profiles` com squad=incorporador
- **Roger** (robert.gusmao@minhacasafinanciada.com) - está em `profiles` e `employees` como SDR

**Closers R1 no Incorporador** (tabela `closers`):
- Cristiane Gomes, Julio, Thayna

**Closers incorretamente mostrados** (são do Consórcio):
- João Pedro Martins Vieira, Victoria Paz, Luis Felipe, Thobson

## Solução Proposta

### Parte 1: SDRs - Usar dados dinâmicos do banco

**Arquivo:** `src/hooks/useTeamMeetingsData.ts`

Substituir a constante `SDR_LIST` por dados da tabela `sdr`:

```typescript
// Antes: SDR_LIST estático
const validSdrEmails = new Set(SDR_LIST.map(sdr => sdr.email.toLowerCase()));

// Depois: buscar SDRs ativos do squad 'incorporador'
const { data: activeSdrs } = useSdrsFromSquad('incorporador');
const validSdrEmails = new Set((activeSdrs || []).map(s => s.email.toLowerCase()));
```

**Criar hook:** `src/hooks/useSdrsFromSquad.ts`

```typescript
export function useSdrsFromSquad(squad: string) {
  return useQuery({
    queryKey: ['sdrs-squad', squad],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('id, name, email, role_type, meta_diaria')
        .eq('active', true)
        .eq('squad', squad)
        .eq('role_type', 'sdr')  // Apenas SDRs, não closers
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });
}
```

### Parte 2: Closers - Filtrar por BU

**Arquivo:** `src/hooks/useR1CloserMetrics.ts`

Adicionar filtro por BU na query de closers:

```typescript
// Antes
const { data: closers } = await supabase
  .from('closers')
  .select('id, name, color, meeting_type')
  .eq('is_active', true);

// Depois
const { data: closers } = await supabase
  .from('closers')
  .select('id, name, color, meeting_type, bu')
  .eq('is_active', true)
  .eq('bu', 'incorporador');  // Filtrar por BU
```

### Parte 3: Adicionar SDRs faltantes no banco

Criar registros na tabela `sdr` para:

| Nome | Email | Squad | Role |
|------|-------|-------|------|
| Evellyn Vieira dos Santos | evellyn.santos@minhacasafinanciada.com | incorporador | sdr |
| Robert Roger Santos Gusmão | robert.gusmao@minhacasafinanciada.com | incorporador | sdr |

### Parte 4: Atualizar Vinicius Rangel

Mover da squad `incorporador` para `credito` (já está correto no RH):

```sql
UPDATE sdr SET squad = 'credito' WHERE email = 'rangel.vinicius@minhacasafinanciada.com';
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSdrsFromSquad.ts` | Criar hook para buscar SDRs por squad |
| `src/hooks/useTeamMeetingsData.ts` | Usar hook dinâmico em vez de `SDR_LIST` |
| `src/hooks/useR1CloserMetrics.ts` | Adicionar filtro `.eq('bu', 'incorporador')` |
| `src/pages/crm/ReunioesEquipe.tsx` | Atualizar imports e passar contexto de BU |
| Banco de dados | Insert de Evellyn/Roger, Update de Vinicius |

## Resultado Esperado

Após a implementação:

**Aba SDRs:**
- Alex Dias, Antony Elias, Carol Correa, Carol Souza, **Evellyn**, Jessica Martins, Julia Caroline, Juliana Rodrigues, Leticia Nunes, **Roger**, Yanca Oliveira
- ~~Vinicius Rangel~~ (movido para Crédito)

**Aba Closers:**
- Cristiane Gomes, Julio, Thayna
- ~~João Pedro~~, ~~Victoria~~, ~~Luis Felipe~~, ~~Thobson~~ (filtrados por serem do Consórcio)

## Seção Técnica

A refatoração segue a arquitetura existente de BU Context:

```text
┌─────────────────────────┐
│   ReunioesEquipe.tsx    │
│   (BU = incorporador)   │
└───────────┬─────────────┘
            │
    ┌───────▼───────┐
    │  useSdrsFrom  │
    │    Squad()    │◄── Busca SDRs ativos por squad
    └───────────────┘
            │
    ┌───────▼───────┐
    │  useR1Closer  │
    │   Metrics()   │◄── Adiciona filtro .eq('bu', bu)
    └───────────────┘
```

A solução é escalável para outras BUs (Consórcio, Crédito, Projetos) usando o mesmo padrão de filtro.
