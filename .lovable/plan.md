

# Fluxo Completo: Aceite de Proposta com Cadastro Obrigatorio e Abertura de Cota

## Resumo do Fluxo

```text
CRM Pos-Reuniao                    Controle Consorcio
-----------------                  -------------------
Closer clica "Aceite"              
    |                              
Modal obrigatorio abre             
    |                              
Closer preenche dados              
do cliente + documentos            
    |                              
"Confirmar e Enviar"               
    |                              
    +----> Cadastro Pendente ----> Gestor abre cadastro
                                       |
                                   Visualiza dados (read-only)
                                       |
                                   Preenche "Dados da Cota"
                                   (mesmos campos do formulario
                                    "Nova Carta de Consorcio")
                                       |
                                   "Confirmar Abertura da Cota"
                                       |
                                   Cota criada no Controle Consorcio
```

## O que muda em relacao ao plano anterior

O gestor, ao abrir o cadastro pendente, preenche **exatamente os mesmos campos** da aba "Dados da Cota" do formulario "Nova Carta de Consorcio" existente. Sao eles:

- Categoria (Inside/Life)
- Grupo e Cota
- Valor do Credito e Prazo
- Produto Embracon e Condicao de Pagamento
- Seguro de Vida (switch)
- Composicao da parcela (calculada automaticamente)
- Empresa paga parcelas? (+ tipo contrato + quantidade)
- Dia de Vencimento e Inicio da 2a Parcela
- Data de Contratacao e Origem
- Detalhe da Origem e Vendedor Responsavel
- Valor da Comissao, E Transferencia, Observacoes

---

## Parte 1 - Migration SQL

### Nova tabela: `consorcio_pending_registrations`

Armazena dados do cliente (preenchidos pelo closer) e dados da cota (preenchidos pelo gestor).

Campos do closer (obrigatorios):
- tipo_pessoa (pf/pj)
- PF: nome_completo, rg, cpf, cpf_conjuge, profissao, telefone, email, endereco (completo + CEP separado), renda, patrimonio, pix
- PJ: razao_social, cnpj, natureza_juridica, inscricao_estadual, data_fundacao, telefone_comercial, email_comercial, endereco_comercial (completo + CEP), num_funcionarios, faturamento_mensal, socios (JSONB)
- proposal_id, deal_id, vendedor_name, aceite_date, created_by

Campos do gestor (preenchidos na abertura):
- categoria, grupo, cota, valor_credito, prazo_meses
- tipo_produto, produto_codigo, condicao_pagamento, inclui_seguro
- empresa_paga_parcelas, tipo_contrato, parcelas_pagas_empresa
- dia_vencimento, inicio_segunda_parcela
- data_contratacao, origem, origem_detalhe
- vendedor_id, vendedor_name_cota
- valor_comissao, e_transferencia, transferido_de, observacoes
- consortium_card_id (preenchido apos abertura)

Status: `aguardando_abertura` | `cota_aberta`

### Coluna adicional em `consortium_documents`
- `pending_registration_id` (uuid, nullable) - para vincular documentos antes da cota existir

### RLS
- Closers podem inserir e ler seus proprios registros
- Admin/manager/coordenador podem ler e atualizar todos

---

## Parte 2 - Modal do Closer: `AcceptProposalModal.tsx`

Novo componente que abre quando o closer clica "Aceite" na PropostasTab.

### Campo inicial
- Tipo de Pessoa (PF / PJ) - controla quais campos aparecem

### Campos PF (obrigatorios)
- Nome completo, RG, CPF (validado), CPF conjuge (opcional), Profissao
- Telefone (mascara), Email (validado)
- CEP (auto-preenchimento via BrasilAPI existente) + Endereco completo
- Renda, Patrimonio, Chave PIX
- Upload obrigatorio: RG ou CNH (PDF)

### Campos PJ (obrigatorios)
- Razao Social, CNPJ (validado + auto-preenchimento via BrasilAPI existente)
- Natureza Juridica, Inscricao Estadual, Data Fundacao
- Telefone Comercial, Email Comercial
- CEP + Endereco Comercial
- Num Funcionarios, Faturamento Mensal
- Socios (lista dinamica com CPF + Renda)
- Uploads obrigatorios: Contrato Social, RG/CNH socios, Cartao CNPJ

### Validacao
- Zod schema com campos obrigatorios conforme tipo de pessoa
- CPF/CNPJ validados com funcoes existentes em `documentUtils.ts`
- CEP auto-preenchido com funcao existente em `cepUtils.ts`
- Mascaras de formatacao reutilizadas do `ConsorcioCardForm.tsx`

### Botao: "Confirmar e Enviar para Controle Consorcio"
- Salva na tabela `consorcio_pending_registrations`
- Faz upload dos documentos com `pending_registration_id`
- Atualiza proposta status para 'aceita'

---

## Parte 3 - Hook: `useConsorcioPendingRegistrations.ts`

- `useCreatePendingRegistration()`: insere dados + upload docs + atualiza proposta
- `usePendingRegistrations()`: lista todos com status 'aguardando_abertura'
- `usePendingRegistration(id)`: busca um registro especifico
- `useOpenCota()`: cria consortium_card, gera parcelas, migra documentos, atualiza status

---

## Parte 4 - Nova aba "Cadastros Pendentes" no Controle Consorcio

### Local: `src/pages/bu-consorcio/Index.tsx`

Adicionar sistema de abas no topo:
- **Cotas** (conteudo atual - listagem de cotas)
- **Cadastros Pendentes** (novo)

### Tabela de Cadastros Pendentes
Colunas: Nome/Razao Social | CPF/CNPJ | Tipo Pessoa | Telefone | Vendedor | Data Aceite | Status
- Botao "Abrir Cadastro" em cada linha

---

## Parte 5 - Modal do Gestor: `OpenCotaModal.tsx`

### Secao superior (read-only)
Exibe todos os dados preenchidos pelo closer:
- Dados pessoais/empresa, contato, endereco, financeiro
- Lista de documentos enviados (com link para visualizar)

### Secao inferior (formulario - Dados da Cota)
Exatamente os mesmos campos da aba "Dados da Cota" do `ConsorcioCardForm.tsx`:
- Categoria, Grupo, Cota
- Valor do Credito, Prazo (meses)
- Produto Embracon (auto-detectar ou manual)
- Condicao de Pagamento (Convencional / Mais por Menos 50% / 25%)
- Seguro de Vida (switch)
- Composicao da parcela (calculada automaticamente com `ParcelaComposicao`)
- Empresa paga parcelas? (+ Tipo Contrato + Quantidade)
- Dia de Vencimento, Inicio da 2a Parcela
- Data de Contratacao, Origem, Detalhe da Origem
- Vendedor Responsavel
- Valor da Comissao, E Transferencia?, Transferido de, Observacoes

### Botao: "Confirmar Abertura da Cota"
Executa:
1. Cria `consortium_card` com dados do cliente + cota
2. Gera parcelas automaticamente (reutiliza logica existente)
3. Migra documentos de `pending_registration_id` para `card_id`
4. Atualiza `consorcio_pending_registrations` status = 'cota_aberta'
5. Atualiza `consorcio_proposals` com `consortium_card_id`

---

## Parte 6 - Modificar PosReuniao.tsx

No botao "Aceite" da PropostasTab (linha 345-351):
- Antes: chama `confirmarAceite.mutate()` diretamente
- Depois: abre o `AcceptProposalModal` com os dados da proposta

---

## Parte 7 - Status do Fluxo

```text
Proposta Enviada   -> status='pendente' em consorcio_proposals
Proposta Aceita    -> modal do closer abre
Cadastro Preenchido -> pending_registration criado, status='aguardando_abertura'
Aguardando Abertura -> visivel na aba Cadastros Pendentes
Cota Aberta        -> consortium_card criado, status='cota_aberta'
```

---

## Arquivos a Criar

1. `supabase/migrations/XXXX_consorcio_pending_registrations.sql` - tabela + RLS
2. `src/components/consorcio/AcceptProposalModal.tsx` - formulario do closer
3. `src/components/consorcio/OpenCotaModal.tsx` - formulario do gestor
4. `src/components/consorcio/PendingRegistrationsList.tsx` - tabela de cadastros pendentes
5. `src/hooks/useConsorcioPendingRegistrations.ts` - mutations e queries

## Arquivos a Modificar

1. `src/pages/crm/PosReuniao.tsx` - trocar aceite direto por modal
2. `src/pages/bu-consorcio/Index.tsx` - adicionar aba Cadastros Pendentes
3. `src/hooks/useConsorcioPostMeeting.ts` - ajustar mutation de aceite

## Regras Obrigatorias

- Nao e possivel enviar para controle sem cadastro completo (validacao zod)
- Nao e possivel abrir cota sem dados obrigatorios do gestor (validacao zod)
- Documentos ficam vinculados ao cadastro e migram para a cota
- Dados do cliente nao precisam ser digitados novamente pelo gestor
