

# Agrupar a010 e renovacao nas categorias corretas do Closer

## Contexto de Negocio

A jornada de venda do closer segue o fluxo: **a010 (curso) -> contrato -> parceria**. E renovacao e a renovacao da parceria. Portanto:

- **Parcerias** deve incluir: `parceria` + `a010` + `renovacao`
- **Contratos** permanece como esta: `incorporador`, `contrato`, `contrato-anticrise`

## Mudancas

### Arquivo: `src/components/relatorios/CloserRevenueDetailDialog.tsx`

1. **Filtro de parcerias** (linha 109): Expandir para incluir `a010` e `renovacao`:
   ```text
   const parcerias = transactions.filter(
     (t) => t.product_category === 'parceria' 
         || t.product_category === 'a010' 
         || t.product_category === 'renovacao'
   );
   ```

2. **Normalizar categorias no Breakdown por Categoria** (linhas 141-142): Mapear `a010` e `renovacao` para `parceria` no catMap para que nao aparecam como linhas separadas:
   ```text
   let cat = tx.product_category || 'outros';
   if (cat === 'a010' || cat === 'renovacao') cat = 'parceria';
   ```

## Resultado

- O KPI "Parcerias" incluira transacoes de a010 e renovacao no bruto e liquido
- O breakdown por categoria mostrara apenas "parceria" (agrupando a010 + renovacao + parceria)
- A tabela "Detalhamento de Parcerias" listara os produtos individuais (A010, Parceria, Renovacao) com seus valores separados
- O KPI "Contratos" permanece inalterado

