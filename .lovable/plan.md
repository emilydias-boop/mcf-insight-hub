

# Plano: Corrigir Popup de Nova Transação na Aba Vendas do Carrinho R2

## Problema Identificado

Você adicionou a transação do **Maurício Felipe Bezerra de Sousa** pela aba "Vendas" do Carrinho R2, mas ela não apareceu na lista. Consultei o banco e encontrei:

| Campo | Valor Atual | Valor Necessário |
|-------|-------------|------------------|
| `product_category` | `NULL` | `parceria` |
| `linked_attendee_id` | `NULL` | UUID do lead aprovado |

O hook `useR2CarrinhoVendas` filtra por `product_category = 'parceria'` (linha 142), por isso a transação não aparece.

## Causa Raiz

O popup "Nova Transação" na aba Vendas usa o componente genérico `TransactionFormDialog` do módulo Incorporador, que:

1. **Não define** `product_category = 'parceria'` ao criar a transação
2. **Não oferece** opção de selecionar um lead aprovado para vincular a venda
3. Lista produtos do Incorporador (A001, A009, etc.) em vez de produtos específicos de parceria

## Solução Proposta

Criar um novo componente `R2CarrinhoTransactionFormDialog` específico para a aba Vendas do Carrinho R2 que:

### 1. Seleção de Lead Aprovado (nova funcionalidade)

- Campo select/dropdown listando leads aprovados da semana atual
- Opção "Buscar em outras semanas" (toggle para expandir busca)
- Campo de busca para filtrar por nome/email/telefone
- Ao selecionar um lead, preenche automaticamente:
  - Nome do cliente
  - Email do cliente  
  - Telefone do cliente

### 2. Campos do Formulário

```text
┌─────────────────────────────────────────────────────────────┐
│                    Nova Venda de Parceria                   │
├─────────────────────────────────────────────────────────────┤
│  Lead Aprovado *                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Buscar lead aprovado...                            ▼ │  │
│  └───────────────────────────────────────────────────────┘  │
│  [ ] Buscar em outras semanas                               │
│                                                             │
│  Produto *                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ A009 - MCF INCORPORADOR COMPLETO + THE CLUB        ▼ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ Nome do Cliente *    │  │ Email *                      │ │
│  │ [auto-preenchido]    │  │ [auto-preenchido]            │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ Telefone             │  │ Data da Venda *              │ │
│  │ [auto-preenchido]    │  │ [📅 30/01/2026]              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ Valor Bruto (R$)     │  │ Valor Líquido (R$) *         │ │
│  │ [R$ 19.500,00]       │  │ [R$ 13.089,70]               │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│                        [Cancelar]  [Criar Venda]            │
└─────────────────────────────────────────────────────────────┘
```

### 3. Lógica de Criação

Ao criar a transação:

```text
{
  hubla_id: `manual-${Date.now()}`,
  product_name: <produto selecionado>,
  product_category: 'parceria',           // ← CHAVE para aparecer na lista
  linked_attendee_id: <id do lead>,       // ← Vincula ao lead aprovado
  customer_name: <do lead ou editado>,
  customer_email: <do lead ou editado>,
  customer_phone: <do lead ou editado>,
  sale_date: <data selecionada>,
  product_price: <preço de referência>,
  net_value: <valor líquido>,
  source: 'manual',
  sale_status: 'completed',
  count_in_dashboard: true
}
```

## Arquivos a Modificar/Criar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/crm/R2CarrinhoTransactionFormDialog.tsx` | Novo dialog específico para vendas do carrinho |
| `src/hooks/useCreateCarrinhoTransaction.ts` | Hook para criar transação com `product_category = 'parceria'` e vinculação |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/R2VendasList.tsx` | Trocar `TransactionFormDialog` por `R2CarrinhoTransactionFormDialog` |

## Correção Imediata da Transação Existente

Executar SQL para corrigir a transação do Maurício que já foi criada:

```sql
UPDATE hubla_transactions 
SET product_category = 'parceria'
WHERE id = 'f4876eaf-66b2-4a14-8dd5-e529aab0ce38';
```

Nota: A vinculação com o lead aprovado (`linked_attendee_id`) pode ser feita manualmente via UI depois, usando o botão "Vincular" que já existe.

## Benefícios

1. **Transações aparecem na lista** - `product_category = 'parceria'` garante o filtro
2. **Vinculação automática** - Lead selecionado já é vinculado (`linked_attendee_id`)
3. **Preenchimento automático** - Dados do lead preenchem o formulário
4. **Atribuição correta** - Closer do lead é usado nas métricas
5. **UX melhorada** - Fluxo mais intuitivo para adicionar vendas manuais

