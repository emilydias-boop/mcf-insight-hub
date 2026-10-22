# Ficha de anamnese (HARVEY) no layout do anexo

Mudança só visual na janela "Ver anamnese" do Pós-Venda. Os dados vindos do HARVEY não mudam.

## Como vai ficar
- Título "Respostas da Anamnese" com ícone de prancheta; abaixo, o nome do cliente e a data de preenchimento.
- Cada seção em um cartão escuro com borda arredondada, título em maiúsculas com emoji: Contato, Objetivos, Patrimônio, Financeiro, Planejamento, Sobre o cliente (outras seções recebem um ícone padrão).
- Campos em **duas colunas**, no formato "**Rótulo:** valor", com o rótulo em destaque e o valor em cor mais suave; "—" quando vazio.
- Textos longos (ex.: "Detalhes terreno") ocupam a linha inteira.
- Em Objetivos, o objetivo principal aparece como selo verde-limão destacado.
- Campos com várias respostas (ex.: "Valores") aparecem como etiquetas lado a lado; o estado em Planejamento aparece como etiqueta.
- Resumo (quando existir) e o botão "Abrir versão para impressão" continuam disponíveis.

## Fora do escopo
- O botão "Editar" do anexo não será incluído: hoje a ficha vem do HARVEY e não há edição no sistema. Se quiser, fica para uma etapa separada.
- Sem alteração de banco, regras ou publicação.

## Detalhes técnicos
- Arquivo único: `src/components/crm/AnamneseExternaButton.tsx`.
- Mapa `chave/titulo da seção -> emoji`; grid `sm:grid-cols-2`; campos com valor longo (> ~40 caracteres) em `col-span-2`; arrays renderizados como badges; campo de objetivo principal (primeiro campo da seção Objetivos com tag contendo "objetivo" sem "12") como badge destacado usando token de acento.
- Cores via tokens semânticos (adicionar token de destaque em `index.css` se não existir equivalente).
- Validação: typecheck/build e captura de tela com um card que tenha anamnese.
