

## Controle Diego - Relatório de Envio de Vídeo para Contratos Pagos

### Objetivo
Criar um novo tipo de relatório "Controle Diego" na BU Incorporador que replica a estrutura do relatório de Contratos, mas com foco em acompanhar o envio de vídeos para contratos pagos. Inclui: drawer de detalhes por lead, link direto para WhatsApp no telefone, e checkbox para marcar vídeo como enviado.

### O que será criado

**1. Tabela no banco (migration)**
- `contract_video_control`: armazena o status de envio do vídeo por contrato
  - `id` (uuid PK), `attendee_id` (ref meeting_slot_attendees), `video_sent` (boolean), `sent_at` (timestamptz), `sent_by` (uuid ref auth.users), `notes` (text), `created_at`, `updated_at`
  - RLS: authenticated pode SELECT/INSERT/UPDATE

**2. Novo tipo de relatório**
- Adicionar `'controle_diego'` ao `ReportType` em `ReportTypeSelector.tsx`
- Ícone: `Video` (lucide), título: "Controle Diego", subtítulo: "Contratos pagos - envio de vídeo"

**3. Componente `ControleDiegoPanel.tsx`**
- Reusa o mesmo hook `useContractReport` para buscar contratos pagos
- Filtros simplificados: Período, Buscar, Closer, Pipeline
- KPIs: Total de contratos, Vídeos enviados, Vídeos pendentes
- Tabela com colunas: Closer, Data, Lead, Telefone (clicável → WhatsApp), Pipeline, Status Vídeo (check)
- Cada linha clicável abre o drawer

**4. Componente `ControleDiegoDrawer.tsx`**
- Drawer lateral com detalhes do lead (nome, telefone, email, closer, SDR, data contrato, pipeline)
- Botão WhatsApp (abre `wa.me/55{phone}`)
- Toggle/checkbox para marcar vídeo como enviado (persiste no `contract_video_control`)
- Campo de observação opcional

**5. Hook `useVideoControl.ts`**
- Query: busca status de vídeo por `attendee_id`
- Mutation: upsert no `contract_video_control` (marca/desmarca vídeo enviado)

**6. Registrar na BU Incorporador**
- Adicionar `'controle_diego'` ao array `availableReports` em `src/pages/bu-incorporador/Relatorios.tsx`
- Adicionar renderização condicional no `BUReportCenter.tsx`

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_contract_video_control.sql` | Criar tabela + RLS |
| `src/hooks/useVideoControl.ts` | Novo hook (query + mutation) |
| `src/components/relatorios/ControleDiegoPanel.tsx` | Novo painel do relatório |
| `src/components/relatorios/ControleDiegoDrawer.tsx` | Novo drawer de detalhes |
| `src/components/relatorios/ReportTypeSelector.tsx` | Adicionar tipo `controle_diego` |
| `src/components/relatorios/BUReportCenter.tsx` | Renderizar `ControleDiegoPanel` |
| `src/pages/bu-incorporador/Relatorios.tsx` | Adicionar ao `availableReports` |

### Fluxo do usuário
1. Abre Relatórios → seleciona "Controle Diego"
2. Vê tabela de contratos pagos com coluna de status (pendente/enviado)
3. Clica no telefone → abre WhatsApp direto para enviar vídeo
4. Marca checkbox na tabela ou abre drawer → marca como enviado
5. KPIs atualizam em tempo real (enviados vs pendentes)

