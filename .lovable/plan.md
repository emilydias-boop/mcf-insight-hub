

## Adicionar Histórico Completo de Compras no Drawer do Controle Diego

### Problema
A seção "Jornada A010" filtra apenas `product_category = 'a010'`, então o contrato (A000) e outras compras não aparecem. O lead mostra "Contrato Pago" mas a última compra visível é do A010 em 14/02.

### Solução
Adicionar uma nova seção **"Histórico de Compras"** no drawer que mostra **todas** as transações do lead (A010, A000/contrato, parcerias, etc.), usando o hook `useLeadPurchaseHistory` que já existe e busca por email + phone sem filtro de categoria.

### Arquivo a alterar
**`src/components/relatorios/ControleDiegoDrawer.tsx`**

1. Importar `useLeadPurchaseHistory` 
2. Adicionar chamada do hook com `contract.leadEmail` e `contract.leadPhone`
3. Inserir nova seção **"Histórico de Compras"** entre "Jornada A010" e "Contato", listando todas as transações com: produto, data, valor, status e fonte
4. Manter a seção "Jornada A010" como está (resumo específico do A010)

### Resultado
O drawer mostrará tanto o resumo A010 quanto o histórico completo incluindo o contrato A000, permitindo ver toda a jornada de compras do lead num só lugar.

