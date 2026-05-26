## Objetivo

Transformar a aba **Cadastros Pendentes** (`/consorcio` → tab "Cadastros Pendentes") em um painel rico de gestão: mostrar tudo que o controle precisa decidir sem abrir o cadastro, incluir tooltip detalhado das parcelas que a empresa vai pagar, agrupar múltiplas cotas destinadas à mesma pessoa, e dar três ações claras: **Ver Detalhes**, **Vincular a cota existente**, **Excluir**.

---

## 1. Schema (migração)

Adicionar campos no `consorcio_pending_registrations` para capturar já no Aceite da Proposta o que hoje só é definido na abertura:

- `empresa_paga_parcelas` (text: 'sim'/'nao') — já existe, vai passar a ser preenchido no Aceite
- `tipo_contrato` (text: 'normal' | 'intercalado' | 'intercalado_impar') — já existe
- `parcelas_pagas_empresa` (integer) — já existe
- `valor_credito` (numeric) — já existe (vem da proposta)

Não precisa criar coluna nova; só passar a preencher esses campos na hora do Aceite.

Para o status "vinculada":
- Adicionar valor `'vinculada'` ao check do campo `status` (se existir constraint).
- `consortium_card_id` já existe e será usado para apontar para a cota vinculada.

## 2. AcceptProposalModal — capturar parcelas já no aceite

Acrescentar uma seção **"Parcelas que a empresa pagará"** no `AcceptProposalModal.tsx`, com:

- Switch "Empresa paga parcelas?" (sim/não)
- Quando sim: select `tipo_contrato` (Normal / Intercalado par / Intercalado ímpar) e input numérico `parcelas_pagas_empresa`
- Esses valores entram no `createRegistration.mutateAsync`.

Esses mesmos campos no `OpenCotaModal` ficam pré-preenchidos (já editáveis).

## 3. Hook `usePendingRegistrations` — enriquecer payload

Estender o `SELECT` para trazer e calcular:

- Deal: `origin:crm_origins(name, display_name)`, `owner:profiles(name)` (closer), `original_sdr_email` → resolver via `profiles` para nome do SDR
- Calcular **origem formatada**: `"<origin.display_name> · <mes/ano da aceite_date>"` (ex: "Parceiro Y · Nov/2025")
- Buscar **cotas existentes** do mesmo CPF/CNPJ em `consortium_cards` (group by) para devolver `cotas_existentes_count`
- Agrupar **pendentes do mesmo CPF/CNPJ** para devolver `parte_atual` e `total_destinado` (ex: 1 de 2, 2 de 2) — usando ordem por created_at
- Calcular **valor_total_empresa** e o array de parcelas que serão pagas (números das parcelas + valor unitário = valor_credito/prazo_meses), reaproveitando a mesma lógica de `useOpenCota` (intercalado par/ímpar/normal)
- Calcular o **`valor_credito` da cota** vindo de `consorcio_proposals` se o pending ainda não tiver

## 4. PendingRegistrationsList — nova tabela

Substituir as colunas atuais por:

| Coluna | Fonte |
|---|---|
| Origem | `origin.display_name · Mês/Ano` |
| Nome / Razão Social | nome_completo / razao_social (+ socios para PJ no subtítulo) |
| CPF / CNPJ | já existe |
| Valor da Cota | `valor_credito` formatado em BRL |
| Parcelas (empresa) | Badge com resumo ("2 de 200 · Intercalado par") + **Tooltip** ao hover listando cada parcela nº e valor individual |
| Valor Total Empresa | soma das parcelas tipo='empresa' |
| Closer | nome do dono do deal |
| SDR | nome resolvido do `original_sdr_email` |
| Cotas Existentes | badge mostrando contagem de `consortium_cards` com mesmo CPF |
| Quantidade Destinada | "1 de N" quando houver outros pendentes do mesmo CPF |
| Data Solicitada | `aceite_date` (ou `created_at` como fallback) |
| Ações | menu com 3 botões |

Tooltip usar `Tooltip`/`HoverCard` do shadcn já no projeto.

## 5. Ações (substituem o botão único "Abrir Cadastro")

DropdownMenu por linha:

1. **Abrir Cadastro** — abre `OpenCotaModal` atual (mantém função)
2. **Ver Detalhes** — abre `OpenCotaModal` em modo `readOnly` (novo prop): esconde botões de submit, desabilita inputs, exibe apenas leitura. Reusa o componente.
3. **Vincular a Cota Existente** — abre novo modal `LinkExistingCotaModal`:
   - Lista as cotas (`consortium_cards`) com mesmo CPF/CNPJ (e busca livre por nome/grupo/cota como fallback).
   - Ao confirmar:
     - `UPDATE consorcio_pending_registrations SET status='vinculada', consortium_card_id=<id>`
     - `UPDATE consortium_documents SET card_id=<id>, pending_registration_id=NULL WHERE pending_registration_id=<reg>` (migrar docs)
     - Toast e invalida queries
4. **Excluir Cadastro** — `AlertDialog` de confirmação → `DELETE` do pending registration (mantendo o `crm_deal` intacto). Toast.

Filtro padrão da lista passa a ser `status IN ('aguardando_abertura')`. Pendentes vinculados/excluídos somem.

## 6. Detalhes técnicos

- **Performance**: o `useQuery` faz uma única chamada `consorcio_pending_registrations` + um `select` paralelo em `consortium_cards` (apenas `cpf, cnpj, id` filtrando pelos documentos presentes na lista) para montar o mapa de `cotas_existentes_count` e a busca do "Vincular".
- **Cálculo de parcelas-empresa** extraído de `useOpenCota` para um helper puro `src/lib/consorcioParcelasEmpresa.ts` (`getParcelasEmpresa({ prazo, parcelas_pagas_empresa, tipo_contrato, valor_credito })` → `Array<{numero, valor}>`). Reaproveitado tanto no list quanto na geração real ao Abrir Cadastro.
- **Origem formatada** num helper `src/lib/consorcioOrigemLabel.ts` (`formatOrigem(displayName, aceiteDate)` → "Parceiro X · Nov/2025") usando `date-fns` + locale ptBR.
- **Modo readOnly** no `OpenCotaModal`: novo prop `mode?: 'open' | 'view'`. Quando `'view'`, todos os inputs ganham `disabled`, o botão de submit some, título muda para "Detalhes do Cadastro".

## 7. Arquivos afetados

```text
NOVO  src/lib/consorcioParcelasEmpresa.ts
NOVO  src/lib/consorcioOrigemLabel.ts
NOVO  src/components/consorcio/LinkExistingCotaModal.tsx
EDIT  src/components/consorcio/PendingRegistrationsList.tsx
EDIT  src/components/consorcio/OpenCotaModal.tsx          (modo view, parcelas pré-preenchidas)
EDIT  src/components/consorcio/AcceptProposalModal.tsx    (capturar parcelas no aceite)
EDIT  src/hooks/useConsorcioPendingRegistrations.ts       (enriquecer query + actions delete/link)
MIG   permitir status='vinculada' em consorcio_pending_registrations
```

## 8. Fora de escopo

- Não muda fluxo da aba "Cotas".
- Não muda regras de comissão.
- Não toca em CRM / Pipelines / agenda.
