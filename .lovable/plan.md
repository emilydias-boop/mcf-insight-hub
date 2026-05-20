# Painel de Status da Automação em tempo real

Adicionar bloco visual destacado no topo da página **Admin › Automações** (`/admin/automacoes`) com a saúde do pipeline em tempo real.

## O que aparece

3 cards grandes + ticker de atividade:

```text
┌──────────────┬──────────────┬──────────────┐
│ PENDENTES    │ CONCLUÍDOS   │ COM ERRO     │
│   42         │   1.287      │   3          │
│ na fila      │ hoje         │ últimas 24h  │
│ ● live       │              │ ⚠ atenção    │
└──────────────┴──────────────┴──────────────┘
┌─────────────────────────────────────────────┐
│ Últimas atividades (auto-atualiza)          │
│ ✓ 09:42 WhatsApp → ANTONIO MATHEUS (sent)   │
│ ⏳ 09:41 Email → ... (pending)              │
│ ✗ 09:40 WhatsApp → ... (failed: timeout)    │
└─────────────────────────────────────────────┘
```

- **Pendentes**: `automation_queue.status = 'pending'` + `automation_logs.status = 'pending'`.
- **Concluídos (hoje)**: `automation_logs.status IN (sent, delivered, read)` no dia atual.
- **Com erro (24h)**: `automation_logs.status = 'failed'` nas últimas 24h, com tooltip do último `error_message`.
- **Ticker**: últimos 8 registros de `automation_logs` (ícone por status, canal, destinatário, hora relativa).

## Tempo real

- Inscrição em `automation_logs` e `automation_queue` via `supabase.channel(...).on('postgres_changes', ...)`.
- A cada evento → `queryClient.invalidateQueries` das chaves do painel.
- Indicador "● live" pulsa verde quando o canal está conectado, cinza quando offline.
- Fallback de polling a cada 15s caso o realtime caia.

## Arquivos

- **Novo**: `src/components/automations/AutomationStatusPanel.tsx` — painel + hook interno de subscription.
- **Novo**: `src/hooks/useAutomationRealtime.ts` — gerencia canal Supabase + invalidações.
- **Editar**: `src/pages/admin/Automacoes.tsx` — renderiza `<AutomationStatusPanel />` acima de `<AutomationMetrics />` (mantém os existentes).
- Reaproveita tokens semânticos (`bg-card`, `text-destructive`, `text-success`/`text-green-600` já em uso no projeto).

## Sem mudanças

- Nada de migration nova (tabelas e políticas já existem; admin já lê `automation_logs` e `automation_queue`).
- Nenhuma edge function alterada.
