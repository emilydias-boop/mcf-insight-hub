
# 🚀 Auto-Discador (Power Dialer) – Discagem automática com pausa inteligente

## Objetivo

Permitir que o SDR/Closer carregue uma **fila de leads** (manual ou da pipeline) e o sistema disque **automaticamente, um após o outro**:

1. Disca lead 1 → toca / ninguém atende → registra resultado → disca lead 2 → ...
2. Quando alguém **atende** (status `in-progress` do Twilio), o sistema **alerta o SDR** (som + visual) e **pausa a fila**.
3. SDR conduz a ligação normalmente.
4. Ao **encerrar a chamada**, abre automaticamente o **modal de qualificação** (já existente, `openQualificationModal`).
5. SDR escolhe um desfecho:
   - **Agendar reunião** → abre o modal de agendamento existente.
   - **Sem interesse / Perdido** → marca o lead.
   - **Retornar depois** → agenda follow-up.
6. Após salvar o desfecho, a fila **retoma automaticamente** no próximo lead.

---

## 📦 Componentes / Hooks a criar

### 1. `src/contexts/AutoDialerContext.tsx` *(novo)*

Contexto global que gerencia:

```ts
type AutoDialerState = 'idle' | 'running' | 'paused-in-call' | 'paused-qualifying' | 'finished';

interface AutoDialerContextType {
  state: AutoDialerState;
  queue: AutoDialerLead[];          // fila com phone, dealId, contactId, originId, name
  currentIndex: number;
  currentLead: AutoDialerLead | null;
  stats: { total; called; answered; noAnswer; failed };
  ringTimeoutMs: number;            // default 25000 (25s)
  betweenCallsMs: number;           // default 2000 (2s)

  loadQueue: (leads: AutoDialerLead[]) => void;
  start: () => void;                // dispara primeira ligação
  pause: () => void;                // pausa após call atual
  resume: () => void;               // retoma a fila
  skipCurrent: () => void;          // pula sem ligar
  stop: () => void;                 // limpa fila
}
```

**Lógica chave:**
- Ao iniciar, chama `makeCall(lead.phone, lead.dealId, ...)` do `TwilioContext`.
- **Observa `callStatus`** do `TwilioContext`:
  - `ringing` → inicia timer de 25s. Se não atender, faz `hangUp()` + registra `nao_atendeu` em `deal_activities` + avança.
  - `in-progress` → muda state para `paused-in-call`, toca som de alerta (já temos `notification.mp3`?), exibe banner.
  - `completed` / `failed` → se vinha de `in-progress`, abre **modal de qualificação** (`openQualificationModal(currentLead.dealId)`) e muda state para `paused-qualifying`. Se vinha de `ringing` (não atendeu), avança automaticamente após `betweenCallsMs`.
- Quando o modal de qualificação fecha (`qualificationModalOpen` muda de true → false), retoma automaticamente.

### 2. `src/hooks/useAutoDialerController.ts` *(novo)*

Hook que escuta as transições de `callStatus` do `TwilioContext` e dispara os efeitos do controlador.

### 3. `src/components/sdr/AutoDialerPanel.tsx` *(novo)*

Painel principal (pode ficar dentro do **SDRCockpit** ou como um Drawer dedicado):

- Botão **"Carregar fila da pipeline atual"** (usa `useSDRQueueInfinite` para popular).
- Botão **"Carregar fila do Cockpit"** (mesma função).
- Lista visual da fila com indicadores:
  - 🟢 Atendeu | 🔴 Não atendeu | ⚪ Pendente | 🔵 Em ligação
- Controles: **Iniciar / Pausar / Pular / Parar**.
- Stats em tempo real: `5/20 ligados • 1 atendeu • 4 não atenderam`.
- Configurações inline: tempo de toque (15/25/40s) e pausa entre ligações (2/5s).

### 4. `src/components/sdr/AutoDialerInCallBanner.tsx` *(novo)*

Banner full-width que aparece quando `state === 'paused-in-call'`:

- 🔔 Som de alerta + animação pulsante.
- "📞 **{nome do lead}** atendeu! — em ligação há {timer}".
- Atalhos visíveis: Mute / Encerrar / Abrir qualificação.
- Toca som (Web Audio API) curto e discreto (`/sounds/answer-alert.mp3`).

### 5. `src/components/crm/QuickDialer.tsx` *(editar)*

Adicionar uma aba/botão extra: **"Modo Auto-Discador"** que abre o `AutoDialerPanel` em vez de fazer uma ligação única.

### 6. `src/contexts/TwilioContext.tsx` *(pequeno ajuste)*

Já expõe `callStatus`, `currentCallDealId`, `openQualificationModal`. Apenas garantir que o evento `disconnect` continua disparando `setCallStatus('completed')` — **não** precisa mexer.

### 7. `src/components/layout/MainLayout.tsx` *(editar)*

Envolver o app com `<AutoDialerProvider>` e renderizar `<AutoDialerInCallBanner />` global.

---

## 🔄 Fluxo de integração com qualificação existente

O `useCallQualificationTrigger` já abre o modal automaticamente quando `callStatus` vira `in-progress`. Vamos **manter** esse comportamento e **adicionar**:

- Ao **fechar** o modal de qualificação (`closeQualificationModal`), o `AutoDialerContext` detecta a transição via efeito e chama `resume()` automaticamente se `state === 'paused-qualifying'`.

Resultado: o SDR não precisa clicar em "próximo lead" — basta qualificar e o sistema dispara o próximo.

---

## 📊 Persistência de tentativas

Cada ligação não atendida grava em `deal_activities`:
```ts
{
  deal_id, activity_type: 'call_result',
  description: 'Tentativa automática — não atendeu',
  metadata: { result: 'nao_atendeu', auto_dialer: true, attempt_n: X }
}
```
Isso já alimenta o `callAttempts` no `useSelectedDeal` (que conta `nao_atendeu`).

---

## 🎯 Critérios de aceitação

- [ ] SDR carrega fila de 10 leads e clica "Iniciar".
- [ ] Sistema disca o lead 1; após 25s sem atender, registra "nao_atendeu" e disca o lead 2 automaticamente.
- [ ] Quando o lead 5 atende: toca som, banner aparece, fila pausa.
- [ ] SDR conduz a ligação. Ao encerrar, modal de qualificação abre.
- [ ] SDR preenche qualificação e fecha → fila retoma automaticamente no lead 6.
- [ ] Botão "Pausar" interrompe após a ligação atual; "Parar" limpa a fila.
- [ ] Histórico de cada tentativa fica registrado em `deal_activities`.
- [ ] Funciona em qualquer página (provider está no MainLayout).

---

## 🛡️ Salvaguardas

- **Bloqueio anti-duplicidade**: se já existe `currentCall` ativo, não inicia próximo.
- **Limite de fila**: máximo 100 leads por sessão para evitar uso abusivo.
- **Som de alerta** opt-in: persiste em `localStorage('autoDialerSound')` (default ON).
- **Confirmação ao Parar** se houver leads não chamados restantes.

---

## 📁 Arquivos

**Criar:**
- `src/contexts/AutoDialerContext.tsx`
- `src/hooks/useAutoDialerController.ts`
- `src/components/sdr/AutoDialerPanel.tsx`
- `src/components/sdr/AutoDialerInCallBanner.tsx`
- `public/sounds/answer-alert.mp3` (placeholder; usaremos Web Audio beep se não houver arquivo)

**Editar:**
- `src/components/crm/QuickDialer.tsx` (adicionar entrada para o modo auto)
- `src/components/crm/QuickDialerLauncher.tsx` (atalho extra `Ctrl+Shift+A` para abrir auto-dialer)
- `src/components/layout/MainLayout.tsx` (provider + banner global)

**Sem mudanças no banco** — usa `deal_activities` e `calls` que já existem.

---

Posso seguir com a implementação?
