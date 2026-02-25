

## Problema: Preço não atualiza + registros duplicados

### Diagnóstico

Encontrei dois problemas:

**1. A data de vigência NÃO foi salva (causa raiz)**

Quando você alterou o preço e escolheu a data de vigência, o frontend tentou atualizar o campo `effective_from` na tabela `product_price_history`, mas **falhou silenciosamente** porque a tabela não tem uma policy de UPDATE no banco. Só tem policies de SELECT e INSERT.

Resultado: o `effective_from` ficou em `2026-02-25 21:34:13` (hora exata do trigger) em vez de `2026-02-25 00:00:00` (início do dia que você escolheu). Como a venda do Marcio foi às 16:01, o sistema entende que o preço de 16.500 só vale a partir das 21:34, e usa 14.500 para a venda das 16:01.

**2. Registros duplicados na tela**

O Marcio tem 3 transações A001 na Hubla (IDs diferentes, mesma hora 16:01), provavelmente vindas de fontes diferentes (hubla + make). Isso é um problema de dados, não da lógica de preço. A deduplicação visual pode estar mostrando entradas que antes eram colapsadas.

### Plano de correção

**1. Adicionar policy de UPDATE na `product_price_history`** (migration SQL)

```sql
CREATE POLICY "Authenticated users can update price history"
ON product_price_history FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

**2. Corrigir o `effective_from` dos registros existentes do A001** (migration SQL)

Atualizar os dois registros de mudança de preço (16500) para que tenham `effective_from` no início do dia 25/02:

```sql
UPDATE product_price_history 
SET effective_from = '2026-02-25T00:00:00-03:00'
WHERE new_price = 16500 AND old_price = 14500 
  AND effective_from::date = '2026-02-25';
```

Após isso, `get_effective_price` vai retornar 16.500 para qualquer venda a partir de 25/02 00:00.

**3. Investigar as transações duplicadas do Marcio**

Verificar se as 3 transações A001 são legítimas ou duplicatas de ingestão. Se duplicatas, marcar as extras para não contar no bruto.

### Seção técnica

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar RLS UPDATE policy + fix `effective_from` dos registros existentes |

A alteração é mínima: uma policy de 3 linhas + um UPDATE pontual nos dados.

