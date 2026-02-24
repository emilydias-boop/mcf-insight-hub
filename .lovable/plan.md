

## Tornar os Dados do Cliente editaveis no OpenCotaModal

### Problema

O modal "Abertura de Cota" exibe os dados do cliente como texto somente leitura (linhas 181-194 do OpenCotaModal.tsx). Quando os registros foram criados sem passar pelo fluxo completo do AcceptProposalModal, campos como CPF, RG, Profissao, Endereco, CEP, Renda, Patrimonio e PIX ficam vazios e nao podem ser preenchidos.

### Solucao

Modificar o `OpenCotaModal` para que a secao "Dados do Cliente" use campos de input editaveis (em vez de texto estatico) quando os valores estiverem vazios. Ao submeter o formulario, esses dados serao salvos junto com os dados da cota.

### Alteracoes

**`src/components/consorcio/OpenCotaModal.tsx`**

1. Adicionar campos de formulario ao `useForm` para os dados do cliente PF: `nome_completo`, `cpf`, `rg`, `profissao`, `telefone`, `email`, `endereco_completo`, `endereco_cep`, `renda`, `patrimonio`, `pix`

2. Substituir a secao read-only "Dados do Cliente" (linhas 176-243) por campos de input pre-preenchidos com os dados existentes do registration. Os campos que ja tem valor aparecerao preenchidos mas editaveis; os vazios aparecerao em branco para preenchimento.

3. Usar `useEffect` para popular os campos do formulario quando o `registration` carregar:
```
useEffect(() => {
  if (registration) {
    form.setValue('cliente_nome', registration.nome_completo || '');
    form.setValue('cliente_cpf', registration.cpf || '');
    form.setValue('cliente_rg', registration.rg || '');
    // ... demais campos
  }
}, [registration]);
```

4. No `onSubmit`, incluir os dados do cliente no payload enviado ao `useOpenCota`, que ja recebe o `registration` e pode fazer UPDATE na tabela `consorcio_pending_registrations` antes de criar a cota.

**`src/hooks/useConsorcioPendingRegistrations.ts`** (hook `useOpenCota`)

5. Modificar a mutation `useOpenCota` para aceitar dados do cliente atualizados no payload e fazer um UPDATE na tabela `consorcio_pending_registrations` com os campos do cliente antes de prosseguir com a criacao da cota em `consortium_cards`.

### Fluxo resultante

1. Gestor abre "Abertura de Cota" para Kleber Donizetti
2. Ve os campos pre-preenchidos (Nome, Telefone, Email) e os campos vazios (CPF, RG, etc.)
3. Preenche os campos faltantes
4. Preenche os dados da cota (Categoria, Grupo, Valor, etc.)
5. Clica em "Abrir Cota"
6. O sistema salva os dados do cliente e cria a cota normalmente

### Detalhes tecnicos

- Os campos do cliente serao adicionados ao mesmo `useForm` existente, com prefixo `cliente_` para nao conflitar com os campos da cota
- Campos obrigatorios: `cliente_nome`, `cliente_cpf`, `cliente_telefone`, `cliente_email`
- Campos opcionais: `cliente_rg`, `cliente_profissao`, `cliente_endereco_completo`, `cliente_endereco_cep`, `cliente_renda`, `cliente_patrimonio`, `cliente_pix`
- Reutilizar as funcoes de formatacao (`formatCpf`, `formatPhone`, `formatCep`) ja existentes no `AcceptProposalModal`
