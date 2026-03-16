

## Copiar leads do Kanban com opções de formato

### Problema atual
O botão de copiar no header de cada coluna do Kanban copia apenas `Nome - Telefone`. O SDR precisa de mais opções para diferentes contextos de trabalho.

### Solução

Substituir o botão simples por um **DropdownMenu** com as seguintes opções de cópia:

| Opção | Formato |
|-------|---------|
| Só telefone | `(11) 99999-0000` |
| Nome + Telefone | `João Silva - (11) 99999-0000` (atual) |
| Nome + Telefone + Email | `João Silva - (11) 99999-0000 - joao@email.com` |
| Completo (tabulado) | `Nome \t Telefone \t Email \t Stage \t Data entrada \t Ligações` |
| Personalizado | Abre dialog com checkboxes para o SDR escolher quais campos incluir |

Campos disponíveis no personalizado: Nome, Telefone, Email, Stage, Data de entrada, Nº ligações, Tentativas, Responsável (owner), Origem, Canal (LIVE/A010/BIO), Tags.

### Arquivos

**Editar `src/components/crm/DealKanbanBoard.tsx`** (linhas 274-298)
- Substituir o `<Button>` por um `<DropdownMenu>` com as opções de cópia
- Extrair lógica de formatação para uma função helper
- Usar `activitySummary` para dados de ligações/tentativas

**Criar `src/components/crm/CopyLeadsFormatDialog.tsx`**
- Dialog com checkboxes para escolha personalizada de campos
- Preview do formato antes de copiar
- Separador configurável (nova linha, tabulação, vírgula)

### Dados disponíveis nos deals

Cada `deal` no stageDeals já contém:
- `crm_contacts.name`, `.phone`, `.email`
- `deal.created_at` (data de entrada)
- `deal.owner_id` (responsável)
- `deal.crm_origins?.name` (origem)
- `activitySummary?.total_calls`, `.total_attempts` (ligações)
- `salesChannel` (canal)
- `deal.tags`
- Stage name vem do loop (`stage.stage_name`)

Todos os dados necessários já estão carregados no cliente.

