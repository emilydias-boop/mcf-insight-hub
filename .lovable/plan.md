

# Duplicar Pessoa para Nova Carta de Consorcio

## Objetivo
Adicionar um botao "Duplicar" na coluna de acoes de cada carta na tabela de consorcio. Ao clicar, o formulario de nova carta abre pre-preenchido com todos os dados pessoais (PF ou PJ) da carta selecionada, permitindo criar rapidamente uma nova carta para a mesma pessoa.

## Como vai funcionar

1. Um novo icone de "Copiar" aparece na coluna "Acoes" de cada linha, ao lado dos botoes existentes (Visualizar, Editar, Excluir)
2. Ao clicar, o formulario "Adicionar Cota" abre com os dados pessoais copiados
3. Campos da cota (grupo, cota, valor credito, data contratacao, etc.) ficam vazios para preenchimento
4. Campos pessoais ja vem preenchidos (nome, CPF, endereco, telefone, email, etc.)

## Campos que serao copiados

**PF**: nome_completo, cpf, rg, data_nascimento, estado_civil, cpf_conjuge, endereco completo, telefone, email, profissao, tipo_servidor, renda, patrimonio, pix

**PJ**: razao_social, cnpj, natureza_juridica, inscricao_estadual, data_fundacao, endereco comercial completo, telefone_comercial, email_comercial, faturamento_mensal, num_funcionarios

**Outros copiados**: tipo_pessoa, categoria, origem, vendedor, tipo_produto, observacoes

## Campos que NAO serao copiados (ficam em branco)
grupo, cota, valor_credito, prazo_meses, data_contratacao, dia_vencimento, parcelas_pagas_empresa, tipo_contrato, valor_comissao

## Detalhes Tecnicos

### Arquivo: `src/pages/bu-consorcio/Index.tsx`
- Adicionar novo estado `duplicatingCard` (similar ao `editingCard`)
- Criar funcao `handleDuplicateCard(card)` que monta um objeto parcial com os dados pessoais
- Adicionar botao com icone `Copy` na coluna de acoes
- Passar o card "duplicado" para o `ConsorcioCardForm` sem o `id` (para que seja tratado como criacao, nao edicao)

### Arquivo: `src/components/consorcio/ConsorcioCardForm.tsx`
- Adicionar nova prop opcional `duplicateFrom?: ConsorcioCard | null`
- Quando `duplicateFrom` esta presente (e `card` nao), o formulario abre em modo criacao mas com os campos pessoais pre-preenchidos
- O titulo do dialog mostra "Duplicar Carta" ao inves de "Nova Carta"

