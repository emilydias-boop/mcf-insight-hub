

## Webhook de Captura de Dados Completos do Lead (ClientData)

### Contexto

O sistema já possui o `webhook-lead-receiver` que cria contatos e deals no CRM. Porém ele armazena dados extras apenas no campo `custom_fields` (JSONB) do deal, sem estrutura dedicada. Para os ~40 campos detalhados do ClientData (financeiro, patrimônio, investimentos, perfil, etc.), precisamos de uma tabela dedicada e atualizar a edge function para processar esses campos.

### Plano

#### 1. Criar tabela `lead_profiles` (migração SQL)

Tabela dedicada para armazenar os dados 360° do lead, vinculada ao `contact_id`:

- **Pessoal**: `nome_completo`, `cpf` (UNIQUE), `whatsapp`, `data_nascimento`, `estado_cidade`, `estado_civil`, `num_filhos`
- **Profissional**: `profissao`, `is_empresario`, `porte_empresa`
- **Financeiro**: `renda_bruta`, `fonte_renda`, `faixa_aporte`, `faixa_aporte_descricao`
- **Perfil**: `esporte_hobby`, `gosta_futebol`, `time_futebol`
- **Empresa/Capital**: `precisa_capital_giro`, `valor_capital_giro`
- **Objetivos**: `objetivos_principais` (JSONB), `renda_passiva_meta`, `tempo_independencia`
- **Patrimônio**: `imovel_financiado`, `possui_consorcio`, `saldo_fgts`
- **Investimentos**: `investe`, `valor_investido`, `corretora`
- **Situação**: `possui_divida`, `possui_seguros`, `possui_carro`
- **Bancário**: `bancos` (JSONB)
- **Avançado**: `interesse_holding`, `perfil_indicacao`
- **Calculados**: `lead_score` (integer), `icp_level` (text)
- **Controle**: `data_cadastro`, `origem

<lov-plan>

## Webhook de Captura de Dados Completos do Lead (ClientData)

### Contexto

O sistema já possui o `webhook-lead-receiver` que cria contatos e deals no CRM. Porém ele armazena dados extras apenas no campo `custom_fields` (JSONB) do deal, sem estrutura dedicada. Para os ~40 campos detalhados do ClientData (financeiro, patrimônio, investimentos, perfil, etc.), precisamos de uma tabela dedicada e atualizar a edge function para processar esses campos.

### Plano

#### 1. Criar tabela `lead_profiles` (migração SQL)

Tabela dedicada vinculada ao `contact_id` com todos os campos estruturados:

- **Pessoal**: `nome_completo`, `cpf` (UNIQUE para deduplicação), `whatsapp`, `data_nascimento`, `estado_cidade`, `estado_civil`, `num_filhos`
- **Profissional**: `is_empresario`, `profissao`, `porte_empresa`
- **Financeiro**: `renda_bruta`, `fonte_renda`, `faixa_aporte`, `faixa_aporte_descricao`
- **Perfil/Interesses**: `esporte_hobby`, `gosta_futebol`, `time_futebol`
- **Capital**: `precisa_capital_giro`, `valor_capital_giro`
- **Objetivos**: `objetivos_principais` (JSONB array), `renda_passiva_meta`, `tempo_independencia`
- **Patrimônio**: `imovel_financiado`, `possui_consorcio`, `saldo_fgts`
- **Investimentos**: `investe`, `valor_investido`, `corretora`
- **Situação**: `possui_divida`, `possui_seguros`, `possui_carro`
- **Bancário**: `bancos` (JSONB)
- **Avançado**: `interesse_holding`, `perfil_indicacao`
- **Calculados**: `lead_score` (integer, default 0), `icp_level` (text)
- **Controle**: `data_cadastro` (timestamptz), `origem` (text, default 'mcf_crm')
- RLS habilitado, políticas para authenticated users
- Constraint UNIQUE em `cpf` (quando não-nulo) e UNIQUE em `contact_id`

#### 2. Atualizar `webhook-lead-receiver/index.ts`

Após criar o deal (passo 11 atual), adicionar lógica para:

- **Parsear campos ClientData**: Mapear tanto nomes snake_case (`renda_bruta`) quanto camelCase (`rendaBruta`) do payload
- **Normalizar booleanos**: Aceitar `true/false`, `"sim"/"não"`, `1/0`
- **Deduplicação por CPF/WhatsApp**: Antes de criar contato, buscar `lead_profiles` por CPF ou WhatsApp. Se encontrar, vincular ao contato existente e atualizar dados
- **Upsert lead_profile**: Inserir ou atualizar o registro em `lead_profiles` vinculado ao `contact_id`
- **Lead Score placeholder**: Campo `lead_score` salvo como 0, preparado para cálculo futuro

#### 3. Tipos TypeScript (`src/integrations/supabase/types.ts`)

Adicionar tipagem da tabela `lead_profiles` ao schema de tipos do Supabase (será feito automaticamente pela migração).

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | CREATE TABLE `lead_profiles` com todos os campos, RLS, indexes |
| `supabase/functions/webhook-lead-receiver/index.ts` | Adicionar parsing de ClientData, deduplicação por CPF/WhatsApp, upsert em `lead_profiles` |

### Deduplicação

A ordem de deduplicação será:
1. CPF → busca em `lead_profiles.cpf`
2. WhatsApp/telefone → busca existente por sufixo 9 dígitos em `crm_contacts`
3. Email → busca existente em `crm_contacts`

Se encontrar por CPF, reutiliza o `contact_id` vinculado e atualiza os dados do perfil.

