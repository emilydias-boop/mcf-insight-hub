## Objetivo

Tornar a nota de qualificação **obrigatória** no card do lead, no formato de **questionário fixo** (6 perguntas, mín. 15 caracteres por resposta), com duas vias de captura:

1. **Por Ligação** — a nota é satisfeita automaticamente pelo `ai_call_summary` (Resumo IA já existente em `deal_activities`). SDR não precisa preencher nada extra.
2. **Por WhatsApp** — SDR marca um checkbox "Qualificação via WhatsApp", responde o questionário **e** anexa o print da conversa (obrigatório).

A regra trava o avanço do lead (botões de qualificar / agendar R1) até que **uma das duas condições** esteja satisfeita.

---

## Comportamento

### Regra de obrigatoriedade
Um lead é considerado "qualificado" se:
- Existe um `deal_activity` do tipo `ai_call_summary` para o `deal_id` (qualificação por ligação — IA já preencheu), **OU**
- Existe um `qualification_note` (novo formato questionário) com as 6 respostas válidas (≥15 chars cada) **e** o anexo `whatsapp_print_url` quando o canal escolhido for WhatsApp.

Enquanto nenhuma condição for satisfeita: botão "Qualificar / Agendar R1" fica desabilitado com tooltip explicando o motivo.

### Questionário (novo formato)
Substitui o formulário atual em `QualificationAndScheduleModal` / `R2QualificationTab` apenas para a captura manual (WhatsApp). Perguntas, todas obrigatórias com mínimo 15 caracteres:

1. Há quanto tempo o lead conhece a MCF?
2. Qual a profissão do lead?
3. Possui algum sócio?
4. Qual a renda estimada do lead?
5. O lead já constrói para venda?
6. O lead possui terreno ou imóvel (casa ou apartamento)?

Cada pergunta usa `Textarea` com contador `X/15` em tempo real. O botão "Salvar Qualificação" só habilita quando todas as 6 respostas têm ≥15 caracteres e (se WhatsApp) o arquivo está anexado.

### Tipo de contato
Radio/checkbox no topo do questionário:
- **Ligação** (default) — esconde o questionário manual e mostra um aviso "Aguardando resumo da IA após a ligação" / "Resumo IA já capturado ✓" conforme `ai_call_summary` existir.
- **WhatsApp** — exibe o questionário + uploader de print (PNG/JPG, ≤5 MB).

### Anexo do print (WhatsApp)
- Upload para bucket público `qualification-attachments` (novo, ou reaproveitar `deal-attachments` se existir).
- URL salva em `deal_activities.metadata.whatsapp_print_url` da nota de qualificação.
- Preview clicável na timeline / aba Notas.

---

## Mudanças técnicas

### Banco (migração)
- **Bucket de storage**: criar `qualification-attachments` (público, leitura aberta; insert restrito a `authenticated`).
- Nenhuma alteração de schema: reutilizamos `deal_activities` com `activity_type='qualification_note'` e gravamos no `metadata`:
  ```json
  { "channel": "whatsapp" | "call",
    "answers": { "tempo_mcf": "...", "profissao": "...", "socio": "...", "renda": "...", "constroi_venda": "...", "terreno_imovel": "..." },
    "whatsapp_print_url": "https://...",
    "sdr_name": "..." }
  ```

### Frontend
- **Novo**: `src/components/crm/qualification/QualificationQuestionnaire.tsx` — 6 textareas com validação de 15 chars + barra de progresso.
- **Novo**: `src/components/crm/qualification/ContactTypeSelector.tsx` — radio Ligação/WhatsApp + status do resumo IA.
- **Novo**: `src/components/crm/qualification/WhatsappPrintUploader.tsx` — upload via Supabase Storage com preview.
- **Editar** `src/components/crm/QualificationAndScheduleModal.tsx`: substituir o formulário antigo pelo `ContactTypeSelector` + `QualificationQuestionnaire` (quando WhatsApp). Bloquear submit enquanto inválido.
- **Editar** `src/hooks/useQualificationNote.ts`: aceitar novo payload `{ channel, answers, whatsappPrintUrl }`, validar server-side (no próprio hook + RLS já existe) e gravar em `metadata`.
- **Novo hook**: `src/hooks/useQualificationStatus.ts` — retorna `{ isQualified, reason, source: 'ai_call_summary' | 'whatsapp' | null }` consultando `deal_activities`.
- **Editar** componentes que disparam "Qualificar/Agendar R1" no card (`DealDetailsDrawer.tsx`, `R2QualificationTab.tsx`): usar `useQualificationStatus` para desabilitar botão + tooltip.
- **Editar** `DealNotesTab.tsx`: renderizar o novo formato (perguntas/respostas + miniatura do print) quando `metadata.answers` existir.

### Constantes
Adicionar `QUALIFICATION_QUESTIONS` em `src/components/crm/qualification/QualificationFields.tsx` (ou novo `QualificationQuestions.ts`) com as 6 perguntas e `MIN_ANSWER_LENGTH = 15`.

---

## Validação

1. Lead novo sem ligação nem nota → botão Qualificar desabilitado, tooltip "Faça uma ligação ou registre qualificação via WhatsApp".
2. Ligação real (>120s) cria `ai_call_summary` → botão habilita automaticamente, sem questionário manual.
3. Marcar "WhatsApp", preencher 5 perguntas + 1 com 10 chars → submit desabilitado e contador vermelho na pergunta inválida.
4. Preencher tudo + anexar print → submit habilita, salva em `deal_activities`, aparece na aba Notas com miniatura do print.
5. Submit sem print no modo WhatsApp → bloqueado com mensagem.

---

## Pontos abertos

- **Já existe bucket de anexos no projeto?** Posso reaproveitar ou crio `qualification-attachments` novo (público leitura, insert por `authenticated`)?
- **Tamanho mín. 15 chars** se aplica também à pergunta "Possui algum sócio?" (resposta natural seria "Não") — devo aceitar resposta curta + justificativa, ou manter 15 chars rígido para todas?
- Manter os campos antigos (`profissao`, `renda`, etc. em `custom_fields`) para retrocompatibilidade, ou migrar para `metadata.answers` e remover os antigos do formulário?