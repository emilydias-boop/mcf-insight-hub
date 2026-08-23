# Rodada 1 — proteção contra perda de dados

## Objetivo
Corrigir somente os formulários de cadastro pendente e carta de consórcio para que edições persistam exclusivamente os campos realmente alterados pelo usuário.

## Implementação
1. **Editar Cadastro Pendente**
   - Reinicializar a hidratação sempre que o modal abrir ou mudar de cadastro.
   - Criar o snapshot somente depois que todos os valores do registro, inclusive o bloco de plano, forem colocados no formulário.
   - No modo de edição, normalizar os valores atuais e gerar um patch contendo apenas chaves cujo valor difere do snapshot; uma limpeza intencional continuará sendo enviada como `null`/vazio normalizado.

2. **Editar Carta de Consórcio**
   - Garantir que o formulário receba a cota detalhada, incluindo RG, profissão, renda, patrimônio, PIX, endereço completo e categoria.
   - Capturar o snapshot dos valores efetivamente hidratados e enviar ao hook de atualização somente o diff em edições. A criação continuará usando o payload completo necessário para uma nova cota.

3. **Duplicar carta**
   - Herdar dados pessoais/endereço e todos os campos de plano solicitados: categoria, crédito, prazo, produto, condição, objetivo, seguro, pagamento pela empresa, quantidade, vencimento, tipo de contrato e origem.
   - Limpar exclusivamente grupo, cota e contrato Embracon.

4. **Validação visível**
   - Tornar telefone efetivamente obrigatório no schema adequado a PF/PJ.
   - Ao falhar, identificar o primeiro campo inválido pela ordem das abas, abrir essa aba, rolar até o controle, focá-lo e exibir mensagem com o nome do campo.

## Arquivos previstos
- `src/components/consorcio/OpenCotaModal.tsx`
- `src/components/consorcio/ConsorcioCardForm.tsx`
- `src/components/consorcio/CotasTab.tsx`
- Eventualmente `src/hooks/useConsorcio.ts` apenas se o hook atual impedir o patch parcial de edição.

## Verificação
- Executar os testes relevantes disponíveis e conferir o build automático.
- Validar no preview: hidratação de cadastro, edição sem zerar campos, limpeza intencional, duplicação e navegação/foco da validação.
- Não executar migrations nem qualquer escrita manual no banco.
