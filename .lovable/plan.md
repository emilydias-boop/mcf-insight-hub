

## Plano: Drawer de Contato 360° — Visão completa do ecossistema

### Problema
O `ContactDetailsDrawer` atual é básico: mostra apenas nome, tags, deals simples e observações. O usuário quer uma visão 360° do contato com tudo: compras, jornada, timeline, ligações, como chegou, como foi tratado.

### Solução
Reescrever o `ContactDetailsDrawer` reutilizando componentes já existentes no `DealDetailsDrawer`, mas centrado no **contato** (agregando dados de todos os deals).

### Alterações

**`src/components/crm/ContactDetailsDrawer.tsx`** — Reescrita completa

**Header compacto:**
- Avatar com iniciais, nome, email, telefone
- Botões de ação rápida: WhatsApp, ligar, copiar telefone

**Seção 1 — Informações Gerais + Tags**
- Data de cadastro, organização, campos customizados
- Tags com cores

**Seção 2 — Negócios Relacionados (expandido)**
- Reutilizar `CrossPipelineHistory` adaptado ou listar todos os deals com:
  - Pipeline/Origin, Stage (com cor), Owner/SDR, datas
  - Botão para abrir `DealDetailsDrawer` de cada deal

**Seção 3 — Compras / Transações Hubla**
- Usar `useCustomerTransactions` (já existe) com o email do contato
- Listar todas as transações: produto, valor, data, status, source
- Totalizar investimento (reutilizar `useCustomerJourney`)
- Badge de parceiro se aplicável

**Seção 4 — Jornada do Lead**
- Usar `useLeadJourney` do deal mais recente para mostrar SDR → R1 → R2
- Usar `useA010Journey` para jornada A010

**Seção 5 — Abas (como no DealDetailsDrawer)**
- **Timeline**: `LeadFullTimeline` usando deal principal + contactId (já agrega cross-pipeline)
- **Ligações**: `CallHistorySection` com contactId
- **Notas**: `DealNotesTab` ou `ContactNotesSection` + notas de todos os deals
- **Observações**: `ContactNotesSection` existente (campo livre do contato)

**Componentes reutilizados (sem alteração):**
- `CrossPipelineHistory`
- `LeadFullTimeline`
- `CallHistorySection`
- `useCustomerTransactions` / `useCustomerJourney`
- `useLeadJourney`
- `useA010Journey`
- `ContactNotesSection`

**Novo componente auxiliar:**
- `ContactTransactionsSection` — lista de transações Hubla do contato com totais

### Fluxo
1. Drawer abre com `contactId`
2. Busca contato + todos os deals do contato
3. Identifica deal principal (mais recente com atividade)
4. Renderiza visão 360° com todas as seções
5. Cada deal relacionado pode abrir o `DealDetailsDrawer` específico

### Resultado
O drawer de contato se torna o hub central de informação: mostra tudo que o contato fez, pagou, como chegou, em que pipelines está, e todo o histórico de interações.

