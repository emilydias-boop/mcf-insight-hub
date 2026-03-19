

## Plano: Auditoria de Mudanças de Status + Alertas para Gestores

### O que será feito

Toda mudança de status em reuniões (invited→completed, no_show→completed, completed→no_show, etc.) já está registrada em `audit_logs`. Vamos criar:

1. **Aba "Mudanças de Status"** na página de Auditoria — mostrando TODAS as mudanças de status (não apenas reversões suspeitas), com destaque visual para as suspeitas
2. **Alertas automáticos** para gestores da BU quando uma mudança suspeita ocorre (ex: no_show→completed)

### Detalhes

**Hook `useStatusChangeAudit.ts`:**
- Query `audit_logs` com joins para `meeting_slot_attendees` → `meeting_slots` → `closers` (BU) e `profiles` (quem alterou)
- Filtra por BU ativa via `useActiveBU`
- Parâmetros: período (7/30/90 dias), closer_id, tipo de mudança
- Classifica cada mudança como "suspeita" ou "normal":
  - Suspeita: `no_show→completed`, `completed→no_show`, `completed→invited`, `no_show→invited`
  - Normal: `invited→completed`, `invited→no_show`, etc.

**Componente `StatusChangesTab.tsx`:**
- Cards resumo: Total de mudanças, Suspeitas, No-show→Realizada, Realizada→No-show
- Tabela com colunas: Lead | Tipo (R1/R2) | Closer | De → Para | Alterado por | Data/Hora da reunião | Data/Hora da alteração
- Badge vermelho para mudanças suspeitas, cinza para normais
- Filtros: período, closer, apenas suspeitas

**Página `AuditoriaAgendamentos.tsx`:**
- Adicionar Tabs com "Duplicatas" e "Mudanças de Status"
- Título atualizado para "Auditoria"

**DB Trigger `notify_suspicious_status_change`:**
- Trigger em `audit_logs` (AFTER INSERT) que detecta mudanças suspeitas de status
- Insere alerta na tabela `alertas` para todos os profiles com role admin/manager/coordenador que tenham a BU do closer no seu squad
- O alerta inclui: nome do lead, closer, status anterior/novo, data da reunião, quem alterou

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useStatusChangeAudit.ts` | Criar — hook React Query |
| `src/components/audit/StatusChangesTab.tsx` | Criar — tabela + cards |
| `src/pages/crm/AuditoriaAgendamentos.tsx` | Editar — adicionar tabs |
| SQL Migration | Trigger para alertas automáticos |

### Acesso

- A aba filtra automaticamente por BU do gestor
- Roles admin/manager/coordenador recebem alertas
- SDRs/closers veem apenas a aba se tiverem acesso à rota de auditoria

