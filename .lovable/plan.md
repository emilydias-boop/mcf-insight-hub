# Jornada de Pós-Venda (trilha pública por CPF)

## Como cada etapa é registrada
1. **Compra (ordem 10)**: registrada de forma automática quando chega a confirmação da compra (Hubla, Kiwify ou MCFPay), aproveitando a entrada de vendas do Pós-Venda que já existe. A data da etapa é a data do pagamento. Nada é marcado à mão.
2. **Boas-vindas (ordem 20)**: registrada quando o cartão do cliente entra na pipeline Pós-Venda, na etapa "Novos licenciados", com atendimento e direcionamento, ou seja, com gerente definido e anotação de contato.
3. **Cadastro no HARVEY (ordem 30)**: confirmada quando o cliente aparece na importação do HARVEY, que já traz o código do cliente e a anamnese. Se o cliente ainda não foi importado, a ficha mostra "Cadastro no HARVEY não confirmado".

A jornada fica ligada ao **cartão do cliente na pipeline Pós-Venda**, onde já ficam o CPF e o gerente. Não será criado um cadastro de clientes à parte.

## O que será criado
- **Etapas da Jornada**: lista com as 3 etapas iniciais. A numeração vai de 10 em 10 para permitir incluir etapas no meio depois.
- **Histórico da jornada**: cada mudança de etapa fica guardada com data, quem registrou (ou "automático") e observação. O histórico só recebe registros novos e nunca é apagado.
- **Consulta pública por CPF** (para a trilha em trilha.mcfcapital.com.br): mostra o primeiro nome e as etapas, cada uma como concluída, atual ou futura, com a data. Se o CPF não for encontrado, aparece "Não encontramos uma jornada com esse CPF."
- **Tela "Etapas da Jornada"** (administração): listar, criar, editar, desativar e reordenar etapas.
- **Ficha do cliente (cartão Pós-Venda)**: campo para mudar a etapa à mão, com observação opcional, uma linha do tempo do histórico e a indicação de cadastro no HARVEY.

## O que não muda
- Webhooks de venda, distribuição de gerentes e outras BUs continuam iguais.
- A trava atual de "Novos licenciados" continua valendo.
- Nada antigo é alterado ou preenchido de forma retroativa sem autorização. Preencher a jornada dos clientes que já estão na carteira fica para uma decisão separada.

## Detalhes técnicos
- Tabelas: `jornada_etapas` (ordem e slug únicos, ícone lucide, ativa) e `jornada_eventos` (deal_id → crm_deals, etapa_id, ocorrido_em, registrado_por, observacao), com GRANT, RLS apenas para usuários autenticados e sem acesso anônimo. A etapa atual do cliente vai em `crm_deals` com as colunas novas `jornada_etapa_atual_id`, `data_compra` e `cpf` (só dígitos, retirado de `custom_fields.cpf`, com índice único parcial na origem Pós-Venda). Um gatilho grava um evento sempre que a etapa atual mudar, inclusive na criação do cartão.
- **Compra**: dentro de `pos_venda_registrar_cliente` (já chamada pelo gatilho de `hubla_transactions`), avançar para "compra" e gravar `data_compra`. Qualquer falha vai para `pos_venda_entrada_falhas`, sem travar a venda.
- **Boas-vindas**: gatilho em `crm_deals` restrito a `POS_VENDA_ORIGIN_ID`. Ele avança a etapa quando o cartão está em "Novos licenciados" com dono definido e há uma atividade `pos_venda_nota_contato`.
- **HARVEY**: a importação (`ImportarHarvey`/`harveyImport`) e a aplicação da anamnese (`pos_venda_anamnese_pendente`) avançam para "cadastro_harvey" quando houver `harvey_cliente_id`. A etapa só avança, nunca volta.
- **Edge function** `consultar-jornada`: pública (verify_jwt=false), usa service role, recebe o CPF com 11 dígitos e só libera o acesso (CORS) para a trilha e o preview dela. Retorna apenas o primeiro nome e as etapas.
- A regra de arquitetura será registrada no AGENTS.md.
