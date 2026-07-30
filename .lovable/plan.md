## Diagnóstico (verificado no banco)

A oferta `nPPUxJUzDl5mfa31XpIU` chega como **offer_name = "Contrato - Lançamento 29/07"** (produto `A000 - Contrato`, categoria `incorporador`, source `hubla`, vendas em 29–30/07). Foram **10 compradores únicos**.

A lista de ofertas que qualificam "Outside" está **fixa (hardcoded) em 3 lugares** e não contém essa oferta:
1. `supabase/functions/hubla-webhook-handler/index.ts` → `OUTSIDE_OFFER_NAMES` (linha ~1378)
2. `src/hooks/outsideOfferConstants.ts` (badge/detecção no front)
3. Função de banco `get_outside_detection_for_deals` (array `v_outside_offers`)

Consequências confirmadas nos dados:
- Nenhum dos 10 recebeu tag `Outside`, nem foi movido para "Contrato Pago" — o bloco de auto-Outside do webhook só roda quando `isOutsideOffer(offer_name)` é verdadeiro.
- **3 compradores sem contato/deal nenhum**: `eng.geffersonfirmino@gmail.com`, `pcamposn@gmail.com`, `emermd2107@gmail.com`. Para A000 o contato só é criado dentro do fluxo Outside; como ele não rodou, ninguém foi cadastrado. Observação importante: Gefferson e Pedro **já existem no CRM com outro e-mail** (`...@hotmail.com` e `pedro@evolua.digital`), batendo pelo telefone — criar por e-mail geraria duplicata.
- **2 com contato mas sem deal em Inside Sales**: Adriano Damazio, Edmilson da Silva.
- **5 com deal existente** que ficaram sem tag/stage (Flávio Leandro, Rodrigo Giurizatto, Werley Monteiro, Bruno Alves, e o duplicado de Rodrigo em outra BU).

Sobre "assinatura": a compra parcelada gera eventos extras (`subscription.created/activated`, `NewSale` com `hubla_id` iniciado por `newsale-` e sub-invoices `-offer-1`). Esses registros fantasma são gravados em `hubla_transactions` mas não disparam cadastro — não são a causa da falta do lead, mas geram linhas duplicadas por comprador (ex.: Emerson com 3 linhas, Bruno com 2).

## O que fazer

### 1. Tornar a lista de ofertas Outside configurável (fim do hardcode)
- Criar tabela `outside_offers` (colunas: `offer_id`, `offer_name`, `is_active`), com GRANTs e RLS (leitura para autenticados, escrita para admin/manager), populada com as 3 ofertas atuais **+ "Contrato - Lançamento 29/07" / `nPPUxJUzDl5mfa31XpIU`**.
- `hubla-webhook-handler`: `isOutsideOffer` passa a consultar a tabela (com fallback para a lista atual) e a aceitar match por **offer_id** além de offer_name.
- `get_outside_detection_for_deals`: trocar o array fixo por leitura da tabela.
- `src/hooks/outsideOfferConstants.ts`: manter a lista como fallback e adicionar um hook que lê a tabela, usado pelos componentes que exibem o selo Outside.

### 2. Reforçar o cadastro do comprador no fluxo Outside
No `hubla-webhook-handler`, antes de criar contato novo:
- buscar por e-mail; se não achar, buscar por **sufixo de 9 dígitos do telefone** (já existe, mas hoje só roda dentro do bloco Outside, que não foi acionado) e, achando, **atualizar/anexar o e-mail da compra** ao contato existente em vez de criar duplicata;
- registrar em `deal_activities` quando o match foi por telefone.

### 3. Recuperação retroativa dos 10 compradores de 29–30/07
Script único (executado como correção de dados) que, para cada comprador da oferta:
- resolve o contato (e-mail → telefone → cria novo);
- garante deal em PIPELINE INSIDE SALES: cria e distribui via `get_next_lead_owner` quando não existir; quando existir, apenas adiciona tag `Outside` e move para "Contrato Pago";
- vincula `hubla_transactions.linked_deal_id` (apenas a invoice real, ignorando linhas `newsale-*` e `-offer-N`);
- notifica o SDR responsável.
Ao final, relatório do que foi criado x atualizado, para conferência.

### 4. Higiene das linhas fantasma
Confirmar que as linhas `newsale-*` e sub-invoices `-offer-N` continuam com `count_in_dashboard = false` para não inflar receita/contratos do lançamento.

## Detalhes técnicos
- Arquivos: `supabase/functions/hubla-webhook-handler/index.ts`, `src/hooks/outsideOfferConstants.ts`, consumidores de `useOutsideDetection*`, migração para `outside_offers` + `get_outside_detection_for_deals`.
- Nenhuma mudança em regras de atribuição SDR/Closer: a distribuição continua usando `get_next_lead_owner` do pipeline Inside Sales.
