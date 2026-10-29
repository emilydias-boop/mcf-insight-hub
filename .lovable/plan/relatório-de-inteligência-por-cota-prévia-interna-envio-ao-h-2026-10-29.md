# Relatório de Inteligência por Cota (prévia interna + envio ao HARVEY)

## Objetivo
Cada cliente com cota vai ver no HARVEY, mês a mês, o trabalho feito para contemplar a cota dele: número da Loteria Federal, data da assembleia, lances dados (embutido, livre ou fixo) e a chance estimada. Antes do envio, tudo aparece numa nova tela interna, que funciona como prévia do que o cliente vai receber.

## O que existe hoje (conferido no banco)
- 2.092 cotas cadastradas.
- 20 datas no calendário de assembleias (grupo, número, data, sorteio).
- 719 consultas da Loteria Federal, guardadas por grupo e período. Não existe a lista de cotas de cada consulta.
- 3 lances simulados salvos, com percentual, valor e chance. O tipo do lance (embutido, livre ou fixo) não fica gravado.
- 24 resultados de assembleia importados. Nenhum contemplado está vinculado.
- O HARVEY hoje só envia dados para nós (ficha de anamnese). Ainda não existe envio do nosso sistema para o HARVEY.

Como você pediu, o histórico mostra só o que está gravado. Quando faltar informação, o mês aparece como "sem registro". Nada é recalculado nem inventado.

## O que será construído

1. **Nova tela interna "Relatório da Cota"** (Consórcio > CRM)
   - Busca por cliente, grupo ou cota.
   - Linha do tempo mensal, um bloco por assembleia: data da assembleia, número da Loteria Federal e número aplicado ao grupo, lances dados na cota (tipo, percentual, valor, chance) e o resultado da assembleia quando houver.
   - Visual limpo, pensado para o cliente final. Dados internos ficam de fora: nome de quem consultou e observações.
   - Botão "Enviar ao HARVEY" por cota, mais o envio do mês em lote.

2. **Registrar o tipo de lance daqui para frente**
   - Ao salvar um lance, passa a escolher Embutido, Livre ou Fixo. Os 3 lances já salvos aparecem como "tipo não informado".

3. **Envio ao HARVEY**
   - Um pacote por cota com os mesmos dados da tela, assinado com uma chave secreta.
   - Cada envio fica registrado (cota, mês, data, sucesso ou erro), para não mandar duplicado e para permitir reenvio.

## O que preciso de você antes do envio
- O endereço (URL) do HARVEY que vai receber os dados e a chave de autenticação. A tela de prévia pode ser feita antes disso.
- Como o HARVEY identifica o cliente: CPF, e-mail ou ID HARVEY.

## Detalhes técnicos
- Leitura: função `consorcio_relatorio_cota(card_id)`, em modo somente leitura (security definer), restrita a quem já tem acesso ao Consórcio. Ela junta `consortium_cards`, `consorcio_calendario_assembleia` (por grupo), `consorcio_consulta_loteria` (por grupo e período), `consorcio_lance_history` e `consorcio_assembleia_resultados` (por grupo e cota).
- Migração: coluna `tipo_lance` (embutido, livre, fixo, nulo) em `consorcio_lance_history`. Nova tabela `consorcio_harvey_envios` com GRANTs, RLS só para admin e uma chave única (card_id, mes_referencia).
- Edge function `harvey-relatorio-cota`: valida o usuário, monta o pacote, envia com assinatura HMAC (segredos `HARVEY_WEBHOOK_URL` e `HARVEY_WEBHOOK_SECRET`) e registra o resultado.
- O isolamento da BU Consórcio continua como está. Nenhum dado existente é alterado.
