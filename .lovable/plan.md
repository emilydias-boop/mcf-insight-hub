

## Limpeza profunda de performance — Plano completo

### Diagnóstico

Análise do codebase (286 hooks, 540 componentes, ~228k linhas):

| Sintoma | Medição | Impacto |
|---|---|---|
| **Sem code-splitting** | 0 `React.lazy()`, 0 `Suspense` em rotas. Tudo importado sincronamente em `App.tsx` | Bundle inicial enorme — usuário baixa todas as páginas no primeiro load |
| **Polling agressivo** | 27 hooks com `refetchInterval: 60000`, 4 com 30s, 2 com 5s, 2 com 10s — **40 hooks** disparando refetch em background sem pausar | A cada minuto dezenas de queries pesadas rodam mesmo com a aba parada |
| **`refetchOnWindowFocus` sem controle** | Apenas 7 hooks desabilitam — o resto recarrega tudo a cada troca de aba | Cada `Alt+Tab` dispara cascata de refetch |
| **Sem `staleTime` consistente** | 91 hooks usam `staleTime`, mas valores variam de 10s a 10min sem critério; QueryClient default sem config | React Query refaz fetch a cada navegação |
| **Selects amplos** | 281 ocorrências de `select('*')` ou similar; muitos em modais e drawers | Payload grande, muitas colunas inúteis |
| **439 `console.log` em produção** | Sem flag de build | Custo de serialização + ruído no DevTools |
| **Hooks gigantes** | `useCRMOverviewData` 554 linhas, `useR1CloserMetrics` 528, `useR2CarrinhoVendas` 457 — múltiplos `useQuery` aninhados | Recomputações em cascata |
| **QueryClient default** | `new QueryClient()` sem opções globais em `App.tsx` linha 124 | Defaults do React Query são agressivos |
| **Edge function `sync-clint-data` rodando "shutdown" frequente** | Logs mostram boot/shutdown a cada 30-60s do `outbound-webhook-dispatcher` e `process-deal-replication` | Confirma que polling do front dispara backend continuamente |

### Plano de limpeza — 5 ondas

#### **Onda 1 — QueryClient global + parar polling em background** (impacto enorme, baixo risco)

**`src/App.tsx`** — substituir `new QueryClient()` por config global:
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,                  // padrão: 1 min
      gcTime: 5 * 60_000,                 // GC após 5 min sem uso
      refetchOnWindowFocus: false,        // não recarrega ao focar aba
      refetchOnReconnect: 'always',
      refetchIntervalInBackground: false, // ⚠️ chave: pausa polling quando aba não está visível
      retry: 1,
      retryDelay: 1000,
    },
  },
});
```

Isso sozinho elimina ~70% das requisições desnecessárias porque hoje o polling de 60s roda mesmo em abas em background.

#### **Onda 2 — Code-splitting de rotas** (carregamento inicial muito mais rápido)

**`src/App.tsx`** — converter ~80 imports de páginas para `React.lazy()`:
```ts
const Chairman = lazy(() => import('./pages/Chairman'));
const ConsorcioFechamento = lazy(() => import('./pages/bu-consorcio/Fechamento'));
// ... idem para todas as páginas
```

Envolver `<Routes>` em `<Suspense fallback={<PageSkeleton />}>`. Páginas pequenas e raras (Auth, Reset, NotFound) podem ficar síncronas.

Resultado esperado: bundle inicial cai de ~1 chunk gigante para vários chunks por rota; cada rota só baixa o JS dela.

#### **Onda 3 — Auditar e reduzir polling** (CPU/rede)

Para cada um dos 40 hooks com `refetchInterval`, aplicar uma destas 3 regras:

1. **Remover polling** se a tabela já tem realtime ou se a aba não exige tempo real (ex: `useChairmanMetrics`, `useTeamRevenueByMonth`, `useUltrameta*`, `useR2QualificationReport`, `useCobranca*`, `useMeetingReminders*`).
2. **Aumentar para 5 min** quando faz sentido manter atualização (ex: relatórios financeiros, dashboards executivos).
3. **Manter 30s/60s só para listas operacionais ao vivo**: `useWebhookLogs`, `useSyncMonitor`, `useAutomationLogs`, `usePendingNextActions`, `useUnlinkedTransactions`, `useR2CarrinhoVendas` (apenas durante uso ativo da aba).

Heurística: rotas executivas/relatórios → sem polling; rotas operacionais (Carrinho, Webhooks, Sync) → 30-60s; tudo mais → invalidação por mutação.

#### **Onda 4 — Reduzir payload de queries** (rede + parse)

1. **Eliminar `select('*')` em hot paths** (281 ocorrências). Foco nos componentes que aparecem com frequência: `ContactDetailsDrawer`, `DealFormDialog`, `DealHistory`, `NextActionBlockCompact`, `useA010Acquisition`. Trocar por colunas explícitas.
2. **Validar uso de `range()` paginado** em vez de buscas grandes (já existe em alguns lugares, mas há `.limit(5000)` em `useAllHublaTransactions` e `useTransactionsByBU`).
3. **Identificar queries duplicadas** entre páginas Incorporador (`AcquisitionReportPanel`, `ChannelFunnelTable`) que hoje refazem o mesmo fetch — consolidar em uma `queryKey` compartilhada (já parcialmente feito via `useAcquisitionReport`).

#### **Onda 5 — Limpeza de código** (manutenção + parse)

1. **Remover `console.log/info/debug`** em produção via plugin Vite ou condicional `if (import.meta.env.DEV)`. Manter `console.error` para Sentry-like tracking. Total: 439 ocorrências.
2. **Quebrar hooks gigantes** (>400 linhas) em sub-hooks compostos. Aplicar primeiro a `useCRMOverviewData`, `useR1CloserMetrics`, `useR2CarrinhoVendas` — eles são chamados em rotas frequentes e cada re-render reprocessa tudo.
3. **Memoização**: rodar perfil rápido nos componentes mais pesados (`AcquisitionReportPanel`, `R2CarrinhoView`) para identificar `useMemo` faltantes.

### Rollout sugerido (ordem de risco crescente)

1. **Onda 1** (1 arquivo, 5 min, reversível trivial) → ganho imediato.
2. **Onda 2** (1 arquivo grande mas mecânico) → maior ganho percebido pelo usuário.
3. **Onda 3** (40 arquivos, mas mudanças pequenas em cada) → eu agrupo por categoria.
4. **Onda 4** (incremental, faço por componente) → ganho médio.
5. **Onda 5** (limpeza contínua) → ganho de manutenibilidade + parse.

Recomendo aprovar **Ondas 1 + 2 + 3** numa primeira leva — são as que mais impactam performance percebida sem risco de regressão funcional. Ondas 4 e 5 podem vir num plano separado depois.

### Validação pós-implementação

- Bundle inicial: medir com `vite build` antes/depois (esperado: queda 60-80%).
- Network tab: contar requisições por minuto numa rota parada (esperado: cair de ~30-50/min para <5/min).
- Edge functions: monitorar `outbound-webhook-dispatcher` boot rate (esperado: cair pela metade pelo menos).
- Memória: heap do navegador após 10 min ocioso (esperado: ~30% menor).

### Fora do escopo

- Otimizações de RPC no banco (alguns RPCs como `get_carrinho_r2_attendees` podem ser lentos — fica para outro plano se medirmos gargalo lá).
- Service Worker / PWA cache.
- Reescrever páginas — apenas otimizar.

### Reversibilidade

Onda 1 e Onda 2 são reversíveis em <5 min. Onda 3 é mudança por arquivo, fácil reverter por hook. Todas mudanças preservam comportamento funcional.

