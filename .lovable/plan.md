
# Plano: Corrigir Parcelas Intercaladas + Adicionar Edição de Parcelas

## Problema 1: Bug nas 8 Parcelas Intercaladas

### Análise do Bug

Os dados confirmam o problema. Para o cliente HEITOR NICKEL LOOSE com `parcelas_pagas_empresa = 8` e `tipo_contrato = 'intercalado'`:

| Parcela | Tipo Atual | Esperado |
|---------|------------|----------|
| 2       | Empresa    | Empresa ✓ (1ª par) |
| 4       | Empresa    | Empresa ✓ (2ª par) |
| 6       | Empresa    | Empresa ✓ (3ª par) |
| 8       | Empresa    | Empresa ✓ (4ª par) |
| 10      | Empresa    | Empresa ✓ (5ª par) |
| 12      | Empresa    | Empresa ✓ (6ª par) |
| 14      | Empresa    | Empresa ✓ (7ª par) |
| 16      | Empresa    | Empresa ✓ (8ª par) - ÚLTIMA |
| 18      | Empresa ✗  | Cliente |
| 20      | Empresa ✗  | Cliente |
| ...     | Empresa ✗  | Cliente |

A lógica atual no arquivo `src/hooks/useConsorcio.ts` (linha 224-228) está **correta**:

```typescript
const ehPar = i % 2 === 0;
const qualParcelaParEhEssa = i / 2; // 2→1, 4→2, 6→3, 8→4...
tipo = (ehPar && qualParcelaParEhEssa <= input.parcelas_pagas_empresa) ? 'empresa' : 'cliente';
```

**Resultado esperado da lógica:**
- Parcela 16: `16 / 2 = 8` ≤ 8 → Empresa ✓
- Parcela 18: `18 / 2 = 9` > 8 → Cliente ✓

**Conclusão:** A lógica está correta, mas os dados no banco estão errados. Isso significa que a carta foi criada com uma versão anterior do código que tinha o bug, ou o código foi corrigido depois que as cartas já existiam.

### Solução

1. Corrigir os dados existentes no banco via SQL
2. Garantir que novas cartas sejam geradas corretamente (a lógica atual está OK)

---

## Problema 2: Edição de Parcelas Individuais

### Necessidades Identificadas

O usuário precisa:
- Editar o **tipo** da parcela (Cliente/Empresa)
- Editar o **valor** da parcela
- Editar a **data de vencimento**
- Adicionar **observação** (motivo de alteração, juros pagos, etc.)
- Alterar manualmente o **status**

### Implementação

#### 1. Migration: Adicionar campo `observacao` na tabela de parcelas

Adicionar coluna para registrar motivos de alterações.

#### 2. Atualizar tipo TypeScript

Arquivo: `src/types/consorcio.ts`

Adicionar campo `observacao?: string` na interface `ConsorcioInstallment`.

#### 3. Criar hook `useUpdateInstallment`

Arquivo: `src/hooks/useConsorcio.ts`

Novo hook para atualizar parcelas individuais:
- Tipo (cliente/empresa)
- Valor da parcela
- Valor da comissão
- Data de vencimento
- Data de pagamento
- Status
- Observação

#### 4. Criar componente `EditInstallmentDialog`

Arquivo: `src/components/consorcio/EditInstallmentDialog.tsx`

Dialog com formulário para editar todos os campos da parcela:
- Select para Tipo (Cliente/Empresa)
- Input para Valor da Parcela
- Input para Valor da Comissão
- DatePicker para Data de Vencimento
- DatePicker para Data de Pagamento (opcional)
- Select para Status (Pendente/Pago/Atrasado)
- Textarea para Observação (motivo da alteração)

#### 5. Atualizar `InstallmentsPaginated`

Arquivo: `src/components/consorcio/InstallmentsPaginated.tsx`

- Adicionar botão "Editar" na coluna de ações (ao lado de "Pagar")
- Ao clicar, abrir o `EditInstallmentDialog`
- Receber callback `onEditInstallment` via props

#### 6. Atualizar `ConsorcioCardDrawer`

Arquivo: `src/components/consorcio/ConsorcioCardDrawer.tsx`

- Importar e renderizar `EditInstallmentDialog`
- Criar handler `handleEditInstallment`
- Passar props necessárias para `InstallmentsPaginated`

---

## Correção de Dados Existentes

Para corrigir as cartas já criadas com o bug, executaremos uma query SQL que recalcula o tipo correto para cada parcela com `tipo_contrato = 'intercalado'`:

```sql
UPDATE consortium_installments ci
SET tipo = CASE 
  WHEN (ci.numero_parcela % 2 = 0) AND (ci.numero_parcela / 2 <= cc.parcelas_pagas_empresa) 
  THEN 'empresa' 
  ELSE 'cliente' 
END
FROM consortium_cards cc
WHERE ci.card_id = cc.id
  AND cc.tipo_contrato = 'intercalado';
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/types/consorcio.ts` | Adicionar campo `observacao` |
| `src/hooks/useConsorcio.ts` | Adicionar hook `useUpdateInstallment` |
| `src/components/consorcio/EditInstallmentDialog.tsx` | Criar novo componente |
| `src/components/consorcio/InstallmentsPaginated.tsx` | Adicionar botão Editar |
| `src/components/consorcio/ConsorcioCardDrawer.tsx` | Integrar dialog de edição |
| Migration SQL | Adicionar coluna `observacao` |

---

## Fluxo da Edição

```
┌─────────────────────────────────────────────────────────┐
│                  Lista de Parcelas                       │
│  ┌───┬─────────┬────────────┬─────────┬───────────────┐ │
│  │ # │  Tipo   │ Vencimento │  Valor  │     Ações     │ │
│  ├───┼─────────┼────────────┼─────────┼───────────────┤ │
│  │14 │ Empresa │ 14/03/2027 │R$1.666  │ [Editar][Pagar]│◄─┐
│  └───┴─────────┴────────────┴─────────┴───────────────┘ │ │
└─────────────────────────────────────────────────────────┘ │
                                                            │
    Clique em "Editar"                                      │
                                                            │
┌─────────────────────────────────────────────────────────┐ │
│            Editar Parcela #14                           │ │
│  ┌────────────────────────────────────────────────────┐ │ │
│  │ Tipo:        [Empresa ▼]                           │ │ │
│  │ Valor:       [R$ 1.666,67        ]                 │ │ │
│  │ Comissão:    [R$ 0,00            ]                 │ │ │
│  │ Vencimento:  [14/03/2027         ]                 │ │ │
│  │ Status:      [Pendente ▼]                          │ │ │
│  │ Observação:                                        │ │ │
│  │ ┌────────────────────────────────────────────────┐ │ │ │
│  │ │ Pago com juros de mora (R$ 50,00)              │ │ │ │
│  │ └────────────────────────────────────────────────┘ │ │ │
│  │                                                    │ │ │
│  │              [Cancelar]  [Salvar]                  │ │ │
│  └────────────────────────────────────────────────────┘ │ │
└─────────────────────────────────────────────────────────┘ │
                         │                                  │
                         └──────────────────────────────────┘
```
