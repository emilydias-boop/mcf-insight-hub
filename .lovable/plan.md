## Objetivo

Corrigir os deals do lançamento 29/07 (oferta `nPPUxJUzDl5mfa31XpIU`) que não receberam a tag **Outside** nem a etapa **Contrato Pago**, incluindo `adrianodamasio71@gmail.com` e `flavio.leandro@icloud.com`, e deixar uma rotina reaproveitável para que sobras assim sejam corrigidas sem intervenção manual.

## O que foi verificado

- Adriano Damazio: contato existe, **sem deal algum**. Sem R1, sem produto de parceiro.
- Flavio Leandro: deal em PIPELINE INSIDE SALES em **"Sem Interesse"**, tags `[ANAMNESE]`, sem Outside. Sem R1. A compra "Sócio MCF" (2025) não desqualifica.
- Ambos compraram antes do deploy da correção do fluxo Outside — o webhook atual já trataria os dois casos corretamente.
- Restam ainda 3 outros compradores do mesmo lançamento em situação parecida (`eng.geffersonfirmino@gmail.com`, `pcamposn@gmail.com` — deals localizáveis por sufixo de telefone — e `rzatto@uol.com.br`, em outra etapa).

## O que será feito

1. **Correção de Flavio Leandro**
   - Adicionar tag `Outside` (mantendo `ANAMNESE`), mover para a etapa **Contrato Pago** da Inside Sales, registrar `contract_paid_at` com a data da venda (29/07) e vincular as transações Hubla ao deal (`linked_deal_id`).
   - Registrar atividade no deal explicando a correção retroativa.

2. **Correção de Adriano Damazio**
   - Criar deal em PIPELINE INSIDE SALES para o contato existente, etapa **Contrato Pago**, tags `Outside` + `Hubla`, distribuído via `get_next_lead_owner`, vincular as transações Hubla e registrar atividade.

3. **Sweep dos demais compradores do lançamento**
   - Rodar a mesma reconciliação para os outros compradores de ofertas ativas em `outside_offers` desde 25/07 que não tenham tag Outside, respeitando as regras de desqualificação (R1 existente, produtos de parceiro A001–A009/INCORPORADOR/ANTICRISE, contratos CLS) e a deduplicação por e-mail e por sufixo de 9 dígitos do telefone.
   - Casos com deal em pipeline diferente da Inside Sales (ex.: Rodrigo/`rzatto@uol.com.br`) serão listados para conferência antes de qualquer alteração, para não mover lead de BU sem intenção.

4. **Rotina de conferência reaproveitável**
   - Criar uma função no banco que devolve os compradores de ofertas Outside sem tag/etapa correspondente, para permitir uma checagem periódica rápida quando novas ofertas de lançamento forem criadas.

## Detalhes técnicos

- Nenhuma mudança de regra de negócio: o webhook `hubla-webhook-handler` já resolve ofertas via `outside_offers` (nome ou `offer_id`) e já cria/distribui deal quando não há R1. Aqui é apenas recuperação de dados anteriores ao deploy.
- A etapa de destino é resolvida por `ilike '%Contrato Pago%'` na origin `PIPELINE INSIDE SALES` (match exato de nome, sem `LEAD GRATUITO`).
- Toda alteração de deal gera linha em `deal_activities` com `trigger: 'outside_backfill_lancamento_2907'` para auditoria.
