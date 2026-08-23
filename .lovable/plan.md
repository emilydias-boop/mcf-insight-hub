# Rodada 0 — apresentação do funil de consórcio

## Diagnóstico somente leitura

### D1 — campos nulos em `consorcio_pending_registrations`

| Status | Total | Objetivo NULL | Vendedor NULL |
|---|---:|---:|---:|
| aguardando_abertura | 31 | 4 | 10 |
| cota_aberta | 187 | 180 | 7 |
| vinculada | 159 | 159 | 37 |
| declinada | 74 | 74 | 13 |

### D2 — campos vazios/NULL em `consortium_cards` (1.781 cotas)

| Campo | Vazios/NULL |
|---|---:|
| RG | 1.549 |
| Profissão | 1.549 |
| Renda | 1.554 |
| Patrimônio | 1.609 |
| Chave Pix (`pix`) | 1.548 |
| CEP (`endereco_cep`) | 1.548 |
| Endereço (`endereco_rua`) | 1.559 |
| Categoria NULL | 0 |

### D3 — vazios com edição posterior superior a 1 minuto

Em cadastros pendentes, contagem de registros com pelo menos um dos campos do D1 vazio e edição posterior:

| Status | Registros |
|---|---:|
| aguardando_abertura | 1 |
| cota_aberta | 181 |
| vinculada | 109 |
| declinada | 57 |

Recorte por campo: objetivo NULL/editado = 0, 180, 109 e 57; vendedor NULL/editado = 1, 7, 37 e 12, respectivamente.

Em cotas, **876** têm pelo menos um campo do D2 vazio e `updated_at > created_at + 1 minuto`. Por campo: RG 819; profissão 822; renda 824; patrimônio 865; Pix 819; CEP 818; endereço 829; categoria 0.

> Esse recorte prova que houve edição posterior, mas não prova sozinho que a edição zerou o campo: o valor pode já ter nascido vazio.

## Alterações de apresentação

1. **Alerta de inadimplência** — trocar cores literais por tokens semânticos `warning` e `destructive`, garantindo contraste de ícone, título, descrição e botão nos temas claro/escuro.
2. **Dias parados** — em `PendingRegistrationsList`, calcular a mesma idade usada pelo selo: exibir “desde hoje/desde ontem” para 0/1 dia; preservar rótulo + selo a partir de 2 dias.
3. **Drawer da cota**
   - Histórico: formatar, somente na apresentação, valores monetários contidos nas descrições para BRL pt-BR.
   - Parcelas: alinhar os chips à classificação visual da lista, contando pagas e todas as parcelas exibidas como pendentes.

## Arquivos previstos

- `src/components/consorcio/InadimplenciaAlert.tsx`
- `src/components/consorcio/PendingRegistrationsList.tsx`
- `src/components/consorcio/CardActivityHistoryTab.tsx`
- `src/components/consorcio/InstallmentsPaginated.tsx`

Nenhum hook, query, schema, migration, escrita no banco ou outra tela será alterado.
