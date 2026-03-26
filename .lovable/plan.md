

## Limpeza completa: WhatsApp/Conversations + código morto

### Frontend — Remover

| Arquivo/Pasta | Motivo |
|---------------|--------|
| `src/components/conversations/` (10 arquivos) | Feature desativada, widget `false` |
| `src/contexts/ConversationsContext.tsx` | Só usado pelo conversations |
| `src/hooks/useConversations.ts` | Só usado pelo conversations |
| `src/hooks/useWhatsAppConversations.ts` | Só usado pelo ConversationsContext |
| `src/hooks/useWhatsAppInstance.ts` | Só usado pelo WhatsAppConfigCard |
| `src/types/conversations.ts` | Tipos do conversations |
| `src/data/mockConversations.ts` | Dados mock do conversations |
| `src/components/whatsapp/WhatsAppConfigCard.tsx` | Config Z-API — sem conversations não serve |
| `src/hooks/useAppearancePreferences.ts` | Zero importadores |
| `src/hooks/useMetricasTemplate.ts` | Zero importadores |
| `src/data/mockData.ts` | Mover tipo `SemanaMes` para inline em `ResumoFinanceiro.tsx` e deletar |
| `src/pages/crm/Atendimentos.tsx` | Página morta |

### Frontend — Editar

| Arquivo | Mudança |
|---------|---------|
| `MainLayout.tsx` | Remover `ConversationsProvider`, imports de `ConversationsFloatingWidget`/`ConversationsDrawer`, flag `ENABLE_CONVERSATIONS_WIDGET` |
| `App.tsx` | Remover import e rotas `atendimentos` (2 ocorrências) |
| `Configuracoes.tsx` | Remover import e uso de `WhatsAppConfigCard` |
| `AgendaMeetingDrawer.tsx` | Remover import de `useConversationsContext`, a função `handleWhatsApp` que navega para atendimentos, e a desestruturação de `findOrCreateConversationByPhone`/`selectConversation`. Manter o botão WhatsApp mas abrir `wa.me` direto |
| `ResumoFinanceiro.tsx` | Definir `SemanaMes` inline em vez de importar de `mockData.ts` |

### Edge Functions — Remover

| Função | Motivo |
|--------|--------|
| `zapi-send-message/` | Só usado pelo conversations e MeetingLinkShare (que é do conversations) |
| `zapi-status/` | Só usado pelo WhatsAppConfigCard (removido) |
| `zapi-webhook/` | Callback externo sem frontend — sem conversations não serve |
| `notify-new-lead/` | Zero chamadores, lista hardcoded de SDRs, código morto |

### Edge Functions — Manter

| Função | Motivo |
|--------|--------|
| `twilio-whatsapp-send/` | Usado pelo `automation-processor` |
| `twilio-whatsapp-webhook/` | Callback Twilio ativo |

### O que NÃO será removido

- `src/lib/whatsappTemplates.ts` — usado pelo `QuickActionsBlock` para abrir `wa.me` (funcionalidade ativa do CRM)
- `src/components/crm/MeetingLinkShare.tsx` — será removido pois só é usado pelo `CloserScheduler.tsx` (conversations)
- Edge functions Twilio — usadas pelo automation-processor

### config.toml — Limpar entradas

Remover blocos: `zapi-send-message`, `zapi-status`, `zapi-webhook`, `notify-new-lead`

### Resumo de impacto

- ~20 arquivos removidos (~1500+ linhas de código morto)
- 4 edge functions removidas
- Zero impacto funcional — nada disso está visível ou acessível ao usuário
- O botão WhatsApp no CRM (que abre `wa.me`) continua funcionando normalmente

