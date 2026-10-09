# Anamnese do HARVEY no Pós Venda, como no Consórcio

## Como funciona hoje
- **Consórcio:** quando o HARVEY encaminha um cliente para o GR, ele manda a anamnese junto. O card aparece em "ENCAMINHADO GR" com o botão "Ver anamnese".
- **Pós Venda:** já existe um recebimento próprio, com o mesmo formato de anamnese e o mesmo botão. Mas o HARVEY ainda não envia nada para ele. Só 8 cards têm anamnese, e 15 fichas estão guardadas sem card.
- Os 1.314 clientes importados vieram dos arquivos, que não tinham anamnese. Por isso aparece "Verificar anamnese no HARVEY".

## O que será feito
1. **Ligar pelo código do Harvey:** o recebimento do Pós Venda passa a achar o card pelo código do cliente no Harvey (já gravado nos 1.314 cards). Depois tenta pelo CPF e, por último, por e-mail ou telefone, como hoje. Isso resolve clientes cujo e-mail ou telefone é diferente entre os dois sistemas.
2. **Aplicar as 15 fichas guardadas:** com a nova ligação, tento aplicar as 15 que estão esperando. Só faço isso com sua autorização.
3. **Texto para colar no HARVEY:** entrego as instruções para o HARVEY:
   - enviar a anamnese sempre que ela for preenchida ou editada;
   - fazer um envio único de todas as anamneses já preenchidas da carteira (Kalyanne, Rebeca, William e Vitor).
   O formato é o mesmo que o HARVEY já usa no encaminhamento do Consórcio, com o código do cliente a mais.
4. **Resultado na tela:** a ficha chega, a etiqueta "Verificar anamnese no HARVEY" some sozinha e aparece "Ver anamnese", igual ao Consórcio. Ao abrir, o resumo e as seções aparecem como na sua captura do José Élio.

O encaminhamento do Consórcio (ENCAMINHADO GR) não é alterado.

## Detalhes técnicos
- `supabase/functions/pos-venda-anamnese/index.ts`: aceitar `harvey_cliente_id` (ou `cliente.id`) e `cliente.cpf`. Ordem de busca na origem Pós Venda: `custom_fields->>'harvey_cliente_id'`, `custom_fields->>'cpf'`, e-mail, sufixo de 9 dígitos do telefone. Busca filtrada no banco, sem o limite atual de 2.000 cards. Gravação em `custom_fields.anamnese_v2`, mantendo as outras chaves. Mesmo segredo `x-crm-key` (`CRM_EXTERNO_SECRET`).
- Migração aditiva: colunas `harvey_cliente_id` e `cpf` em `pos_venda_anamnese_pendente`, e `pos_venda_aplicar_anamnese_pendente` passa a casar por elas também.
- Aplicação das 15 pendentes: só com autorização, via função existente.
- Sem mudança em `crm-externo-encaminhamento`, em outras BUs, em métricas ou em dados financeiros.
