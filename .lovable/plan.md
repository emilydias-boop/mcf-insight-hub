

## Plano: Mostrar valor sugerido da NFSe para PJ com salario fixo

### Problema

Colaboradores PJ que nao sao SDR/Closer (sem fechamento calculado) precisam digitar o valor da NFSe manualmente no modal do Meu RH, sem saber qual valor a empresa espera.

### Solucao

No `EnviarNfseModal`, receber o `salario_base` do colaborador como prop e pre-preencher o campo "Valor da NFSe" com esse valor, permitindo edicao.

### Alteracoes

**1. `src/components/meu-rh/EnviarNfseModal.tsx`**
- Adicionar prop opcional `valorSugerido?: number`
- Inicializar `valorNfse` com `valorSugerido` formatado (ex: "4000,00") quando fornecido
- Exibir label auxiliar abaixo do campo: "Valor sugerido com base no seu salario: R$ X.XXX,XX"

**2. `src/components/meu-rh/MeuRHNfseSection.tsx`**
- Passar `valorSugerido={employee.salario_base}` ao `EnviarNfseModal`

### Resultado

O colaborador PJ abre o modal e ja ve o campo preenchido com seu salario base. Pode editar se necessario (ajustes, bonus, etc.), mas nao precisa adivinhar o valor.

