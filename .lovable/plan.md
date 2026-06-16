
## Objetivo

Criar/atualizar no CRM os deals das **51 compras `paid`** do CSV Kiwify (todas A010 - Construa para Vender sem Dinheiro), aplicando exatamente as mesmas regras do webhook `kiwify-webhook-handler` que já está em produção. Ignorar status `waiting_payment`, `refused` e `refunded`.

## Diagnóstico do CSV vs CRM atual

- 67 linhas totais → **51 `paid`**, 8 `waiting_payment`, 4 `refused`, 4 `refunded`.
- Cruzando os 51 emails `paid` com `crm_deals` em PIPELINE INSIDE SALES:
  - **~7 já possuem deal com tag `A010 Kiwify`** (já criados pelo webhook, p.ex. Edilson, Djmar, Fabiano, Francine, Mikaell, Michel, Vera Lúcia) → não fazer nada.
  - **~7 deals existem mas em estágio avançado / outras tags** (Dioney, Claudia, Eliel, Ivam, José Erlei, Leonardo, Rodrigo) → adicionar tags `A010` + `A010 Kiwify` se faltarem; **não** mover de estágio (preserva trabalho do SDR).
  - **~37 emails não têm deal nenhum** → criar deal em PIPELINE INSIDE SALES, estágio `Novo Lead`, tags `['A010','A010 Kiwify']`.

## Escopo

- Backfill cobre apenas as **51 compras `paid`** listadas no CSV.
- Reaproveita 100% das regras do `kiwify-webhook-handler` (dedup por email + sufixo telefone, hard-block parceiros, custom fields `a010_compra` / `a010_produto` / `a010_data`, origem PIPELINE INSIDE SALES, estágio Novo Lead).
- Refunds / waiting_payment / refused: ignorados (sem alteração no CRM).

## Plano técnico

1. **Nova edge function one-shot**: `supabase/functions/kiwify-backfill-a010-csv/index.ts`
   - Recebe `POST` com `{ rows: KiwifyCsvRow[] }` (array com nome, email, telefone, data, id_kiwify do CSV).
   - Filtra apenas `status === 'paid'`.
   - Para cada linha:
     1. Normaliza telefone (sufixo de 9 dígitos) e email (lowercase).
     2. Verifica via RPC `check_duplicate_deal_by_identity(email, phone_suffix, origin_id_inside_sales)`:
        - **Existe deal**: faz `update` apenas adicionando tags `A010` + `A010 Kiwify` (se faltarem) e merge dos custom fields A010. Não mexe em `stage_id` nem em `owner_id`.
        - **Não existe**: cria contato (se necessário) + deal em PIPELINE INSIDE SALES, estágio `Novo Lead`, tags `['A010','A010 Kiwify']`, custom fields preenchidos.
     3. Hard-block parceiro: se contato/deal cair em pipeline GERENTES / PARCEIROS, **não** criar deal em Inside Sales (mesma regra já existente).
   - Retorna `{ processed, created, updated, skipped_partners, skipped_existing, errors[] }`.

2. **Script utilitário local** (apenas para chamar a função): parsea o CSV anexado e faz `POST` para a função com o array de linhas `paid`. Não vai pro repo do app — execução via `supabase--curl_edge_functions` com o JSON inline.

3. **Execução**:
   - Deploy da função.
   - Chamada via `supabase--curl_edge_functions` passando as 51 linhas.
   - Validação: query final em `crm_deals` confirmando que os 51 emails têm tag `A010 Kiwify`.

## Fora de escopo

- Não altera o `kiwify-webhook-handler` (já corrigido em iteração anterior).
- Não cria deals para `waiting_payment` / `refused` / `refunded`.
- Não move deals existentes de estágio.
- Não trata outras categorias Kiwify (incorporador, contrato, outros).

## Pós-execução

- Posso opcionalmente apagar a function `kiwify-backfill-a010-csv` após rodar (one-shot), ou manter desabilitada para reuso futuro. Confirmo com você ao final.
