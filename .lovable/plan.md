

## Plano: Corrigir seção de Remuneração no Meu RH para colaboradores sem variável

### Problema

A seção "Remuneração do mês atual" mostra OTE, Fixo, Variável e Total para todos os colaboradores que possuem registro na tabela `sdr`. Emily, por exemplo, tem um registro SDR vinculado, mas não tem remuneração variável — o componente deveria mostrar apenas o salário fixo.

### Solução

Usar o campo `employee.tipo_variavel` (e opcionalmente `employee.modelo_fechamento`) para decidir qual layout exibir:

- **Com variável** (`tipo_variavel = 'modelo_sdr'` ou payout existente com valores): layout atual com OTE, Fixo, Variável, Total e link para "Meu Fechamento"
- **Sem variável** (sem `tipo_variavel` ou tipo diferente de `modelo_sdr` e sem payout com variável): layout simplificado mostrando apenas Salário Base do cadastro do colaborador, sem OTE/Variável

### Alteração

**`src/components/meu-rh/MeuRHRemuneracaoSection.tsx`**

1. Verificar se `employee.tipo_variavel === 'modelo_sdr'` ou se existe payout com `valor_variavel_total > 0`
2. Se **não** tiver variável: mostrar card simples com apenas "Salário Base" do `employee.salario_base`, sem link para fechamento
3. Se **tiver** variável: manter o layout atual com OTE, Fixo, Variável, Total e botão "Ver detalhes"

### Resultado

Colaboradores como Emily verão apenas seu salário fixo (R$ 2.800,00) sem campos de OTE e Variável que não se aplicam ao seu modelo de remuneração.

