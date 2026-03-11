

## Plano: Mecanismo de Atribuição Manual de Vendas

### Contexto

O Flávio Mário teve reunião em dezembro (antes do sistema existir), então não há registro em `meeting_slots`/`meeting_slot_attendees`. Para que essa venda conte para a Cristiane, é preciso um mecanismo de atribuição manual. Apenas coordenador, manager e admin poderão usar.

### Alterações

#### 1. Nova tabela: `manual_sale_attributions`

```sql
CREATE TABLE manual_sale_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid NOT NULL REFERENCES closers(id),
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  contract_paid_at timestamptz NOT NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  business_unit text DEFAULT 'incorporador'
);

ALTER TABLE manual_sale_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenador+ can manage manual attributions"
ON manual_sale_attributions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager') 
    OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'manager') 
    OR public.has_role(auth.uid(), 'coordenador'));
```

#### 2. UI: Botão "Atribuir Venda Manual" na página de detalhe do Closer

Em `CloserMeetingsDetailPage.tsx`, adicionar um botão visível apenas para coordenador+ que abre um dialog com campos:
- Nome do contato (obrigatório)
- Email
- Telefone  
- Data do contrato pago (obrigatório)
- Observações

#### 3. Hook `useCloserDetailData.ts`: Incluir atribuições manuais

Na query de leads, adicionar uma terceira fonte de dados:
- Query 3: buscar `manual_sale_attributions` onde `closer_id = closerId` e `contract_paid_at` no período
- Mesclar com as queries 1 e 2, marcando como `is_manual: true`
- Adicionar campo `is_manual` à interface `CloserLead`

#### 4. Hook `useR1CloserMetrics.ts`: Contar atribuições manuais

Após calcular contratos pagos por `meeting_slot_attendees`, buscar também `manual_sale_attributions` no período e somar ao `contrato_pago` de cada closer.

#### 5. UI: Badge "Manual" na tabela de leads

No `CloserLeadsTable.tsx`, exibir badge "Manual" (cor diferente) para vendas atribuídas manualmente, similar ao badge "Follow-up".

### Permissões

O botão e o dialog só aparecem para roles `admin`, `manager` e `coordenador`, verificado via `useAuth().role`. A RLS da tabela impede acesso de outros roles.

