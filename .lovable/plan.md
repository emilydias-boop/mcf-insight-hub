# Auto-Discador: drawer não abre quando o lead atende

## Sintoma confirmado pelo usuário

Banner verde "📞 atendeu!" aparece (logo `state` chega em `paused-in-call`), mas o `DealDetailsDrawer` que deveria montar ao lado **não abre**. A fila pode ter mistura de leads do CRM e telefones colados.

## Hipóteses (ordenadas por probabilidade)

1. **Lead com `dealId` no formato `manual-*`** — `AutoDialerDealDrawer` bloqueia explicitamente:
   ```ts
   const isRealDeal = !!dealId && !dealId.startsWith('manual-');
   const open = state === 'paused-in-call' && inCallDrawerOpen && isRealDeal;
   ```
   Se o telefone colado **não** casou com nenhum deal do CRM em `AutoDialerPanel` (linha 223 cria `dealId: manual-${Date.now()}-${i}`), o drawer nunca abre — by design. O usuário pode esperar que abra mesmo assim.

2. **Conflito de z-index Banner × Sheet** — `AutoDialerInCallBanner` é renderizado com `z-[120]`, e o `SheetContent` do Radix usa `z-50`. O banner sobreposto pode estar interceptando o foco/click inicial e fazendo o Radix disparar `onOpenChange(false)` por "interaction outside", fechando o drawer no mesmo frame em que ele tenta abrir.

3. **Race com `setDrawerState` do `TwilioContext`** — o `useEffect` em `DealDetailsDrawer` (linhas 53-55) chama `setDrawerState(open, dealId)` toda vez que `open` muda. Se outro consumidor do contexto reagir e fechar o drawer, vira loop.

4. **`currentLead.dealId` nulo/undefined** — se a fila for populada com objetos sem `dealId`, `isRealDeal=false` e o drawer some.

## Plano de correção

### Passo 1 — Instrumentar para confirmar a hipótese
Adicionar `console.debug` em `AutoDialerDealDrawer` mostrando `state`, `currentLead?.dealId`, `inCallDrawerOpen`, `isRealDeal` e `open` toda vez que mudar. Pedir ao usuário um teste rápido para identificar qual hipótese é real.

### Passo 2 — Corrigir baseado no diagnóstico

**Se for hipótese 1 (manual-*):**
- Permitir abrir o drawer também para leads colados que **casaram** com um deal real (já é o caso, esses não têm prefixo `manual-`).
- Para leads verdadeiramente avulsos (sem CRM), trocar o "drawer rico" por um drawer simplificado mostrando apenas nome/telefone + botões de qualificação rápida, ou deixar o banner verde ser a única UI.

**Se for hipótese 2 (z-index/interaction outside):**
- Ajustar o banner para `pointer-events-none` no container e `pointer-events-auto` apenas nos botões internos, evitando que o Radix Dialog interprete o banner como "click fora".
- Alternativa: aumentar `z-index` do `SheetContent` quando aberto pelo auto-discador (variant) ou abaixar o banner para `z-40` enquanto o drawer está aberto.

**Se for hipótese 3 (race com setDrawerState):**
- Tornar `setDrawerState` idempotente (só atualizar se mudou) e/ou desacoplar do `AutoDialerDealDrawer` (não chamar quando a origem do open é o auto-discador).

**Se for hipótese 4 (dealId vazio):**
- Garantir que toda entrada na fila do `AutoDialerPanel` carregue o `dealId` retornado pelo match no CRM antes de iniciar a discagem.

### Passo 3 — Validar
- Reproduzir 3 cenários: lead 100% CRM, telefone colado que casou, telefone colado que não casou.
- Em cada um, verificar que o banner aparece **e** o drawer abre (ou, no terceiro caso, que a UI mínima esperada aparece).
- Remover os `console.debug` após confirmação.

## Detalhes técnicos relevantes

- Arquivos envolvidos: `src/components/sdr/AutoDialerDealDrawer.tsx`, `src/components/sdr/AutoDialerInCallBanner.tsx`, `src/contexts/AutoDialerContext.tsx` (linha 209: `setInCallDrawerOpen(true)` no `in-progress`), `src/components/crm/DealDetailsDrawer.tsx` (linhas 53-55 e 77).
- O drawer está montado globalmente em `MainLayout.tsx`, então não há problema de rota.
- `currentLead` vem de `queue[currentIndex]`; em `AutoDialerPanel.tsx:223` os leads avulsos são marcados com `dealId: manual-...`.

Sem mexer em business logic (Twilio/Telephony, atribuição, qualificação) — só na camada de apresentação que decide montar o drawer.
