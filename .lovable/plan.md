# Onda 2 — Schema do banco (preparação)

Migration única, **zero impacto em produção**: tudo com defaults que preservam o comportamento atual.

## Migration

### 1. Enums novos
```sql
CREATE TYPE public.automation_anchor AS ENUM (
  'enqueue_time',     -- comportamento atual
  'meeting_start',
  'meeting_end',
  'contract_paid_at'
);

CREATE TYPE public.automation_step_kind AS ENUM (
  'confirmation',
  'reminder',
  'followup',
  'custom'
);
```

### 2. Colunas novas em `automation_steps`
```sql
ALTER TABLE public.automation_steps
  ADD COLUMN anchor                public.automation_anchor    NOT NULL DEFAULT 'enqueue_time',
  ADD COLUMN offset_minutes        integer                     NOT NULL DEFAULT 0,
  ADD COLUMN min_lead_time_minutes integer                     NOT NULL DEFAULT 0,
  ADD COLUMN respect_send_window   boolean                     NOT NULL DEFAULT true,
  ADD COLUMN step_kind             public.automation_step_kind NOT NULL DEFAULT 'custom';
```

Defaults garantem: `anchor=enqueue_time` + `offset=0` ≡ comportamento atual baseado em `delay_days/hours/minutes`.

### 3. Tabela nova `automation_routing_rules` (vazia)
```sql
CREATE TABLE public.automation_routing_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  origin_id    uuid REFERENCES public.crm_origins(id),
  product_code text,
  bu           text,
  priority     integer NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,
  conditions   jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_rules_flow   ON public.automation_routing_rules(flow_id);
CREATE INDEX idx_routing_rules_lookup ON public.automation_routing_rules(origin_id, bu, product_code) WHERE is_active;

CREATE TRIGGER trg_routing_rules_updated
  BEFORE UPDATE ON public.automation_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.automation_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage routing rules"
  ON public.automation_routing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read routing rules"
  ON public.automation_routing_rules FOR SELECT TO authenticated
  USING (true);
```

### 4. Quatro chaves novas em `automation_settings`
A tabela `system_settings` **não existe** no projeto; já se usa `automation_settings (key, value jsonb)`. Mantém o padrão:
```sql
INSERT INTO public.automation_settings (key, value) VALUES
  ('automation_timezone',          '"America/Sao_Paulo"'::jsonb),
  ('automation_send_window_start', '"09:00"'::jsonb),
  ('automation_send_window_end',   '"20:00"'::jsonb),
  ('leticia_whatsapp',             '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

## Validação pós-migration
1. `SELECT anchor, offset_minutes, step_kind FROM automation_steps LIMIT 5;` → todos com defaults.
2. Disparar automação ativa existente → comportamento idêntico.
3. `SELECT * FROM automation_routing_rules;` → vazio.
4. `SELECT key FROM automation_settings WHERE key LIKE 'automation_%' OR key='leticia_whatsapp';` → 4 chaves.
5. Rodar linter para confirmar RLS limpo.

## Fora de escopo (Ondas 3+)
- Qualquer leitura/uso dos novos campos em código (frontend ou edge functions).
- Trigger em `meeting_slots`.
- UI nos editores de Step / Flow / Settings.
- Avaliação de `automation_routing_rules` no `automation-enqueue`.