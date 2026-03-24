

## Implementação: CRM deal creation no webhook-make-a010 + Backfill

### Resumo
Já aprovado anteriormente. Duas mudanças:

1. **`supabase/functions/webhook-make-a010/index.ts`** - Após salvar a transação, adicionar bloco que:
   - Busca origin "PIPELINE INSIDE SALES"
   - Verifica se é parceiro (PARTNER_PATTERNS)
   - Busca/cria crm_contact por email
   - Verifica se já existe deal (se sim, pula)
   - Se não existe: busca stage "Novo Lead", distribui via `get_next_lead_owner`, cria deal
   - Upsert em a010_sales
   - Erros no CRM não bloqueiam a resposta (transação já foi salva)

2. **`supabase/functions/backfill-a010-missing-deals/index.ts`** (novo) - Script one-time para criar deals dos ~40 leads perdidos:
   - Busca transações A010 dos últimos 7 dias
   - Cruza com crm_contacts/crm_deals para achar os que não têm deal
   - Aplica mesma lógica (partner check, criar contato, distribuir, criar deal)
   - dry_run por padrão

3. **Deploy** de ambas as edge functions

