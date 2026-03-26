

## Fase 2: Fale com o RH — Sistema de Tickets/Ocorrências

### Visão geral

Implementar a aba "Fale com o RH" como um sistema de tickets onde o colaborador pode abrir ocorrências, solicitações e sugestões, acompanhar status e receber respostas do RH.

### Nova tabela: `rh_tickets`

```sql
CREATE TABLE rh_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ocorrencia', 'solicitacao', 'sugestao')),
  assunto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'encaminhado' CHECK (status IN ('encaminhado', 'em_avaliacao', 'finalizado')),
  resposta_rh TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  anexo_url TEXT,
  anexo_storage_path TEXT,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_encerramento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rh_tickets ENABLE ROW LEVEL SECURITY;

-- Colaborador vê apenas seus próprios tickets
CREATE POLICY "Employee can view own tickets"
  ON rh_tickets FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

-- Colaborador pode criar tickets
CREATE POLICY "Employee can create own tickets"
  ON rh_tickets FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

-- Colaborador pode atualizar seus tickets (ex: adicionar info)
CREATE POLICY "Employee can update own tickets"
  ON rh_tickets FOR UPDATE TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));
```

### Arquivos novos

**`src/hooks/useRhTickets.ts`** — Hooks React Query:
- `useMyTickets(employeeId)` — lista tickets do colaborador ordenados por data
- `useCreateTicket()` — mutation para criar ticket (com upload opcional de anexo ao bucket `user-files`)
- `useUpdateTicket()` — mutation para o RH responder/alterar status

**`src/components/meu-rh/MeuRHFaleComRHSection.tsx`** — Componente principal da aba:
- Lista de tickets do colaborador com status colorido (encaminhado=amarelo, em avaliação=azul, finalizado=verde)
- Botão "Nova Solicitação" que abre modal
- Cada ticket expandível mostrando: tipo, assunto, descrição, anexo, status, resposta do RH, datas

**`src/components/meu-rh/NovoTicketModal.tsx`** — Modal de criação:
- Select: tipo (Ocorrência, Solicitação, Sugestão)
- Input: assunto
- Textarea: descrição
- File input: anexo opcional
- Botão enviar

### Arquivos editados

**`src/pages/MeuRH.tsx`**:
- Importar `MeuRHFaleComRHSection`
- Substituir o `PlaceholderTab` de "fale-rh" pelo componente real

**`src/types/hr.ts`**:
- Adicionar interface `RhTicket` e constantes de labels/cores para status

### Layout da aba

```text
┌─────────────────────────────────────────────────────┐
│ Fale com o RH                [+ Nova Solicitação]   │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🟡 Encaminhado · Solicitação                    │ │
│ │ "Ajuste no contrato de prestação"               │ │
│ │ Aberto em 20/03/2026                            │ │
│ │ ▼ Expandir detalhes                             │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🟢 Finalizado · Ocorrência                     │ │
│ │ "Erro no cálculo da NF de fevereiro"            │ │
│ │ Aberto em 15/02/2026 · Encerrado em 18/02/2026 │ │
│ │ Resposta do RH: "Corrigido e reprocessado..."   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Nenhum ticket? Mensagem vazia com CTA               │
└─────────────────────────────────────────────────────┘
```

### O que NÃO muda
- Nenhuma alteração nas abas existentes (Perfil, Documentos, Avaliações, Histórico)
- Quick Cards e Quick Actions permanecem iguais
- Abas PDI, Políticas e Comunicados continuam como placeholder

