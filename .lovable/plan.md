# Investigação — os 47 "contratos órfãos" de setembro/2026 tiveram reunião?

Somente leitura, nada escrito no banco, nada publicado. Universo: as 47 transações Hubla A000/CONTRATO pagas em 01–30/09/2026 sem caução/reunião vinculada (as que hoje viram o "s/ICP 47" do card CONTRATOS).

## Resposta curta

**Dos 47, apenas 6 não têm reunião nenhuma — e 41 têm.** O problema não é venda fora do funil: é **vínculo quebrado**. 36 delas têm R1 **no próprio mês**, com closer identificado e attendee já em `completed`/`contract_paid`.

| balde | significado | qtd |
|---|---|---|
| **A** | tem R1 dentro de 01–30/09 — vínculo falhou, reunião existe | **36** |
| **B** | tem R1 antes de 01/09 — lead antigo, reunião existe | **4** |
| **C** | tem reunião, mas só R2 / outro tipo | **1** |
| **D** | pessoa existe no CRM, mas sem reunião em lugar nenhum | **2** |
| **E** | pessoa não encontrada no CRM por nenhum dos 5 critérios | **4** |

Critério de casamento usado, na ordem pedida: documento (só dígitos) → e-mail (minúsculas/trim) → telefone (últimos 9 dígitos) → nome completo normalizado → dois primeiros nomes. Busca em `crm_contacts` → `crm_deals` → `meeting_slot_attendees` **sem filtro de data e sem filtro de `meeting_type`**.

Observação relevante: `hubla_transactions.customer_document` só está preenchido em 8 das 47 e não casou com `meeting_slot_attendees.cpf` em nenhuma — na prática o **e-mail** foi o critério dominante (32 casos), telefone (5), nome/dois-nomes (4).

## Balde A — 36 casos (tem R1 em setembro)

Formato: cliente | valor | data da venda | critério | nº de deals casados | deal_id (8 primeiros) | reunião | status | closer

```text
Felipe ramos | R$ 460,76 | 01/09 | DOIS-NOMES (frágil) | 1 | 800f50f3 | r1 01/09 contract_paid | William Ferreira
Felipe ramos | R$ 0,00    | 01/09 | DOIS-NOMES (frágil) | 1 | 800f50f3 | r1 01/09 contract_paid | William Ferreira
Gustavo Martins da Silva | R$ 241,53 | 01/09 | e-mail | 1 | a52d3535 | r1 02/09 completed | William Ferreira
Vinicius siqueira de souza | R$ 241,53 | 01/09 | e-mail | 1 | 34074fba | r1 04/09 contract_paid | Mayara Souza
Delômines Antônio Santos souza | R$ 241,53 | 01/09 | e-mail | 1 | a40ed04a | r1 02/09 completed | Julio
Douglas Henrique Marques | R$ 241,53 | 01/09 | e-mail | 2 (AMBÍGUO) | 22ce728f | r1 10/09 completed | Rodrigo dos Santos Martinho
ROBSON MOTTA DE CARVALHO | R$ 241,53 | 01/09 | e-mail | 2 (AMBÍGUO) | 9468fe24 | r1 11/09 completed | Bruno de Souza Albuquerque
DANIEL APARECIDO AUGUSTO DE JESUS | R$ 241,53 | 01/09 | e-mail | 1 | 2ab167f9 | r1 05/09 completed | João Pedro Martins Vieira
Ana Inês Varnier | R$ 241,53 | 01/09 | e-mail | 1 | 3a76ef90 | r1 03/09 completed | Mayara Souza
Márllia Kesia Gonçalves de Souza | R$ 241,53 | 01/09 | e-mail | 2 (AMBÍGUO) | baca3af2 | r1 11/09 completed | Bruno de Souza Albuquerque
Kléber Valente de Lima | R$ 241,53 | 01/09 | e-mail | 1 | d010c3cf | r1 04/09 completed | João Pedro Martins Vieira
Samuel Anderson Silva de Carvalho Amorim | R$ 241,53 | 02/09 | e-mail | 1 | eb9703c1 | r1 02/09 contract_paid | Mayara Souza
Sidney Ferreira da Silva | R$ 241,53 | 02/09 | e-mail | 2 (AMBÍGUO) | 9a9f1ee4 | r1 01/09 contract_paid | Julio
RONAN NAVES DY SIQUEIRA E SILVA | R$ 241,53 | 02/09 | e-mail | 2 (AMBÍGUO) | 3c169c5b | r1 02/09 contract_paid | Mayara Souza
JOAO BATISTA NETO | R$ 241,53 | 02/09 | e-mail | 8 (AMBÍGUO) | 38027724 | r1 14/09 rescheduled | Jessica Bellini
Genilson Ferreira De Araújo | R$ 241,53 | 02/09 | e-mail | 1 | d3c34b72 | r1 02/09 completed | William Ferreira
Jorge Lima Ribeiro | R$ 241,53 | 02/09 | e-mail | 2 (AMBÍGUO) | edef8241 | r1 01/09 contract_paid | Julio
Mônica Moura | R$ 241,53 | 02/09 | telefone | 1 | 0faee7fb | r1 02/09 contract_paid | Mayara Souza
Lucas santos valente | R$ 241,53 | 03/09 | e-mail | 2 (AMBÍGUO) | cef9927b | r1 03/09 contract_paid | Mayara Souza
Alex SANTIAGO MARCOLINO | R$ 241,53 | 03/09 | e-mail | 1 | de9e7674 | r1 03/09 contract_paid | Mayara Souza
Douglas henrique marques da silva | R$ 241,53 | 03/09 | e-mail | 2 (AMBÍGUO) | 22ce728f | r1 10/09 completed | Rodrigo dos Santos Martinho
MARCOS CAGLIARI | R$ 0,00 | 03/09 | telefone | 2 (AMBÍGUO) | 4b2bff1b | r1 04/09 completed | Mayara Souza
Carlos Cesar Silva Siriano | R$ 241,53 | 04/09 | e-mail | 3 (AMBÍGUO) | adbd82f2 | r1 04/09 contract_paid | Rodrigo dos Santos Martinho
DOUGLAS HENRIQUE DE FARIA ALVES | R$ 241,53 | 08/09 | telefone | 2 (AMBÍGUO) | 22ce728f | r1 10/09 completed | Rodrigo dos Santos Martinho
Francisco edivaldo pereira de Oliveira | R$ 241,53 | 08/09 | e-mail | 1 | a80d1c17 | r1 09/09 completed | Rodrigo dos Santos Martinho
gilson marcelo santos | R$ 241,53 | 08/09 | e-mail | 1 | 6f77c9f2 | r1 09/09 completed | Julio
Gean Franco Ramos dos Santos | R$ 241,53 | 08/09 | e-mail | 2 (AMBÍGUO) | 24ac4735 | r1 08/09 contract_paid | Rodrigo dos Santos Martinho
Daniel Dias | R$ 241,53 | 08/09 | e-mail | 1 | c63a31e0 | r1 14/09 invited | Julio
Antonio Marcos Tavares da Costa Júnior | R$ 241,53 | 08/09 | e-mail | 4 (AMBÍGUO) | dcd81a29 | r1 08/09 contract_paid | Rodrigo dos Santos Martinho
OTACILIO GENEROSO DA SILVA JUNIOR | R$ 241,53 | 08/09 | e-mail | 2 (AMBÍGUO) | 08956ede | r1 11/09 completed | Julio
Ranye Gomes | R$ 241,53 | 08/09 | e-mail | 1 | 840d9480 | r1 10/09 completed | Rodrigo dos Santos Martinho
Valmir Fernandes do Nascimento | R$ 241,53 | 08/09 | e-mail | 1 | ff5d1c89 | r1 08/09 contract_paid | Rodrigo dos Santos Martinho
Paulo Henrique Martins Pires | R$ 241,53 | 08/09 | e-mail | 15 (AMBÍGUO) | b46aa2dd | r1 09/09 completed | Rodrigo dos Santos Martinho
Miguel Alonzo Barrios | R$ 241,53 | 09/09 | telefone | 2 (AMBÍGUO) | ec426064 | r1 09/09 contract_paid | Rodrigo dos Santos Martinho
Patrícia Goveia | R$ 241,53 | 09/09 | e-mail | 1 | 93265f7c | r1 14/09 invited | Julio
Wénnedy Josavias Carneiro Sousa Silva | R$ 241,53 | 09/09 | e-mail | 1 | dd524e95 | r1 09/09 contract_paid | Rodrigo dos Santos Martinho
```

## Balde B — 4 casos (R1 antes de 01/09)

```text
Eduardo Henrique Oliveira | R$ 30,06  | 03/09 | telefone            | 2 (AMBÍGUO) | 43e447b0 | r1 09/04 completed      | Mateus Macedo
KLEBER XAVIER DE LIMA     | R$ 241,53 | 08/09 | telefone            | 1           | ed1a6591 | r1 13/06 contract_paid  | Julio
WILLIAM MENEZES           | R$ 30,06  | 11/09 | NOME (frágil)       | 1           | 6e6656bb | r1 12/05 contract_paid  | Thayna
Carlos Aparecido Cordeiro dos Santos | R$ 482,09 | 11/09 | DOIS-NOMES (frágil) | 2 (AMBÍGUO) | 70f44926 | r1 13/08 completed | João Pedro Martins Vieira
```

## Balde C — 1 caso (só R2)

```text
Paulo Geraldo Cavalcante Passos Neto | R$ 241,53 | 08/09 | e-mail | 1 | 18d0bccc | r2 14/09 invited | Jessica Martins
```

## Balde D — 2 casos (pessoa no CRM, sem reunião nenhuma)

```text
Humberto Cardoso de Souza | R$ 241,53 | 09/09 | casou por e-mail, telefone e nome em crm_contacts/crm_deals; nenhum attendee
Carlos Acacio Corrêa      | R$ 36,11  | 11/09 | casou por e-mail e telefone; nenhum attendee
```

## Balde E — 4 casos (pessoa não achada no CRM)

```text
SADI AMANCIO BEZ BATTI           | R$ 482,09 | 01/09
Helena Mondardo Cardoso Pissetti | R$ 482,09 | 03/09
Cândido Osvaldo de Moura         | R$ 388,10 | 06/09
Cândido Osvaldo de Moura         | R$ 0,00   | 06/09
```

## Ressalvas honestas

- **Casamento frágil:** 4 linhas casaram só por nome ou dois primeiros nomes (Felipe ramos ×2, WILLIAM MENEZES, Carlos Aparecido Cordeiro dos Santos). Homônimo é possível — trate essas 4 como "provável", não como fato.
- **Ambíguos:** em 19 casos o mesmo cliente casou com mais de um negócio no CRM (até 15 no caso Paulo Henrique Martins Pires). Não escolhi nenhum: o `deal_id` mostrado é só o do attendee mais recente com R1; o número de deals casados está na coluna. Para esses, atribuição automática não é segura sem regra de desempate.
- **Documento não serve como chave hoje:** `customer_document` preenchido em 8 de 47 e zero casamentos contra `meeting_slot_attendees.cpf`.
- **Valor:** 41 das 47 têm valor R$ 241,53, R$ 30,06, R$ 0,00 ou R$ 482,09 — padrão de **parcela/entrada**, não de contrato cheio. NÃO DETERMINADO se essas transações deveriam contar como "contrato" no painel; isso depende da regra de produto (A000 parcelado) e não foi verificado aqui.

## Conclusão para o painel

**Sem reunião de fato: 6 (baldes D + E)** — e destes, 4 nem existem no CRM. Se a linha "contrato sem reunião" for criada, ela vale **6**, não 47. Os outros **41** são vínculo quebrado entre `hubla_transactions` e `meeting_slot_attendees`: a reunião existe, o closer existe, e em 21 casos o attendee já está `contract_paid`. Rotulá-los como "sem reunião" tiraria crédito de gente que trabalhou — o conserto certo é de vínculo (por e-mail/telefone), não de rótulo.

## Se você quiser prosseguir (nada feito)

1. Backfill de `linked_deal_id`/`linked_attendee_id` por e-mail exato para as 32 linhas de casamento forte não ambíguo — em dry-run primeiro.
2. Tratar as 19 ambíguas e as 4 por nome manualmente, uma a uma.
3. Só depois criar a linha "sem reunião" no painel, com o número real (hoje 6).
4. Investigar se transações de R$ 241,53 / R$ 30,06 devem contar como contrato — decidir a régua antes de mexer no card.
