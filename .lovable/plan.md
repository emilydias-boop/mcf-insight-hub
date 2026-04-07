

# Fix: Leads importados com CPF no lugar do Nome

## Causa raiz

A planilha importada tinha a coluna de CPF como primeira coluna. O auto-mapeamento (`autoMapColumns`) nao encontrou nenhuma coluna com hints de "nome" (nome, name, contato, etc), entao a primeira coluna (CPF) ficou mapeada como "Nome" por fallback. O usuario nao percebeu porque **nao existe preview dos dados** no step de mapeamento — so aparece o nome do header, nao os valores.

Resultado: 6 leads criados com CPFs (25912347877, 84181966100, etc) como nome do contato e do deal.

## Correcoes

### 1. Corrigir dados existentes (imediato)
- Atualizar os 6 contatos e deals que tem CPFs como nome
- Buscar os nomes reais via email (ex: isabellagomes@yahoo.com.br → provavelmente "Isabella Gomes")
- Se a planilha original tinha coluna de nome, os nomes ficaram numa coluna "extra" nao mapeada

### 2. Adicionar preview de dados no step de mapeamento
No `SpreadsheetCompareDialog.tsx`, na etapa `mapping`:
- Mostrar uma tabela com as 3 primeiras linhas de dados abaixo de cada seletor de coluna
- O usuario ve os valores reais (ex: "25912347877" no campo Nome) e percebe que mapeou errado

### 3. Validacao inteligente de nomes
No `SpreadsheetCompareDialog.tsx`, na funcao `handleCompare`:
- Antes de enviar, verificar se os valores mapeados como "nome" parecem ser numeros puros (CPF/telefone)
- Se >50% dos "nomes" forem numericos, mostrar alerta: "Os nomes parecem ser numeros (CPF?). Verifique o mapeamento."
- O usuario pode ignorar e continuar, ou corrigir

### Arquivos
| Arquivo | Acao |
|---------|------|
| `src/components/crm/SpreadsheetCompareDialog.tsx` | Preview de dados + validacao de nomes numericos |

### Fluxo corrigido
```text
1. Usuario faz upload da planilha
2. Step mapping: ve os seletores COM preview dos dados
   Nome: [CPF] → mostra "25912347877" → percebe que esta errado
   Email: [Email] → mostra "isabellagomes@yahoo.com.br" → OK
   Telefone: [Telefone] → mostra "+5511983640085" → OK
3. Corrige: Nome → coluna correta da planilha
4. Se nao corrigir e nomes forem numeros: alerta aparece antes de comparar
```

