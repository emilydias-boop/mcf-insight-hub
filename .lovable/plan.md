# Academia MCF — Trilha de Integração PJ (90 dias)

Módulo novo e isolado dentro do app, em `/academia/*`. Não altera nenhuma tabela, rota, papel ou métrica existente.

## Decisões fechadas
- **Cadastro próprio**: a Academia tem suas próprias tabelas de pessoas (prefixo `academia_`), ligadas ao login do app pelo id do usuário. Nada do RH/usuários atual é alterado.
- **Papéis sem mudar o sistema**: gestor e padrinho são definidos no convite de cada colaborador. Admin RH da Academia = quem já tem papel `admin` ou `rh`. Nenhum papel novo no app.
- **5 frentes próprias**: Crédito imobiliário, Construção, Leilão, Consórcio imobiliário, Energia solar — catálogo exclusivo da Academia.
- **Sem gamificar vendas**: XP e badges só de conhecimento validado. Sem ranking com nomes; só média anônima da turma.

## Entregas (executadas em sequência, com typecheck/build em cada uma)

1. **Base**: tabelas `academia_*` (frentes, produtos, perfis, templates, fases, módulos, tarefas, trilhas do usuário, tarefas do usuário, marcos, quizzes, perguntas, tentativas, badges, regras, badges do usuário, eventos de XP, notificações), com permissões por linha: colaborador vê só o seu; gestor/padrinho só os vinculados; admin RH tudo. Conteúdo inicial: 5 frentes, 4 fases com todas as tarefas do anexo, página estática do Combinado PJ, 27 badges.
2. **Minha Trilha**: no primeiro acesso a trilha é montada (Fase 0 global, Fase 1 da frente principal com escolha R01/R02 no Incorporador, Fases 2 e 3 globais). Timeline vertical, % geral, dias decorridos, atrasos, cadeado nas fases seguintes enquanto a Fase 0 não estiver 100% aprovada, com a mensagem de justificativa.
3. **Validações**: seis tipos (auto, gestor, padrinho, quiz, evidência, prática). Upload de evidência em pasta privada. Fila do gestor/padrinho com Aprovar/Reprovar (comentário obrigatório ao reprovar); reprovada volta a pendente e notifica.
4. **Quizzes e marcos**: uma questão por vez, explicação, nota mínima 70, limite de tentativas. Marco 30 dias (gestor + padrinho) e Conclusão 90 dias (colaborador + gestor + padrinho, com texto de declaração).
5. **XP, níveis e badges**: função no banco `academia_check_badges` disparada automaticamente ao mudar tarefas, tentativas ou marcos. Níveis Trainee → Mestre MCF. Tela Minha Estante: 20 badges de produto em escada, transversais, silhuetas com critério que falta, destaque da frente principal e progresso rumo ao Mestre do Ecossistema.
6. **Biblioteca e extensões**: página por frente (liberada na Fase 2), trilhas de extensão após os 90 dias, badge Mestre do Ecossistema com animação.
7. **Admin RH**: convites, editor de templates com arrastar fases/módulos/tarefas, cadastro de produtos e quizzes, relatórios (tempo médio por fase, tarefa que mais reprova, % aprovado no Teste dos 3 Minutos de primeira). Painel do gestor com seus colaboradores, fase, dias e travas.

## Visual
Tema escuro próprio da Academia (fundo #0A0B0A, superfícies #111311/#171A16, lime #C6F53F, âmbar #FFB84D, Manrope, cantos 16–24px, checkbox quadrado lime), aplicado só dentro de `/academia` via variáveis de tema escopadas, com versão clara. Não altera o visual do resto do app.

## Detalhes técnicos
- Migrations só criam objetos novos `academia_*`; cada tabela com GRANT + RLS. Funções auxiliares `SECURITY DEFINER`: `academia_is_admin()` (via `has_role` admin/rh), `academia_is_gestor_de(uid)`, `academia_is_padrinho_de(uid)`.
- Trava da Fase 0 e conclusão de fase verificadas no banco (gatilho impede enviar tarefa de fase travada), não só na tela.
- `academia_gerar_trilha(user_id)` idempotente, chamada no primeiro acesso.
- Bucket privado `academia-evidencias`, pasta por usuário, políticas de leitura para o próprio, gestor, padrinho e admin.
- Quiz corrigido no banco (`academia_responder_quiz`) — a resposta correta nunca vai para a tela antes de responder.
- Rotas novas em `App.tsx` e um grupo "Academia MCF" no menu, apenas adições; nenhuma rota/item existente alterado.
- Convite: admin RH cadastra a pessoa já existente como usuário do app (seleção por e-mail); criação de novos logins fica fora do escopo.
