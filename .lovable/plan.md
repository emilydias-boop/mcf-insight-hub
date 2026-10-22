# Distribuir o texto do Resumo nos blocos da anamnese

## O que muda
Na janela "Ver anamnese", o texto do Resumo passa a ser separado e colocado em cada bloco:
- Linha "Contato: ..." vai para CONTATO
- "Objetivos: ..." vai para OBJETIVOS
- "Patrimônio", "Financeiro", "Planejamento" e "Sobre o cliente" vão para os seus blocos

Cada item ("Profissão — Advogado") aparece como "Profissão: Advogado", em duas colunas, igual ao layout atual. O item "O que busca na MCF" ganha o selo verde-limão em OBJETIVOS.

Depois de distribuído, o cartão "Resumo" deixa de aparecer, para não repetir as informações. Se alguma linha do resumo não corresponder a nenhum bloco, o cartão Resumo continua aparecendo só com essa parte.

## Regras
- Se o bloco já tiver respostas vindas do HARVEY, elas continuam valendo; o resumo só preenche os blocos vazios.
- Blocos do resumo que não existirem na ficha são criados na mesma ordem do resumo.
- Nada é gravado: a separação é feita apenas na tela. Sem mudança no banco e sem publicar.

## Detalhes técnicos
- Arquivo único: `src/components/crm/AnamneseExternaButton.tsx`.
- Função pura `distribuirResumo(resumo, secoes)`: quebra por linha, separa o título antes do primeiro ":", itens por ";" e rótulo/valor por " — " (aceita também " - " como alternativa). Casa o título com a seção pela mesma normalização sem acentos já usada (`contato`, `objetivo`, `patrimonio`, `financ`, `planej`, `cliente`).
- Teste unitário com o resumo do exemplo do Érico, conferindo os campos de cada bloco.
