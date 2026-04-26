
## Objetivo
Atualizar o webhook **ClientData Inside** (`webhook-lead-receiver`) para persistir todos os campos novos do payload e expandir a UI **"Perfil do Lead"** (`LeadProfileSection`) para exibi-los.

## Análise (gaps encontrados)

Comparando o novo payload com o que hoje é gravado em `lead_profiles`:

### 🆕 Campos novos do payload que HOJE são ignorados
- `email`
- `instagram`
- `canal_conhecimento` (como conheceu)
- `ja_constroi`
- `experiencia_imobiliaria`
- `interesse_consorcio`
- `situacao_credito`
- `tentou_financiamento`
- `urgencia_operacao`
- `lead_score`, `icp_level`, `icp_level_name` — chegam no payload mas o código força `lead_score = 0` e `icp_level = null`
- `data_cadastro` — não está sendo gravado a partir do payload
- `source` — alias de `origem`

### 🐛 Bugs de mapeamento atuais
- `estado_civil` chega como array (`["Casado"]`) e é salvo como string JSON literal `"[\"Casado(a)\"]"` — precisa virar string limpa (ex: `"Casado"`)
- `lead_score` e `icp_level` recebidos no payload são descartados (sobrescritos)

## Mudanças propostas

### 1. Migração no banco (`lead_profiles`)
Adicionar colunas para os novos campos:
- `email text`
- `instagram text`
- `canal_conhecimento text`
- `ja_constroi text`
- `experiencia_imobiliaria text`
- `interesse_consorcio text`
- `situacao_credito text`
- `tentou_financiamento text`
- `urgencia_operacao text`
- `icp_level_name text`

(`lead_score` int, `icp_level` int e `data_cadastro` timestamptz já existem.)

### 2. `supabase/functions/webhook-lead-receiver/index.ts`
Na função `upsertLeadProfile` (linhas ~1157-1251):
- Mapear todos os campos novos listados acima
- Normalizar `estado_civil` array → string (`Array.isArray(v) ? v[0] : v`)
- Usar `lead_score` e `icp_level` recebidos do payload (com fallback `0`/`null`)
- Aceitar `source` como alias de `origem`
- Persistir `data_cadastro` quando vier no payload

### 3. `src/components/crm/LeadProfileSection.tsx`
Expandir as `CATEGORIES`:
- **Dados Pessoais**: adicionar `email`, `instagram`, `canal_conhecimento`
- **Nova categoria "Experiência & Interesse"**: `ja_constroi`, `experiencia_imobiliaria`, `interesse_consorcio`
- **Nova categoria "Crédito & Urgência"**: `situacao_credito`, `tentou_financiamento`, `urgencia_operacao`
- Exibir `icp_level_name` junto ao badge de `icp_level` (rodapé)

### 4. Regenerar `src/integrations/supabase/types.ts`
Automático após a migração.

## Fora de escopo
- Mudar regras de roteamento/distribuição (mantém o fluxo atual do `webhook-lead-receiver`)
- Recalcular `lead_score`/`icp_level` no servidor — passamos a confiar no que o payload envia
- Backfill de leads históricos (apenas novos eventos preencherão os campos novos)
