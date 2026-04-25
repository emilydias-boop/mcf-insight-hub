Hoje, quando a ligação é atendida, a intenção do código é mostrar duas coisas:

1. Um banner verde no topo dizendo que o lead atendeu, com telefone, duração e controles de chamada.
2. O `DealDetailsDrawer` do CRM à direita, com os dados completos do lead.

O problema provável é que o auto-discador fica dentro de um `Sheet` próprio (`AutoDialerPanel`) e, ao tentar abrir outro `Sheet` (`DealDetailsDrawer`) ao mesmo tempo, os componentes de modal/drawer podem competir entre si. Na prática, o painel do auto-discador pode continuar sendo o modal ativo e impedir/ocultar o drawer do lead.

Plano de correção:

1. Fechar/minimizar o painel do auto-discador quando a fila começa ou quando uma chamada é atendida
   - Ao clicar em “Iniciar”, o painel do auto-discador será fechado automaticamente.
   - A fila continua rodando em background.
   - O status fica visível pelo botão flutuante e pelo banner quando alguém atende.

2. Abrir uma visualização clara do lead quando ele atender
   - Quando o `callStatus` virar `in-progress`, manter o estado `paused-in-call`.
   - Abrir o drawer do lead automaticamente com o `dealId` atual.
   - O SDR verá o mesmo drawer completo do CRM, com cabeçalho, dados, ações rápidas, próxima ação, histórico, tarefas, notas, compras/produtos e qualificação.

3. Garantir que os controles de ligação fiquem sempre visíveis
   - Manter o banner verde acima do drawer.
   - Botões no banner: ver/reabrir lead, mutar, qualificar, pular e desligar.
   - Se o SDR fechar o drawer sem desligar, o banner continua aparecendo e permite reabrir o lead.

4. Ajustar a camada visual dos drawers
   - Dar uma classe/controle específico ao drawer aberto pelo auto-discador para evitar ficar atrás do painel ou overlay.
   - Se necessário, impedir que o painel do auto-discador e o drawer do lead fiquem abertos simultaneamente.

5. Melhorar o fallback para chamadas sem negócio CRM
   - Se a fila veio de telefone colado/manual e não existe `dealId` real, não tentar abrir o `DealDetailsDrawer`.
   - Nesse caso, mostrar apenas o banner da chamada e uma mensagem/estado simples, porque não há dados de CRM para carregar.

Resultado esperado:

- Em “Chamando”: o SDR vê a fila/status do auto-discador.
- Quando o lead atende: o painel da fila sai da frente, aparece o drawer completo do lead e o banner verde de ligação fica por cima.
- Durante a conversa: o SDR consegue consultar dados e executar ações do lead.
- Ao desligar: abre a qualificação/agendamento; depois de concluir/fechar, a fila continua para o próximo lead.