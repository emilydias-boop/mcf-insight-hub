
# Discador Rápido (Quick Dialer) — estilo celular

Adicionar um discador global, acessível de qualquer tela do CRM, onde o SDR/Closer digita um número e:
1. O sistema **identifica o lead automaticamente** (se existir) — mostrando nome, BU, último estágio, dono.
2. Permite **ligar imediatamente** via Twilio, com vínculo correto ao deal/contato (sem perder métricas).
3. Suporta também digitação livre para números que ainda não existem no CRM.

---

## 1. Componente novo: `src/components/crm/QuickDialer.tsx`

UI tipo celular:
- **Display do número** com máscara automática brasileira (`(11) 9 9999-9999`).
- **Teclado numérico 3x4** (1-9, *, 0, #) com clique para digitar — também aceita teclado físico.
- **Botão Backspace** para apagar dígito.
- **Botão verde grande "Ligar"** (ícone Phone).
- **Card de "Lead identificado"** que aparece em tempo real conforme o usuário digita (debounce 400ms, dispara busca a partir de 8 dígitos):
  - Nome do contato, e-mail, telefone formatado.
  - Pipeline atual + estágio + BU.
  - SDR/Closer responsável.
  - Última atividade (opcional).
  - Botão "Abrir no CRM" → navega para `/crm/negocios?dealId=...`.
- Se **nenhum lead** for encontrado: mostra "Número não cadastrado — ligação será registrada como avulsa".
- Se **múltiplos** leads (mesmo telefone em pipelines diferentes): lista compacta com escolha; o usuário seleciona qual deal vincular antes de ligar.

Layout: dialog/modal (`Dialog` do shadcn), 380px, centralizado. Tema dark consistente com o app.

---

## 2. Hook novo: `src/hooks/useLeadLookupByPhone.ts`

`useLeadLookupByPhone(phoneDigits: string)` — React Query.

- Normaliza para os **últimos 9 dígitos** (padrão de deduplicação já existente no projeto — vide `mem://business-logic/crm-manual-entry-deduplication-standard`).
- Busca em `crm_contacts` via `ilike` no campo phone (sufixo de 9 dígitos).
- Para cada contato encontrado, faz join leve com `crm_deals` (último deal por `created_at`) trazendo: `id`, `name`, `pipeline_id` (+ nome via lookup ou já carregado), `stage`, `owner_id`.
- Inclui também busca em `hubla_transactions.customer_phone` como fallback (já é padrão usado em `phoneUtils.ts → findPhoneByEmail` na direção inversa).
- `enabled: phoneDigits.replace(/\D/g,'').length >= 8`, `staleTime: 30s`.
- Retorna `LeadMatch[]` com `{ contactId, contactName, email, phone, deals: [{ id, name, pipeline, stage, ownerEmail, bu }] }`.

---

## 3. Integração com Twilio existente

Reaproveita 100% o `useTwilio()` já implementado:
- Usa `normalizePhoneNumber()` de `src/lib/phoneUtils.ts` antes de chamar.
- Chama `makeCall(normalized, dealId?, contactId?, originId?)`:
  - Se lead identificado e usuário escolheu um deal → passa `dealId` + `contactId` + `originId` (do pipeline) — métricas, gravação e qualificação ficam corretas.
  - Se número avulso → passa só `phoneNumber` (já suportado pelo `makeCall`).
- Antes de ligar, garante `deviceStatus === 'ready'`; caso contrário chama `initializeDevice()` com toast "Inicializando Twilio...".
- Após `makeCall`, fecha o discador — o `TwilioSoftphone` flutuante e os controles inline já cuidam do resto (mute, hangup, qualificação, post-call modal).

---

## 4. Acesso global — onde abrir o discador

Adicionar **botão flutuante de telefone** sempre visível para usuários com permissão (mesma regra do `TwilioSoftphone`: `deviceStatus !== 'disconnected'`):

- **Arquivo**: `src/components/layout/MainLayout.tsx` (já hospeda o `TwilioSoftphone`).
- Botão circular azul/verde no canto inferior esquerdo (oposto ao softphone que fica à direita) com ícone `Phone`.
- Ao clicar → abre o `<QuickDialer />` modal.
- **Atalho de teclado**: `Ctrl/Cmd + Shift + D` para abrir/fechar — registrado em um `useEffect` global no `MainLayout`.
- Não renderizar para roles que não usam telefonia (manter consistência com o softphone atual).

---

## 5. Fluxo de UX final

1. Usuário aperta `Ctrl+Shift+D` ou clica no botão flutuante → abre o discador.
2. Digita `11987654321` → após 8 dígitos, card "João Silva — Lead Instagram — SDR Maria" aparece.
3. Clica "Ligar" → Twilio disca, modal fecha, softphone flutuante aparece com timer.
4. Ao final, o `PostCallModal` e o `QualificationModal` abrem normalmente (já vinculados ao deal correto).
5. Se quiser, clica "Abrir no CRM" para ir direto ao deal antes de ligar.

---

## 6. Arquivos a criar / editar

**Criar:**
- `src/components/crm/QuickDialer.tsx` — UI do discador.
- `src/components/crm/QuickDialerLauncher.tsx` — botão flutuante + atalho de teclado + estado open/close.
- `src/hooks/useLeadLookupByPhone.ts` — busca de leads por telefone.

**Editar:**
- `src/components/layout/MainLayout.tsx` — montar o `<QuickDialerLauncher />` ao lado do `<TwilioSoftphone />`.

Sem migrations de banco. Sem novas edge functions. 100% client-side reaproveitando `TwilioContext` existente.

---

## 7. Validação pós-implementação

- Digitar número de lead conhecido → deve identificar e mostrar pipeline/SDR.
- Ligar a partir do discador → ligação deve aparecer na aba "Calls" do deal correto.
- Ligar para número desconhecido → deve criar `calls` row sem `deal_id`, sem quebrar.
- Atalho `Ctrl+Shift+D` deve funcionar em qualquer rota do CRM.
- No mobile (viewport <768px), modal deve ocupar tela cheia e teclado numérico ser tocável.

