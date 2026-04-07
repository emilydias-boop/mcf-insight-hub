

# Fix WhatsApp e Disparo em Massa de Boletos

## Diagnóstico do Erro WhatsApp

O erro "Edge Function returned a non-2xx status code" acontece porque **65 de 71 boletos vinculados NÃO têm telefone cadastrado** na carta (`consortium_cards`). A edge function `send-boleto-whatsapp` retorna erro 500 com "Cliente sem telefone cadastrado" nesses casos. A função em si está operacional — funciona perfeitamente quando há telefone.

## Mudanças Propostas

### 1. Melhorar tratamento de erro no WhatsApp (BoletoSection.tsx)
- Antes de chamar a edge function, verificar se o card tem telefone
- Se não tiver, mostrar toast informativo "Cliente sem telefone cadastrado" sem chamar a função
- Alternativamente, melhorar a mensagem de erro para ser mais clara quando a function retorna erro

### 2. Indicador visual de telefone ausente (BoletoSection.tsx)
- Desabilitar/esconder botão WhatsApp quando o card não tem telefone
- Mostrar tooltip "Telefone não cadastrado" no botão desabilitado
- Isso requer passar o dado de telefone do card para o componente

### 3. Disparo em massa via wa.me (ConsorcioPagamentosTab.tsx + PagamentosTable.tsx)
Criar funcionalidade de selecionar múltiplas linhas e disparar WhatsApp para todas:

- **Checkboxes na tabela**: Adicionar coluna de seleção com checkbox por linha + "selecionar todos"
- **Barra de ações em massa**: Quando há itens selecionados, mostrar barra fixa no topo com contagem e botão "Enviar WhatsApp (N selecionados)"
- **Filtro inteligente**: Só permitir selecionar linhas que tenham boleto vinculado E telefone cadastrado
- **Disparo sequencial via wa.me**: Ao clicar, abrir links wa.me um a um (com intervalo) para cada boleto selecionado, usando a edge function no modo `wame`

### 4. Fluxo de disparo em massa
- Chamar `send-boleto-whatsapp` com `mode: 'wame'` para cada boleto selecionado
- Abrir cada wa.me URL em nova aba sequencialmente
- Mostrar progresso (ex: "Enviando 3/10...")
- Pular boletos sem telefone e informar quantos foram ignorados

### Arquivos modificados
- `src/components/consorcio/pagamentos/PagamentosTable.tsx` — checkboxes, seleção, indicador de telefone
- `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx` — barra de ações em massa
- `src/components/consorcio/pagamentos/BoletoSection.tsx` — melhorar erro do WhatsApp
- `src/hooks/useConsorcioBoletos.ts` — adicionar hook de disparo em massa

### Limitações
- Navegadores bloqueiam múltiplas abas abertas por scripts — o disparo em massa abrirá uma aba por vez, pedindo confirmação do usuário para avançar
- Para disparo 100% automático sem interação, seria necessário integração com API do WhatsApp Business (Twilio), mas a maioria dos cards não tem telefone cadastrado ainda

