# Plano: eliminar diferença por fuso UTC entre os painéis

Você tem razão: se o navegador está em UTC, o problema não é apenas cache. A causa provável está na forma como o painel **Reuniões da Equipe** inicializa o mês pela URL.

## Causa encontrada

Na rota `/crm/reunioes-equipe?preset=month&month=2026-04`, o código faz:

```ts
parseISO(searchParams.get("month") + "-01")
```

Em ambiente UTC isso pode parecer correto, mas o restante das métricas da agenda é calculado no banco usando **America/Sao_Paulo**:

```sql
(... AT TIME ZONE 'America/Sao_Paulo')::date
```

Então a tela pode acabar mandando para a RPC uma janela diferente da janela visual esperada, especialmente em mês passado / início e fim de mês. Isso afeta principalmente o KPI **Agendamentos**, porque ele usa `first_booked_at` na data SP. Os demais KPIs podem bater porque são ancorados por `scheduled_at`/status e já estão caindo dentro da mesma janela.

Além disso, há outro sinal no screenshot: em **Minhas Reuniões** o seletor superior aparece como **maio 2026**, enquanto o filtro inferior está em **01/04/2026 - 30/04/2026**. Isso indica estado de mês/filtro podendo ficar desalinhado visualmente.

## O que será alterado

### 1. Criar helper seguro de parsing de mês/data

Adicionar uma função utilitária para transformar strings de URL sem depender de `parseISO`/`new Date(dateStr)`:

- `parseYearMonthLocal("2026-04")` → `new Date(2026, 3, 1)`
- `parseYmdLocal("2026-04-01")` → `new Date(2026, 3, 1)`

Isso evita deslocamento de dia/mês por timezone.

### 2. Corrigir `ReunioesEquipe.tsx`

Trocar:

```ts
parseISO(searchParams.get("month") + "-01")
parseISO(searchParams.get("start")!)
parseISO(searchParams.get("end")!)
```

por parsing local explícito.

Resultado esperado:

- `month=2026-04` sempre vira **abril/2026 local**.
- A RPC sempre recebe `2026-04-01` até `2026-04-30` quando a tela mostra abril.
- Não haverá variação por navegador em UTC, São Paulo, ou outro fuso.

### 3. Corrigir `SdrMeetingsDetailPage.tsx`

Essa página de detalhe do SDR também lê parâmetros da URL com `parseISO`, então será ajustada para o mesmo padrão. Isso evita divergência quando o usuário entra no detalhe da Carol a partir do painel geral.

### 4. Revisar `MinhasReunioes.tsx`

Manter a construção do mês via `new Date(year, month - 1)` porque ela já é segura, mas ajustar o estado visual se necessário para garantir que o seletor superior e o período inferior fiquem sempre sincronizados.

## Validação após implementação

Depois da alteração, vou validar estes cenários:

1. `/crm/reunioes-equipe?preset=month&month=2026-04`
   - janela enviada: `2026-04-01` a `2026-04-30`.
2. Carol Correa em abril/2026:
   - Agendamentos deve bater com **Minhas Reuniões** para o mesmo período.
3. Link para detalhe do SDR:
   - o detalhe deve manter a mesma janela do painel geral.
4. Ambiente em UTC:
   - mês passado não deve deslocar para março/maio nem cortar bordas do período.

## Arquivos previstos

- `src/pages/crm/ReunioesEquipe.tsx`
- `src/pages/crm/SdrMeetingsDetailPage.tsx`
- Possivelmente `src/lib/dateHelpers.ts` ou novo helper pequeno em `src/lib/` para centralizar o parsing seguro

Nenhuma mudança de banco é necessária.