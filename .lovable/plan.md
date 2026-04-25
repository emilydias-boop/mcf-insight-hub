## Objetivo
Quando um lead **atende** durante o auto-discador, o SDR/Closer precisa ver **todos os dados do lead** (igual ao drawer do CRM) sem perder os controles da ligação. Hoje só aparece um banner flutuante mínimo no topo (nome, telefone, mute/hangup/qualificar).

A solução é reaproveitar o `DealDetailsDrawer` existente — que já entrega cabeçalho, ações rápidas, jornada, qualificação resumida, perfil do lead, abas (Timeline, Tarefas, Histórico, Ligações, Notas, Produtos) e A010 — abrindo-o automaticamente assim que a chamada conecta, e mantendo o banner verde como **barra flutuante persistente de controle da chamada** sobre o drawer.

## Comportamento esperado
1. Auto-discador disca → lead atende → estado vira `paused-in-call`.
2. Sistema **abre automaticamente o `DealDetailsDrawer`** com o `dealId` do lead corrente.
3. Toca o beep de alerta (já existe).
4. O `AutoDialerInCallBanner` continua visível **acima do drawer** (z-index maior), mostrando: nome, telefone, duração, mute, qualificar, hangup, e novos botões "Pular" e "Próximo".
5. Quando a chamada encerra → abre o `QualificationAndScheduleModal` (fluxo atual) → ao fechar, drawer fecha e fila retoma.
6. Se o SDR fechar o drawer manualmente durante a ligação, o banner permanece (controles da chamada não somem). Reabrir é possível clicando no nome do lead no banner.

## Mudanças

### 1. `src/contexts/AutoDialerContext.tsx` (editar)
- Adicionar estado e API para controlar o drawer:
  - `inCallDrawerOpen: boolean`
  - `setInCallDrawerOpen: (open: boolean) => void`
- Quando `callStatus` transita para `in-progress` (bloco que já seta `paused-in-call`), também setar `inCallDrawerOpen = true`.
- Quando a chamada encerra (`completed`/`failed`) e abre qualificação, fechar o drawer (`inCallDrawerOpen = false`) — o modal de qualificação já é global e cobre o contexto necessário.
- Quando a fila avança/para/skip, garantir `inCallDrawerOpen = false`.

### 2. `src/components/sdr/AutoDialerInCallBanner.tsx` (editar)
- Adicionar botão **"Ver lead"** (ícone `User`/`PanelRight`) que faz `setInCallDrawerOpen(true)` — útil caso o SDR feche o drawer.
- Adicionar botão **"Pular"** (ícone `SkipForward`) chamando `skipCurrent()` do auto-discador, com confirmação leve (sem modal).
- Subir o `z-index` do banner para `z-[120]` para garantir que fique acima do `Sheet` do drawer (que usa `z-50`).
- Manter beep + controles atuais (mute, qualificar, hangup).

### 3. `src/components/sdr/AutoDialerDealDrawer.tsx` (novo, wrapper fino)
- Componente pequeno que consome `useAutoDialer()` e renderiza:
  ```tsx
  <DealDetailsDrawer
    dealId={currentLead?.dealId ?? null}
    open={inCallDrawerOpen && state === 'paused-in-call'}
    onOpenChange={setInCallDrawerOpen}
  />
  ```
- Justificativa: isolar a lógica e evitar inflar o `MainLayout`.

### 4. `src/components/layout/MainLayout.tsx` (editar)
- Montar `<AutoDialerDealDrawer />` dentro do `<AutoDialerProvider>`, **antes** do `<AutoDialerInCallBanner />` para que o banner fique sobreposto.

## Pontos de atenção
- **Não duplicar o modal de qualificação**: o `DealDetailsDrawer` tem seu próprio `QualificationAndScheduleModal` interno acionado por "Qualificar". O modal global do `TwilioContext` continua sendo o gatilho automático pós-chamada — ambos coexistem hoje sem conflito porque usam o mesmo `dealId`.
- **Z-index**: `Sheet` usa `z-50` (overlay) e `z-50` (content). Banner precisa `z-[120]` para sobrepor; o `OverdueAlertOverlay` e modais permanecem em camadas próprias.
- **Drawer fechar não pausa a chamada**: fechar é só esconder a UI; a chamada continua e o banner permanece no topo.
- **Performance**: o drawer abre/fecha por chamada (até 100 leads), mas só renderiza quando `open=true` graças ao `Sheet` do Radix — sem custo ocioso.
- **Mobile**: o `Sheet` ocupa `sm:max-w-2xl`; em telas pequenas vira full-width — o banner continua no topo.

## Arquivos
- editar `src/contexts/AutoDialerContext.tsx`
- editar `src/components/sdr/AutoDialerInCallBanner.tsx`
- criar `src/components/sdr/AutoDialerDealDrawer.tsx`
- editar `src/components/layout/MainLayout.tsx`

## Critérios de aceite
- Lead atende → drawer abre automaticamente com todos os dados.
- Banner flutuante fica visível acima do drawer com mute, qualificar, pular, hangup, ver lead.
- Fechar o drawer manualmente não derruba a chamada nem pausa a fila.
- Ao desligar, modal de qualificação abre (comportamento atual) e drawer fecha.
- Após salvar qualificação, fila retoma normalmente.