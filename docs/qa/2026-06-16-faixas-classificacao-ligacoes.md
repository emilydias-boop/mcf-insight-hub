# QA — Faixas de Classificação de Ligações por BU

## 1. Metadados
- **Data:** 2026-06-16
- **Solicitante:** thobson.motta@minhacasafinanciada.com
- **Módulo:** CRM › Painel Comercial › Atividades por SDR
- **BUs afetadas:** Todas (default, incorporador, consorcio, demais squads)
- **Status:** Implementado — aguardando validação

## 2. Contexto e objetivo
Ampliar o card "Atividades por SDR" para classificar ligações em 5 categorias por duração:
Ring drop, Caixa postal (heurística), Efetivas, Qualificadas e Não atendidas.
As faixas de duração deixam de ser fixas no código e passam a ser configuráveis por BU,
permitindo calibração sem deploy.

## 3. Escopo
**Incluído**
- Tabela `call_classification_thresholds` (squad único, ring_drop_max / voicemail_max / effective_max).
- Tela admin `/admin/faixas-ligacoes` (CRUD por BU).
- Hook `useCallClassificationThresholds` integrado a `useSdrActivityMetrics`.
- Aplicação dinâmica das faixas em todos os BUs.
- Sidebar admin: link "Faixas de Ligações".

**Fora do escopo**
- Ativação de AMD do Twilio (mantida desligada — heurística por duração).
- Histórico/auditoria de mudanças de faixa.
- Reprocessamento retroativo de métricas antigas.

## 4. Arquivos, rotas e tabelas
- `supabase/migrations/20260616222207_*.sql` — cria tabela + RLS + seeds.
- `src/hooks/useCallClassificationThresholds.ts`
- `src/hooks/useSdrActivityMetrics.ts`
- `src/components/sdr/SdrActivityMetricsTable.tsx`
- `src/pages/admin/CallThresholdsConfig.tsx`
- `src/App.tsx` — rota `/admin/faixas-ligacoes` (RoleGuard admin/manager).
- `src/components/layout/AppSidebar.tsx` — link no menu admin.

## 5. Critérios de aceite
1. Admin/manager conseguem criar, editar e excluir faixas por BU.
2. Validação impede salvar com `ring_drop_max < voicemail_max < effective_max` violado.
3. Card "Atividades por SDR" reflete novas faixas em até 5 min (staleTime) ou após invalidação.
4. BU sem registro próprio cai no fallback `default` (10 / 30 / 60s).
5. Usuários sem papel admin/manager não acessam a rota.

## 6. Roadmap de testes

### 6.1 Funcionais
| # | Passos | Esperado |
|---|--------|----------|
| F1 | Logar como admin → /admin/faixas-ligacoes → criar squad "incorporador" 8/25/55 | Linha aparece na tabela, toast de sucesso |
| F2 | Editar registro existente para 12/40/70 | Persiste e métricas atualizam após refresh |
| F3 | Excluir squad customizado | Sumiu da listagem; BU passa a usar default |
| F4 | Abrir Painel Comercial › BU Incorporador › Atividades por SDR | Colunas Ring drop / Caixa postal / Efetivas / Qualificadas refletem faixas configuradas |
| F5 | Repetir F4 em BU Consórcio | Usa faixas próprias do squad consorcio |

### 6.2 Edge cases
| # | Cenário | Esperado |
|---|---------|----------|
| E1 | Salvar com ring_drop_max = voicemail_max | Bloqueado com mensagem clara |
| E2 | Valores negativos ou zero | Bloqueado (CHECK > 0) |
| E3 | Squad duplicado | Upsert atualiza o existente, não cria duplicata |
| E4 | BU sem registro próprio e sem default | Hook retorna DEFAULT_THRESHOLDS 10/30/60 |
| E5 | Call com duration_seconds NULL | Classificada como "Não atendida" |

### 6.3 Regressão
- R1: Totais antigos (Ligações, Atendidas, >1min) continuam coerentes para semanas anteriores.
- R2: Demais cards do Painel Comercial não quebram (Reuniões, R1, No-Show).
- R3: Performance da query do painel não degrada (>5s indica problema).

### 6.4 Permissões / RLS
| # | Papel | Ação | Esperado |
|---|-------|------|----------|
| P1 | admin | SELECT/INSERT/UPDATE/DELETE | Permitido |
| P2 | manager | SELECT/INSERT/UPDATE/DELETE | Permitido |
| P3 | closer/sdr | SELECT | Permitido (leitura) |
| P4 | closer/sdr | INSERT/UPDATE/DELETE via API | Bloqueado por RLS |
| P5 | anon | Qualquer | Bloqueado |

### 6.5 UI/UX
- U1: Formulário mostra ordem esperada e unidades (segundos).
- U2: Toasts de sucesso/erro aparecem em PT-BR.
- U3: Sidebar exibe "Faixas de Ligações" apenas para admin/manager.
- U4: Tabela é responsiva em viewport mobile (<768px).

## 7. Riscos e rollback
- **Risco:** faixa mal calibrada distorce métricas do dia. **Mitigação:** edição rápida pelo admin.
- **Risco:** cache de 5min mascara mudança recente. **Mitigação:** invalidação automática após save.
- **Rollback:** remover link da sidebar + reverter `useSdrActivityMetrics` para constantes fixas; tabela pode permanecer sem efeito.

## 8. Checklist final
- [ ] Migration aplicada em produção sem erro
- [ ] Seeds default/incorporador/consorcio presentes
- [ ] Testes F1–F5 executados
- [ ] Edge cases E1–E5 executados
- [ ] Permissões P1–P5 verificadas
- [ ] Validação visual em ao menos 2 BUs
- [ ] Aprovação de Thobson registrada