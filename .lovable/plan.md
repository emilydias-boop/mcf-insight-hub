

## Problema

O `webhook-lead-receiver` (usado pelo ClientData/anamnese e outros webhooks customizados) **não tem detecção de parceiros**. Leads que são parceiros conhecidos entram normalmente como "Novo Lead" e só são movidos para "Venda Realizada" pelo cron job a cada 6 horas.

Em contraste, o `hubla-webhook-handler` já possui essa lógica: verifica o email contra `hubla_transactions`, detecta padrões de parceria (A001-A009, INCORPORADOR, ANTICRISE), bloqueia a criação do deal e registra em `partner_returns`.

## Solução

Adicionar detecção de parceiros no `webhook-lead-receiver`, replicando a mesma lógica do `hubla-webhook-handler`. Quando um parceiro é detectado:

1. **Não bloquear** a criação do deal (diferente do hubla — aqui o lead pode ter interesse genuíno em outro produto)
2. **Mover diretamente** para o estágio "Venda Realizada" da pipeline
3. **Adicionar tag "Parceiro"** ao deal
4. **Registrar em `partner_returns`** para auditoria

### Arquivo: `supabase/functions/webhook-lead-receiver/index.ts`

**Adicionar função helper** (similar ao hubla):
```typescript
async function checkIfPartner(supabase, email) {
  // Busca hubla_transactions com sale_status=completed
  // Verifica padrões: A001-A009, INCORPORADOR, ANTICRISE
  // Retorna { isPartner, product }
}
```

**Após criar o deal (passo 11)**, adicionar verificação:
```typescript
// 11b. Partner detection - mover para Venda Realizada se parceiro
if (contactEmail) {
  const partnerCheck = await checkIfPartner(supabase, contactEmail);
  if (partnerCheck.isPartner) {
    // Buscar stage "Venda Realizada" da mesma origin
    // Mover deal para essa stage
    // Adicionar tag "Parceiro"
    // Registrar em partner_returns
    // Registrar deal_activity
  }
}
```

Dessa forma, parceiros que entram pelo webhook customizado são criados e imediatamente movidos para "Venda Realizada" com a tag "Parceiro", sem precisar esperar o cron de 6 horas.

