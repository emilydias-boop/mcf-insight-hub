# Corrigir nomes ausentes no menu lateral

## Diagnóstico
- Na largura atual de 622 px, o menu usa o formato de janela estreita (ativado abaixo de 768 px).
- O menu desse formato abre separadamente do estado recolhido do computador. O layout inicia com esse estado recolhido.
- Os grupos, como BU e Financeiro, já exibem nomes usando uma condição que considera a janela estreita. Os links individuais e os discadores usam apenas o estado recolhido e, por isso, ficam só com ícones — exatamente o padrão da captura.
- A causa identificada é a exibição dos nomes, não uma regra de permissão. A sessão do seu login não está disponível aqui para uma conferência autenticada.

## Ajuste proposto
1. Usar a mesma regra de exibição para os nomes de todos os links individuais e dos discadores: sempre mostrar texto no menu aberto em janela estreita; no computador, mostrar texto quando expandido.
2. Alinhar o cabeçalho, separadores e indicadores acompanhantes à mesma regra, mantendo um controle visível para fechar ou recolher o menu.
3. Preservar todos os módulos, destinos, permissões e filtros por BU. Não alterar dados, funções ou publicar.

## Validação
- Conferir o menu em 622 px: links e grupos com nomes visíveis, sem cortes.
- Conferir o computador: expandido com nomes e recolhido apenas com ícones, com reabertura funcionando.
- Conferir grupos expansíveis e abertura/fechamento do menu. Se a sessão continuar indisponível, informar que a conferência no seu login depende da prévia autenticada.

## Detalhes técnicos
- Ajuste localizado em `src/components/layout/AppSidebar.tsx`, reutilizando `showText = isMobile || !isCollapsed` já existente.
- Evidências: links individuais em torno da linha 818 e discadores nas linhas 858 e 867 usam `!isCollapsed`; grupos usam `showText` em torno da linha 738. `SidebarProvider` mantém `openMobile` independente de `open` em `src/components/ui/sidebar.tsx`; `MainLayout` inicia com `defaultOpen={false}`.
- Não modificar a lógica compartilhada do provedor do menu nem as regras de autorização.