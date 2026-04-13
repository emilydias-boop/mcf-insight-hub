

## Plano: Bloquear Parceiros/Renovações na Inside Sales (Incorporador)

### Problema

Leads que já são parceiros ou fizeram renovação (ex: A006 - Renovação Parceiro MCF) estão entrando como "Novo Lead" na Pipeline Inside Sales da BU Incorporador. O sistema detecta parceiros somente DEPOIS de criar o deal (linha 828) e os move para "Venda Realizada" — mas os patterns estão incompletos (faltam A005, A006, A007, A008, RENOVAÇÃO).

### Correção

**Arquivo: `supabase/functions/webhook-lead-receiver/index.ts`**

#### 1. Expandir PARTNER_PATTERNS (linha 1156)

```typescript
// De:
const PARTNER_PATTERNS = ['A001', 'A002', 'A003', 'A004', 'A009', 'INCORPORADOR', 'ANTICRISE'];

// Para:
const PARTNER_PATTERNS = [
  'A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009',
  'INCORPORADOR', 'ANTICRISE', 'RENOVAÇÃO', 'RENOVACAO',
  'R001', 'R004', 'R005', 'R006', 'R009', 'R21',
  'MCF PLANO', 'MCF INCORPORADOR',
];
```

#### 2. Adicionar trava ANTES da criação do deal, apenas para Inside Sales

Inserir entre a trava A010 (linha 537) e o check de deal existente (linha 539). A lógica:

- Se `endpoint.origin_id === INSIDE_SALES_ORIGIN_ID`, verificar se o lead é parceiro/renovação via `checkIfPartner`
- Se for parceiro: **bloquear** criação do deal, retornar `partner_blocked`
- Registrar em `partner_returns` com `blocked: true`
- Se NÃO for Inside Sales: não bloquear (outras BUs decidem seus próprios fluxos)

```typescript
// ======= TRAVA PARCEIRO/RENOVAÇÃO: Bloquear na Inside Sales (Incorporador) =======
if (endpoint.origin_id === INSIDE_SALES_ORIGIN_ID && contactEmail) {
  const partnerCheck = await checkIfPartner(supabase, contactEmail);
  if (partnerCheck.isPartner) {
    console.log(`[WEBHOOK-RECEIVER] ⛔ Parceiro/Renovação detectado na Inside Sales: ${contactEmail} (${partnerCheck.product}) — bloqueando`);
    
    // Registrar auditoria
    try {
      await supabase.from('partner_returns').insert({
        contact_id: contactId,
        contact_email: contactEmail,
        contact_name: payload.name || payload.nome_completo || null,
        partner_product: partnerCheck.product || 'parceria',
        return_source: `webhook-${slug}`,
        return_product: endpoint.name,
        return_value: 0,
        blocked: true,
        notes: `Parceiro/Renovação bloqueado na Inside Sales via webhook-lead-receiver (${slug}).`,
      } as any);
    } catch (prErr) {
      console.error('[WEBHOOK-RECEIVER] Erro ao registrar partner_returns:', prErr);
    }
    
    await updateEndpointMetrics(supabase, endpoint.id);
    
    return new Response(
      JSON.stringify({
        success: true,
        action: 'partner_blocked',
        reason: 'partner_or_renewal_blocked_from_inside_sales',
        contact_id: contactId,
        partner_product: partnerCheck.product,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

#### 3. Manter a detecção pós-criação (linha 828) como está

Para pipelines que NÃO são Inside Sales, o comportamento atual (criar deal e mover para Venda Realizada) continua funcionando. Não remover.

### Impacto

- Parceiros e renovações (A001-A009, RENOVAÇÃO, R001, etc.) serão **bloqueados** de entrar como novo lead na Inside Sales (Incorporador)
- Outras pipelines/BUs não são afetadas
- Auditoria em `partner_returns` com `blocked: true`
- Leads genuinamente novos continuam entrando normalmente

