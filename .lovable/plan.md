
# Pipeline Pos-Reuniao - CRM Consorcio

## Resumo
Criar uma nova aba **"Pos-Reuniao"** dentro do CRM do Consorcio (`/consorcio/crm/pos-reuniao`) com 3 sub-abas internas para gerenciar o fluxo apos reunioes realizadas, com integracao direta ao cadastro de cartas de consorcio.

## Fluxo do lead

```text
R1 Realizada (Agenda)
    |
    v
[Pos-Reuniao - Aba "Realizadas"]
    |
    ├── Aceita proposta? SIM
    |       |
    |       v
    |   [Aba "Propostas"]
    |   (Registrar detalhes da proposta)
    |       |
    |       ├── Aceite confirmado + docs enviados
    |       |       v
    |       |   [Botao: Cadastrar Cota]
    |       |   (Abre o ConsorcioCardForm pre-preenchido)
    |       |   Deal -> stage "CONTRATO PAGO" / "VENDA REALIZADA"
    |       |
    |       └── Proposta recusada depois
    |               v
    |           [Aba "Sem Sucesso"]
    |
    └── Aceita proposta? NAO
            |
            v
        [Aba "Sem Sucesso"]
        Deal -> nova stage "SEM SUCESSO"
        (Lista para retomar contato futuro)
```

## O que sera construido

### 1. Nova stage no banco de dados
- Criar stage **"SEM SUCESSO"** nas duas pipelines do Consorcio:
  - `4e2b810a-...` (Viver de Aluguel) - apos "PROPOSTA ENVIADA" (order 10)
  - `66681033-...` (Efeito Alavanca + Clube) - apos "NAO QUER - SEM INTERESSE" (order 24)

### 2. Nova tabela `consorcio_proposals`
Armazenar dados da proposta vinculada ao deal:
- `id` (uuid, PK)
- `deal_id` (uuid, FK -> crm_deals)
- `created_by` (uuid, FK -> profiles)
- `proposal_date` (date)
- `proposal_details` (text) - descricao da proposta
- `valor_credito` (numeric) - valor proposto
- `prazo_meses` (integer)
- `tipo_produto` (text) - select/parcelinha
- `status` (text) - 'pendente', 'aceita', 'recusada'
- `aceite_date` (date, nullable)
- `motivo_recusa` (text, nullable)
- `consortium_card_id` (uuid, nullable, FK -> consortium_cards)
- `created_at`, `updated_at`

### 3. Nova aba no CRM Consorcio
**Arquivo:** `src/pages/crm/PosReuniao.tsx`

Pagina com 3 sub-abas (Tabs do Radix):

#### Sub-aba "Realizadas"
- Lista reunioes com status `completed` dos closers do Consorcio
- Cada linha mostra: nome, telefone, closer, data da reuniao, pipeline
- Botoes de acao: **"Enviar Proposta"** e **"Sem Sucesso"**
- "Enviar Proposta" abre modal para preencher dados da proposta e move deal para stage "PROPOSTA ENVIADA"
- "Sem Sucesso" abre modal com campo de motivo e move deal para stage "SEM SUCESSO"

#### Sub-aba "Propostas"
- Lista de deals com propostas pendentes/aceitas
- Cada linha mostra: nome, proposta, valor, status
- Botoes: **"Aceite Confirmado"** (marca aceita + abre ConsorcioCardForm pre-preenchido com dados do deal/proposta) e **"Recusada"** (move para Sem Sucesso)

#### Sub-aba "Sem Sucesso"
- Lista de todos os deals na stage "SEM SUCESSO"
- Opcao de **"Retomar Contato"** (volta deal para stage anterior)
- Exibe motivo da recusa e data

### 4. Rota e navegacao
- Adicionar rota `/consorcio/crm/pos-reuniao` no App.tsx
- Adicionar aba "Pos-Reuniao" no `BUCRMLayout.tsx` (apenas para BU consorcio)
- Icone sugerido: `ClipboardCheck` do Lucide

## Secao tecnica

### Arquivos a criar
1. **`src/pages/crm/PosReuniao.tsx`** - Pagina principal com as 3 sub-abas
2. **`src/hooks/useConsorcioPostMeeting.ts`** - Hook para buscar reunioes realizadas, propostas e deals sem sucesso
3. **`src/components/consorcio/ProposalModal.tsx`** - Modal para registrar proposta
4. **`src/components/consorcio/SemSucessoModal.tsx`** - Modal para marcar sem sucesso

### Arquivos a modificar
1. **`src/App.tsx`** (~linha 208) - Adicionar rota `pos-reuniao`
2. **`src/pages/crm/BUCRMLayout.tsx`** (~linhas 27-29) - Adicionar 'pos-reuniao' ao array de tabs visiveis do consorcio e adicionar nav item

### Migration SQL
```text
-- 1. Criar stages "SEM SUCESSO" nas pipelines
INSERT INTO crm_stages (id, stage_name, stage_order, origin_id, color, clint_id)
VALUES
  (gen_random_uuid(), 'SEM SUCESSO', 10, '4e2b810a-...', '#ef4444', 'sem-sucesso-vda'),
  (gen_random_uuid(), 'SEM SUCESSO', 25, '66681033-...', '#ef4444', 'sem-sucesso-ea');

-- 2. Criar tabela consorcio_proposals
CREATE TABLE consorcio_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  proposal_date date DEFAULT CURRENT_DATE,
  proposal_details text,
  valor_credito numeric,
  prazo_meses integer,
  tipo_produto text,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
  aceite_date date,
  motivo_recusa text,
  consortium_card_id uuid REFERENCES consortium_cards(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE consorcio_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proposals"
  ON consorcio_proposals FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
```

### Hook `useConsorcioPostMeeting`
- **Reunioes realizadas:** Query `meeting_slot_attendees` com status `completed`, join closers com `bu = 'consorcio'`, filtrar por data
- **Propostas:** Query `consorcio_proposals` com status pendente/aceita, join deal + contact
- **Sem sucesso:** Query `crm_deals` na stage "SEM SUCESSO" das pipelines do consorcio

### Integracao com ConsorcioCardForm
Ao clicar "Aceite Confirmado" na aba Propostas:
- Abrir `ConsorcioCardForm` com dados pre-preenchidos do deal e proposta (nome, valor_credito, prazo_meses, tipo_produto)
- Ao salvar a cota, atualizar `consorcio_proposals.consortium_card_id` e mover deal para "CONTRATO PAGO" ou "VENDA REALIZADA"
