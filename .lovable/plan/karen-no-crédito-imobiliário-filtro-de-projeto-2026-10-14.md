# Karen no Crédito Imobiliário + filtro de projeto

## Parte 1: liberar a PIPELINE CRÉDITO IMOBILIÁRIO para a Karen
### O que achei
- Karen (karen.nazario@minhacasafinanciada.com) tem os cargos SDR e Gerente de Relacionamento. No cadastro de SDR o squad dela é só `pos_venda`, e ela não tem nenhuma pipeline liberada individualmente.
- A pipeline tem 16 etapas, de Parceiros 50k a Perdido. Nenhuma delas tem bloqueio para os cargos dela, e etapa sem regra aparece por padrão.
- Ou seja, a pipeline não aparece porque não está liberada para ela. As etapas não são o problema.

### O que vou fazer (só para a Karen)
1. Guardar um backup do cadastro de SDR dela, que só admin consegue ler.
2. Liberar para ela a pipeline do Pós Venda, que ela já usa, e a PIPELINE CRÉDITO IMOBILIÁRIO. Essa liberação substitui o padrão da área, por isso o Pós Venda entra junto.
3. Não mudo cargo, squad, regras de etapa nem nada de outros colaboradores.
4. Conferir se ela vê todos os clientes da pipeline ou só os que estão com ela. Se for só os dela, eu te aviso antes de mexer.

## Parte 2: filtro "Projeto" na tela de Negócios
Hoje os clientes dessa pipeline estão assim:
- Sem projeto (pré-análise): 43
- Possui projeto aprovado: 4
- Sem interesse no momento: 3
- Sem informação: 3

O que muda na tela:
- Novo seletor "Projeto" ao lado dos outros filtros, com as opções: Todos, Sem projeto, Projeto aprovado, Sem interesse e Sem informação.
- O filtro funciona em qualquer pipeline, mas só faz sentido nas que recebem clientes vindos da Admissão.
- Ele só esconde e mostra cards na tela. Nenhum dado é alterado.

## Detalhes técnicos
- Parte 1: `sdr.allowed_origin_ids` = [POS_VENDA_ORIGIN_ID, 'c4ed1700-0000-4000-8000-000000000002'] em `sdr.id = 86880ed1-…139`, com backup antes. A alteração é de dados, não de estrutura.
- Parte 2: o filtro lê `custom_fields.admissao.projeto_status` (`quer_pre_analise` | `aprovado` | `nenhum` | nulo). Ele entra no estado de filtros de `src/pages/crm/Negocios.tsx`, segue o padrão dos seletores que já existem e fica só no navegador, sem migração.
