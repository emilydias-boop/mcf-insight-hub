
# Migrar Hooks Restantes para Dados Dinâmicos de SDR

## Diagnóstico

A tabela "Atividades por SDR" e outros hooks ainda usam a constante `SDR_LIST` hardcoded, causando os mesmos problemas identificados anteriormente (Vinicius aparece, Evellyn e Roger não aparecem).

| Arquivo | Problema | Status |
|---------|----------|--------|
| `src/hooks/useSdrActivityMetrics.ts` | Usa `SDR_LIST` nas linhas 62 e 78 | Pendente |
| `src/hooks/useSDRCarrinhoMetrics.ts` | Usa `SDR_LIST` nas linhas 19-20 | Pendente |
| `src/hooks/useSdrOutsideMetrics.ts` | Usa `SDR_LIST` na linha 26 | Pendente |
| `src/hooks/useR1CloserMetrics.ts` | Usa `SDR_LIST` na linha 38 | Pendente |
| `src/hooks/useTeamMeetingsData.ts` | Já usa `useSdrsFromSquad` | OK |

## Solução

Todos os hooks acima devem:
1. Receber a lista de SDRs válidos como parâmetro (injetada pelo componente pai)
2. Ou buscar internamente usando o hook `useSdrsFromSquad`

### Estratégia: Injeção de Dependência

Como os hooks já existem e são usados em vários lugares, a melhor abordagem é:
1. **Criar uma versão "interna"** das queries que recebe `validSdrEmails` e `sdrNameMap` como parâmetros
2. **Exportar um hook wrapper** que busca os SDRs dinamicamente

### Alterações por Arquivo

**1. `useSdrActivityMetrics.ts`**

Substituir:
```typescript
import { SDR_LIST } from '@/constants/team';

// Inicializar métricas para SDRs conhecidos
SDR_LIST.forEach(sdr => { ... });
```

Por:
```typescript
import { useSdrsFromSquad } from './useSdrsFromSquad';

export function useSdrActivityMetrics(startDate, endDate, originId, squad = 'incorporador') {
  const sdrsQuery = useSdrsFromSquad(squad);
  
  return useQuery({
    // ...
    queryFn: async () => {
      const sdrs = sdrsQuery.data || [];
      const validSdrEmails = new Set(sdrs.map(s => s.email.toLowerCase()));
      const sdrNameMap = new Map(sdrs.map(s => [s.email.toLowerCase(), s.name]));
      // Usar esses sets em vez de SDR_LIST
    },
    enabled: !!startDate && !!endDate && sdrsQuery.isSuccess,
  });
}
```

**2. `useSDRCarrinhoMetrics.ts`**

Mesmo padrão - substituir `SDR_LIST` por dados dinâmicos de `useSdrsFromSquad`.

**3. `useSdrOutsideMetrics.ts`**

Mesmo padrão.

**4. `useR1CloserMetrics.ts`**

Substituir:
```typescript
const validSdrEmails = new Set(SDR_LIST.map(s => s.email.toLowerCase()));
```

Por:
```typescript
// Fetch active SDRs from incorporador squad
const { data: sdrs } = await supabase
  .from('sdr')
  .select('email, name')
  .eq('active', true)
  .eq('squad', 'incorporador')
  .eq('role_type', 'sdr');

const validSdrEmails = new Set((sdrs || []).map(s => s.email.toLowerCase()));
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSdrActivityMetrics.ts` | Usar `useSdrsFromSquad` em vez de `SDR_LIST` |
| `src/hooks/useSDRCarrinhoMetrics.ts` | Usar `useSdrsFromSquad` em vez de `SDR_LIST` |
| `src/hooks/useSdrOutsideMetrics.ts` | Usar `useSdrsFromSquad` em vez de `SDR_LIST` |
| `src/hooks/useR1CloserMetrics.ts` | Buscar SDRs dinamicamente via Supabase |

## Resultado Esperado

Após a implementação, **todas** as tabelas do painel comercial (Atividades por SDR, Métricas de Closer, Carrinho, etc.) mostrarão:
- Evellyn e Roger (novos SDRs do Incorporador)
- Sem Vinicius Rangel (movido para Crédito)
- Sincronização automática com o RH

## Seção Técnica

A refatoração segue o padrão já estabelecido em `useTeamMeetingsData`:

```text
┌───────────────────────────────┐
│   Componente (ReunioesEquipe) │
└───────────────┬───────────────┘
                │
   ┌────────────▼────────────┐
   │    useSdrsFromSquad     │◄── Fonte única de verdade
   │    (squad='incorporador')│
   └────────────┬────────────┘
                │
   ┌────────────▼────────────────────────────────────┐
   │  Hooks de Métricas (Activity, Carrinho, etc.)  │
   │  - Recebem sdrs como dependência               │
   │  - Filtram apenas SDRs válidos                 │
   └────────────────────────────────────────────────┘
```

Diferença técnica entre abordagens:
- **Hooks que usam `useQuery`**: Podem compor com `useSdrsFromSquad` diretamente (ex: `useSdrActivityMetrics`)
- **Hooks que fazem fetch interno**: Devem buscar SDRs dentro da `queryFn` para evitar regras de hooks (ex: `useR1CloserMetrics`)
