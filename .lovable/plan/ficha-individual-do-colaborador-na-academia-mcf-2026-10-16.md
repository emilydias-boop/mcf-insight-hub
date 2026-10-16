# Ficha individual do colaborador na Academia MCF

## Como está hoje
- **Validações**: só mostra o que está esperando aprovação. Depois que você aprova, o item some.
- **Painel do gestor**: um cartão por pessoa, com a fase atual, "Dia X de 90", a barra de progresso e os avisos. Não dá para clicar no cartão nem abrir o detalhe.
- As respostas dos quizzes ficam guardadas a cada tentativa (nota, aprovado ou não e a opção escolhida em cada pergunta), mas nenhuma tela mostra essas respostas para o gestor.

## O que muda
1. No **Painel do gestor**, cada cartão vira um link para a **ficha do colaborador**.
2. A **ficha do colaborador** terá:
   - **Resumo**: nome, frente, função, nível, XP, data de início, "Dia X de 90", % da trilha, gestor e padrinho.
   - **Evolução por fase**: as fases com o % de cada uma e o cadeado da Fase 0. Ao abrir uma fase, aparecem as tarefas com a situação (pendente, enviada, aprovada, reprovada), a data de envio, quem validou e quando, o comentário da reprovação e o botão "Ver evidência".
   - **Respostas dos quizzes**: cada tentativa com data, nota e se passou. Ao abrir uma tentativa, aparece cada pergunta com a resposta do colaborador, a resposta certa e um sinal de certo ou errado.
   - **Marcos**: Marco 30 dias e Conclusão 90 dias, com quem já assinou.
3. Em **Validações**, uma seção "Já validadas por mim", com as últimas aprovações e reprovações e um link para a ficha de cada pessoa. Assim você também acha as 2 validações que já aprovou.

## Quem vê
Pelas regras de acesso que já existem: admin/RH veem todo mundo; o gestor e o padrinho veem só os colaboradores ligados a eles. O colaborador continua vendo apenas a própria trilha.

## Detalhes técnicos
- Nova rota `/academia/equipe/:userId` (`src/pages/academia/ColaboradorDetalhe.tsx`). A tela reaproveita `useTrilhaDoUsuario(userId)` sem gerar trilha, mais `agruparPorFase`, `abrirEvidencia` e `useNomes` para os nomes de quem validou.
- Os quizzes vêm de `academia_quiz_attempts` (campo `respostas`), cruzados com `academia_quiz_questions`. Primeiro vou conferir, só lendo, o formato de `respostas` e se as regras de acesso já deixam o gestor ler as tentativas e as perguntas com o gabarito. Se não deixarem, paro e aviso você antes de mexer em qualquer permissão do banco.
- Em `PainelGestor.tsx`: o cartão vira um link. Em `Validacoes.tsx`: nova consulta das tarefas com `validada_por = eu`, limitada às 30 mais recentes.
- Não muda nenhum dado nem nenhuma regra de validação, e nada é publicado.
