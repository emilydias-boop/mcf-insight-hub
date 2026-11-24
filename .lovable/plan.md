# Requisição "Social Media" não envia — campo de início vazio

## O que encontrei
Na requisição "Social Media" (Matheus Rodrigues, setor Marketing) estão preenchidos: setor, centro de custo, cargo, título, descrições, local e justificativa. O único campo obrigatório vazio é a **Data desejada de início**. O aviso atual lista todos os campos de uma vez, por isso parece que tudo está faltando.

Provável motivo: o campo de data aceita só data completa; se a data for digitada pela metade ou num formato que o navegador não reconhece, ele fica vazio sem avisar.

## O que vou mudar
1. O aviso passa a dizer exatamente quais campos faltam (ex.: "Falta preencher: Data desejada de início").
2. Antes de enviar, a tela confere os campos e destaca em vermelho os que estão vazios, levando o usuário até o primeiro.
3. O campo de data mostra uma dica quando o que foi digitado não forma uma data válida.
4. A requisição do Matheus não é alterada: ele só precisa informar a data e enviar de novo.

## Detalhes técnicos
- `gov_requisicao_validar`: trocar a mensagem genérica por uma lista montada só com os campos vazios (mesma regra, sem mudar o que é obrigatório).
- `src/pages/rh/Requisicoes.tsx`: validação no envio com os mesmos campos, marcação `aria-invalid`/borda vermelha e foco no primeiro; aviso no `<Input type="date">` usando `validity.badInput`.
