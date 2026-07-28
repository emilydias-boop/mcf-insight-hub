## Objetivo

Permitir mover/replicar leads de uma BU para outra. Se o contato já existe na BU destino, atualiza campos relevantes e redistribui para SDR da BU destino (sem duplicar). O deal na BU de origem permanece intacto (mesmo comportamento de `process-deal-replication`).

## Fluxo de negócio

1. Usuário seleciona 1..N deals e escolhe **BU destino** + (opcional) SDR específico.
2. Para cada deal:
   - Localiza contato pela chave existente (`crm_contacts` via email normalizado / phone 9 dígitos).
   - Busca deal ativo (não arquivado) daquele contato num pipeline/origem da BU destino.
   - **Se existe** → atualiza no deal destino: `tags` (merge sem duplicar), `origem_lead`, última nota (append em `deal_activities`) e move para etapa "Novo Lead (Form)" da BU destino. Reatribui `owner_id`/`owner_profile_id` para SDR escolhido/sorteado.
   - **Se não existe** → cria novo deal na BU destino (stage inicial "Novo Lead (Form)"), copiando nome/contato/tags/origem_lead, já com `owner_profile_id` do SDR sorteado.
3. Registra `deal_activities` (tipo `bu_transfer`) no deal de origem e no destino, com metadata (bu_origem, bu_destino, sdr_destino, bulk).
4. Deal original permanece na BU de origem sem alterações.

## Distribuição SDR (BU destino)

- Padrão: **least-load round-robin** entre SDRs ativos daquela BU (mesma lógica de `pickConsorcioSdr` em `process-deal-replication`, generalizada por `bu_slug`).
- SDRs elegíveis: `user_roles.role='sdr'` + `profiles.access_status='ativo'` + squad/BU-mapping da BU destino.
- Se usuário selecionar SDR específico no diálogo, usa esse (bypass do round-robin).

## Pontos de acionamento (UI)

### 1. Aba CRM > Contatos (ação em massa)
- Reaproveita `BulkTransferDialog`: adiciona toggle "Transferir para outra BU" que troca o Select de usuário por Select de BU destino + Select opcional de SDR.
- Botão fica atrás da mesma flag `can_transfer_leads` (SDR/Closer) ou papéis privilegiados.

### 2. Kanban de Negócios (`/crm/negocios`)
- Novo botão **"Transferir para BU"** na barra de ações em massa do Kanban (junto de Mover Etapa/Pipeline).
- Abre novo diálogo `BulkBUTransferDialog` (compartilhado com Contatos): Select BU destino + Select SDR opcional + botão confirmar.
- Restrito a Admin/Manager/Coordenador (mesmas regras das outras ações em massa do Kanban).

## Arquitetura técnica

### Backend
- Nova edge function `transfer-deals-to-bu` (não usar RPC — precisa iterar/insert com service_role para respeitar RLS e disparar hooks corretamente).
  - Input: `{ deal_ids: string[], target_bu_slug: string, target_sdr_profile_id?: string, actor_id: string }`.
  - Para cada `deal_id`: resolve contato → busca deal destino ativo → update-or-insert → registra activity.
  - Reutiliza helpers de `process-deal-replication` (least-load SDR picker, dedupe por email/phone9).
  - Retorna `{ total, created, updated, skipped, failed, results: [...] }`.
- Nenhum schema novo obrigatório. Opcional: registrar em `deal_replication_logs` com `trigger='manual_bu_transfer'` para auditoria.

### Frontend
- Novo hook `useBUTransfer.ts` (chama a edge function, invalida `crm-deals` e `crm-contacts`).
- Novo componente `BulkBUTransferDialog.tsx` reutilizável (usado em Contatos e Kanban).
- Atualizar `BulkTransferDialog` (Contatos) para incluir toggle "Trocar dono" ↔ "Transferir para BU", ou expor botão adicional na toolbar. Preferência: **botão separado** para não sobrecarregar diálogo existente.
- Atualizar toolbar de ações em massa do Kanban de Negócios para incluir "Transferir para BU".

### Dedup / atualização de campos
- Chaves de match: `lower(email)` e/ou últimos 9 dígitos do telefone (padrão existente do projeto).
- Campos atualizados no deal destino existente:
  - `tags`: `array_cat` sem duplicatas.
  - `origem_lead`: sobrescreve se vier preenchida da origem.
  - Nota: append em `deal_activities` com o conteúdo da última nota da origem (não sobrescreve nada em `crm_deals`).
  - `stage_id`: move para etapa "Novo Lead (Form)" da BU destino.
  - `owner_id` / `owner_profile_id`: SDR escolhido/sorteado.
- **Não** altera: contract_paid_at, valores, histórico financeiro, meetings existentes.

## Permissões

- Admin / Manager / Coordenador: sempre podem.
- SDR / Closer: apenas se `profiles.can_transfer_leads = true` (mesma regra da transferência de dono atual). Aplicável só em Contatos (Kanban continua restrito).

## Auditoria

- `deal_activities` no deal origem e destino com `activity_type='bu_transfer'` e metadata: `{ from_bu, to_bu, target_sdr, bulk, actor, matched_existing }`.
- Aparece automaticamente na aba "Transferências de Leads" da auditoria (`LeadTransfersTab` já lê `deal_activities` de owner_change; ajustar filtro para incluir `bu_transfer`).

## Fora de escopo

- Sincronização contínua entre deals origem/destino (é one-shot).
- Merge automático de histórico de reuniões/ligações entre BUs.
- Regra automática (baseada em stage) — este plano é somente ação manual do usuário. As regras automáticas continuam em `deal_replication_rules`.
