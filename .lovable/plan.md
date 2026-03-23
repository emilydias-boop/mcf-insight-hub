

## Plano: Corrigir envio de email de reset + bugs no create-user

### Diagnóstico

Analisei os logs da Edge Function `create-user` e encontrei **3 problemas**:

#### 1. Email de reset: enviado mas possivelmente não entregue
O `recovery_sent_at` está preenchido no banco, ou seja, o Supabase processou o `resetPasswordForEmail`. Porém, sem um domínio de email customizado configurado, os emails são enviados pelo SMTP padrão do Supabase que tem **rate limit de ~3-4 emails/hora** e frequentemente caem no spam. Este é provavelmente o motivo de o email não chegar.

#### 2. Squad não está salvando (erro nos logs)
```
Error updating profile squad: malformed array literal: "a010"
```
O campo `squad` é `TEXT[]` (array), mas o código envia uma string simples `"a010"` em vez de `["a010"]`.

#### 3. Employee não está sendo criado (erro nos logs)
```
Could not find the 'ativo' column of 'employees'
```
O código usa `ativo: true` mas a coluna na tabela `employees` se chama `status`, não `ativo`.

---

### Correções

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/create-user/index.ts` | 1. Corrigir squad para enviar como array `[squad]` em vez de string. 2. Trocar `ativo: true` por campo correto ou remover. 3. Adicionar `nome_completo` no insert do employee (campo existente) |

#### Correção do squad (linha 144):
```typescript
// De:
.update({ squad })
// Para:
.update({ squad: [squad] })
```

#### Correção do employee (linha 176):
```typescript
// De:
.insert({ user_id, nome: full_name, email, cargo_catalogo_id, ativo: true })
// Para:
.insert({ user_id, nome_completo: full_name, email_pessoal: email, cargo_catalogo_id, status: 'ativo' })
```

### Sobre o email de reset

O email está sendo disparado corretamente pelo Supabase. As possíveis causas de não recebimento:
- **Rate limit do SMTP padrão do Supabase** (o mais provável)
- Email caindo em spam/lixo eletrônico

A solução definitiva seria configurar um domínio de email customizado via Cloud → Emails, mas como correção imediata, posso verificar se o email está sendo bloqueado e garantir que o link de reset funcione quando recebido.

### Resultado esperado
- Squad salva corretamente como array
- Employee é criado corretamente no banco
- Email de reset continua sendo enviado (o delivery depende do SMTP do Supabase)

