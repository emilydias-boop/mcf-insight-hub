

## Plano: Corrigir email de NFSe do fechamento

### Problema

Quando o colaborador envia a NFSe pelo fechamento, **dois sistemas de email disparam simultaneamente**:

1. **`notifyDocumentAction`** (linha 216) — envia um email **simples** (apenas texto genérico + botão "Ver no Sistema") para o colaborador e o gestor
2. **`sendNfseEmails`** (linha 224) — envia o email **detalhado** (com tabela de composição, aprovação, link do PDF) para o financeiro e o gestor

O email que chegou (screenshot) é o da `notifyDocumentAction` — formato simples, sem a composição do valor, sem link do PDF, sem dados de aprovação. O email detalhado de `sendNfseEmails` provavelmente falhou silenciosamente (todos os erros são capturados com `catch`) ou foi para outro destinatário.

### Alterações

**`src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx`**

1. **Remover a chamada `notifyDocumentAction`** do fluxo de NFSe fechamento (manter apenas a notificação in-app se necessário, mas não o email simples duplicado)

2. **Ampliar os destinatários de `sendNfseEmails`** para incluir também o próprio colaborador (email de login via `authUser.email`), além de financeiro e gestor. Assim todos recebem o email detalhado com:
   - Dados da nota (número, valor, data de envio)
   - Link para download do PDF (signed URL)
   - Composição do valor (fixo, variável, KPIs)
   - Dados de aprovação

3. **Adicionar logs de erro mais visíveis** nas queries internas de `sendNfseEmails` (payout, profiles) para diagnosticar falhas futuras sem que sejam silenciosas

### Resultado

Todos os destinatários (colaborador, gestor, financeiro) receberão o **mesmo email detalhado** com a composição completa do valor, link do PDF e dados de aprovação. Não haverá mais o email simples duplicado.

