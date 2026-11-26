# Etapa "Backlog" no Pós-venda

## Objetivo
Separar os clientes antigos (migração de 08/10) dos novos licenciados, criando a etapa **Backlog** entre "Novos licenciados" e "Reunião de Viabilidade 1".

## O que muda para o usuário
- O funil do Pós-venda passa a ter: Novos licenciados → **Backlog** → Viabilidade 1 → Viabilidade 2 → Viabilidade Concluída.
- **1.181 clientes migrados** (vindos da importação de 08/10 e sem nenhuma reunião de viabilidade) passam da Viabilidade 1 para o Backlog.
- Os **119 migrados que já têm reunião** ficam na Viabilidade 1.
- Novos licenciados continuam chegando em "Novos licenciados" e seguem direto para a Viabilidade 1. Nunca entram no Backlog automaticamente.
- Para reativar um cliente antigo, basta arrastá-lo do Backlog para a Viabilidade 1 e agendar a reunião, como já é feito hoje.
- Dono do cartão, notas, etiquetas e histórico ficam como estão.

## Passos
1. Criar a etapa Backlog na posição 1 e passar as etapas seguintes para as posições 2 a 4.
2. Ensaio (sem gravar): contar os cartões elegíveis e conferir se são os 1.181.
3. Mover os cartões, guardando antes uma cópia de segurança da etapa anterior de cada um, para poder desfazer.
4. Registrar cada mudança na linha do tempo do cliente como "movido para Backlog (separação da carteira migrada)".
5. Conferir no quadro que o Backlog aparece entre as duas etapas e que os contadores batem.

## Detalhes técnicos
- Origem do Pós-venda: `b05a0000-0000-4000-8000-000000000002`. Viabilidade 1: `b05a0001-…-000000000001`.
- Cartões elegíveis: `stage_id` = Viabilidade 1, `data_source='csv'`, `created_at::date='2026-10-08'` e nenhuma linha em `pos_venda_reunioes`.
- A cópia de segurança fica em `backup_pos_venda_backlog_20261126 (deal_id, stage_id_anterior)`.
- Gatilhos a respeitar: `trg_pos_venda_nota_novos` só vale para quem sai de "Novos licenciados", então não afeta essa movimentação. `trg_pos_venda_entregaveis` precisa ser revisado para aceitar a nova etapa, e `trg_pos_venda_harvey_gerente` não pode disparar, já que o dono não muda.
- Jornada: `jornada_mapa_estagios` tem 4 mapeamentos. O Backlog entra mapeado na mesma fase de "Novos licenciados", para que a Jornada/HARVEY não mostre esses clientes como avançados.
- A ingestão (`pos_venda_registrar_cliente`) continua criando cartões em "Novos licenciados", sem alteração.
- No quadro, conferir se algum filtro ou contador procura as etapas por posição em vez do identificador, e ajustar se for o caso.
