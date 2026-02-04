
# Plano: Importar Leads para Pipeline "VIVER DE ALUGUEL"

## Contexto
Você tem 2.158 leads exportados do Clint para importar na pipeline **"PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"** (`4e2b810a-6782-4ce9-9c0d-10d04c018636`).

## Problema Identificado
A Edge Function `process-csv-imports` que processa os CSVs atualmente:
- Lê `name`, `value`, `stage`, `owner`, `tags` corretamente
- **Não extrai email e telefone do CSV** - só tenta vincular a contatos existentes
- Não cria novos contatos se não encontrar

## Solução Proposta

### 1. Atualizar a Edge Function `process-csv-imports`

Modificar para:
- **Extrair `email` e `phone` das colunas do CSV** (ou `telefone`, `celular`, `whatsapp`)
- **Criar contatos automaticamente** se não existirem no banco
- **Vincular o `contact_id`** ao deal criado
- Mapear o **owner** corretamente (email do SDR)

### 2. Mapeamento de Colunas do CSV

O sistema passará a aceitar estas colunas adicionais:

| Coluna CSV | Campo CRM | Descrição |
|------------|-----------|-----------|
| `email` | `crm_contacts.email` | Email do lead |
| `phone` / `telefone` / `celular` | `crm_contacts.phone` | Telefone normalizado |
| `owner` / `dono` | `crm_deals.owner_id` + `owner_profile_id` | Email do responsável |
| `contact` / `name` | `crm_contacts.name` | Nome do contato |
| `tags` | `crm_deals.tags` | Tags separadas por vírgula |

### 3. Fluxo de Importação

```text
CSV Upload
    │
    ▼
┌──────────────────────────────┐
│ import-deals-csv             │
│ (upload para storage)        │
└──────────────────────────────┘
    │
    ▼ (cron a cada 2 min)
┌──────────────────────────────────────────────────┐
│ process-csv-imports (atualizado)                  │
│                                                   │
│  Para cada linha:                                │
│  1. Extrair email/phone do CSV                   │
│  2. Buscar contato existente por email ou phone  │
│  3. Se não encontrar → criar novo contato        │
│  4. Criar/atualizar deal com contact_id          │
│  5. Resolver owner_profile_id pelo email         │
└──────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Deals + Contatos criados     │
│ na pipeline selecionada      │
└──────────────────────────────┘
```

### 4. Passos para Usar

Após a implementação:

1. Exportar os 2.158 leads do Clint em formato CSV
2. Garantir que o CSV tenha colunas: `id`, `name`, `email`, `phone`, `owner`
3. Acessar **/crm/importar-negocios**
4. Selecionar **"PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"** no dropdown
5. Fazer upload do CSV
6. O sistema processará em chunks de 1.000 a cada 2 minutos

## Alterações Técnicas

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/process-csv-imports/index.ts` | Adicionar extração de email/phone, criação automática de contatos, resolução de owner_profile_id |

### Detalhes da Implementação

Na função `convertToDBFormat`:

1. Adicionar leitura das colunas `email`, `phone`, `telefone`, `celular`
2. Armazenar temporariamente para criação de contato

No loop principal de processamento:

1. Para cada deal, verificar se email/phone existem
2. Buscar contato existente por email ou telefone normalizado
3. Se não encontrar, criar novo contato com os dados
4. Vincular `contact_id` ao deal
5. Resolver `owner_profile_id` a partir do email do owner

### Exemplo de CSV Compatível

```text
id;name;email;phone;owner;tags;value;stage
12345;João Silva;joao@email.com;11999998888;sdr@empresa.com;viver-aluguel;50000;Novo Lead
12346;Maria Santos;maria@email.com;21988887777;sdr@empresa.com;viver-aluguel,lead-quente;75000;Reunião Agendada
```

## Resultado Esperado

Após a implementação:
- Os 2.158 leads serão importados com todos os dados
- Contatos serão criados automaticamente com email e telefone
- Cada deal terá seu contato vinculado
- Owner (SDR) será associado corretamente com `owner_id` e `owner_profile_id`
- Tags e campos customizados serão preservados
