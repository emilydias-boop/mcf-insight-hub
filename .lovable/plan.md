

## Plano: Corrigir abas de Configurações (Notificações, Segurança, Integrações)

### Problemas identificados

**1. Notificações** — Completamente não-funcional
- Os switches usam `defaultChecked` (uncontrolled) sem nenhum estado React
- O botão "Salvar Preferências" apenas mostra um toast genérico sem salvar nada no banco
- Nenhuma preferência de notificação é persistida

**2. Segurança** — Troca de senha funciona no código, mas a aba tem 2FA desabilitado sem funcionalidade real
- O código de `handleChangePassword` parece correto (usa `supabase.auth.updateUser`)
- Se está falhando silenciosamente, é porque o `catch` vazio na linha 83 engole o erro

**3. Integrações** — Completamente estático
- Lista hardcoded de "Manus", "Stripe", "SendGrid" com badges fixos
- Não reflete o estado real de nenhuma integração do sistema

---

### Correções propostas

| Aba | Arquivo | O que muda |
|-----|---------|-----------|
| Notificações | `src/pages/Configuracoes.tsx` | Conectar switches a estado controlado + persistir no Supabase via `dashboard_preferences` (campos `notify_email`, `notify_push`, `notify_sms`, `notify_critical`, `notify_daily_summary`) |
| Notificações | Migration SQL | Adicionar colunas de notificação na tabela `dashboard_preferences` |
| Segurança | `src/pages/Configuracoes.tsx` | Remover catch vazio para que erros de senha apareçam via toast do hook |
| Integrações | `src/pages/Configuracoes.tsx` | Mostrar integrações reais do sistema (Clint CRM, Twilio, Calendly) com status dinâmico baseado em verificação de conectividade |

### Detalhe: Notificações

Adicionar 5 colunas booleanas à tabela `dashboard_preferences`:
```sql
ALTER TABLE dashboard_preferences 
ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_push boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_critical boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_daily_summary boolean DEFAULT true;
```

Os switches passarão a ser controlados, lendo do banco e salvando via mutation.

### Detalhe: Segurança

Remover o `catch {}` vazio para que o `onError` do hook `useUpdateMyPassword` (que já tem `toast.error`) funcione corretamente.

### Detalhe: Integrações

Substituir a lista estática por verificações reais:
- **Clint CRM**: Verificar se existe `clint_api_key` nos secrets (ou se sync-deals está rodando)
- **Twilio**: Verificar se existe configuração em `automation_settings` ou secret do Twilio
- **Calendly**: Verificar se closers têm `calendly_link` preenchido

Cada integração mostrará status dinâmico baseado em dados reais.

### Resultado esperado
- Notificações salvam e carregam preferências reais do banco
- Erros de senha aparecem com toast visível
- Integrações mostram status real das conexões do sistema

