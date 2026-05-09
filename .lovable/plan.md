## Como saber em qual BU cada mensagem opera

Hoje a tabela `automation_templates` **não tem campo de BU** — qualquer template aparece para qualquer fluxo, em qualquer BU. Já a tabela `automation_flows` tem `origin_id` (pipeline), e cada pipeline pertence a uma BU via `BU_PIPELINE_MAP` (ver `NegociosAccessGuard.tsx`).

Ou seja, hoje a BU só é definida **indiretamente, no fluxo** (via pipeline). O template em si é "global". Isso é ruim para WhatsApp Business, porque cada BU tem tom de voz, assinatura e até números remetentes diferentes — e a Meta aprova o conteúdo, não o uso.

## Proposta

Adicionar **escopo de BU explícito no template**, com 3 modos:

1. **Global** (padrão) — template disponível para fluxos de qualquer BU. Útil para mensagens utilitárias genéricas (ex: "Sua reunião foi confirmada").
2. **Específico de uma BU** — só aparece em fluxos cuja pipeline pertence àquela BU (ex: template "Boas-vindas Consórcio" só nas pipelines de Consórcio).
3. **Multi-BU** — lista de BUs permitidas (ex: Incorporador + Crédito).

### Mudanças

**Banco** (migration nova):
- `automation_templates.business_units text[] null` — array de BUs permitidas. `null` ou `[]` = Global.
- Index GIN para filtro rápido.

**Backend / Hooks:**
- `useAutomationTemplates`: aceitar `business_units`, filtrar por BU ativa quando o seletor pedir.
- Em `StepEditorDialog`, ao listar templates, filtrar por BU do fluxo (derivada do `origin_id` via `BU_PIPELINE_MAP`). Mostrar "Global" + "Da BU X" agrupados.

**UI — `TemplateEditorDialog`:**
- Novo campo "Business Unit" com:
  - Radio: `Global` / `Específico`
  - Se Específico: multi-select com as 6 BUs (`incorporador`, `consorcio`, `credito`, `projetos`, `leilao`, `marketing`).
- Validação: se Submeter à Meta com BU específica, copiar a BU pro nome interno (sugestão: `bu_consorcio_boas_vindas`) — ajuda a achar na Twilio.

**UI — `TemplateList` (`/admin/automacoes` aba Templates):**
- Filtro no topo: dropdown "BU" com opções (Todas / Global / Incorporador / Consórcio / ...).
- Badge no card mostrando "Global" ou as BUs (chips coloridos).
- Para usuários **não-admin**, filtrar automaticamente pela BU ativa do usuário (via `useActiveBU`) e esconder os de outras BUs.

### O que isso resolve

- Operador da BU Consórcio só vê templates dela ao montar fluxos — sem risco de pegar template de Incorporador por engano.
- Admin vê tudo, mas com filtro claro.
- Permite no futuro ter **número de WhatsApp por BU** (cada BU usa um Messaging Service Twilio diferente) sem quebrar o que já existe.

### Fora do escopo

- Não muda número remetente Twilio agora — só o vínculo lógico. Se você quiser também escolher o `messaging_service_sid` por BU, é uma onda separada (envolve config de senders).
- Não toca em `automation_flows` — ele continua amarrado pelo `origin_id`.

### Pergunta antes de implementar

Você quer que **eu já force**, para usuário não-admin, ver só templates da BU dele, ou prefere deixar **só como filtro visual** e qualquer pessoa poder usar qualquer template?
