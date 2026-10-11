# Application Health Assessment — Parte 4 (revisão de 11/10/2026)

Somente leitura. Nenhum código, banco ou integração será alterado sem aprovação item a item.

Esta revisão traz o que já foi feito desde a primeira entrega: a busca de negócios por e-mail foi reescrita no relatório semanal. A regra de leitura da tabela de vendas agora confere a permissão uma vez por consulta. A T6 era falso positivo. Os alertas caíram de 733 para cerca de 535.

Legenda: V = verde, A = amarelo, R = vermelho, SD = sem dados.

## 1. SLIs e SLOs (valem para todas as features)

| Dimensão | Indicador (SLI) | Meta (SLO) | Como medir |
|---|---|---|---|
| Funcional | % de fluxos críticos com teste automatizado passando | 100% | Teste ponta a ponta por fluxo |
| Propósito | Evento de sucesso por feature (tabela 2) | Meta do dono da BU | Registro de eventos de uso (ainda não existe) |
| Performance | Abertura da tela com dados (p75); consulta ao banco (p95) | Tela < 2,5 s; consulta < 500 ms; integração < 3 s | Métricas do navegador + consultas lentas |
| Confiabilidade | % de requisições com erro; vendas que falharam ao entrar | < 1% nas telas; 0 vendas perdidas por dia | Logs de erro + logs das integrações |
| Segurança | Escrita aberta em tabela sensível; funções abertas; entrada sem validação | 0 nas tabelas sensíveis | Alertas do Supabase + revisão das regras |
| Manutenibilidade | Arquivos > 800 linhas; "as any"; lógica duplicada | Nenhum arquivo crítico > 800; "as any" caindo todo mês | Contagem no código |

## 2. Critério de sucesso por feature (Propósito)

| Feature | Evento de sucesso |
|---|---|
| CRM / Negócios | Negócio muda de etapa; lead novo atendido em até X horas |
| Agenda R1/R2 | Reunião agendada vira realizada |
| Entrada de vendas (Hubla, Kiwify, MCF Pay) | Venda recebida, registrada e vinculada ao negócio |
| Consórcio | Cota cadastrada sem retrabalho; parcela gerada na data certa |
| Fechamento SDR/Closer | Mês aprovado sem recálculo manual |
| Contas a receber / Cobranças | Título em atraso cobrado e pago |
| Pós Venda | Novo licenciado contatado e com nota registrada |
| Check-in / WhatsApp | Mensagem do cliente respondida em até X minutos |
| Marketing / A010 | Custo por lead; taxa de lead que chega à R1, por canal |
| RH / Academia / Patrimônio | Trilha concluída; equipamento com responsável atual |
| Painéis Crédito/Solar, BI, TV | Painel aberto com os dados do dia |

## 3. Scorecard

| Módulo | Func. | Prop. | Perf. | Conf. | Seg. | Manut. | Geral |
|---|---|---|---|---|---|---|---|
| CRM / Negócios | A | SD | A | A | A | R | **A/R** |
| Agenda R1/R2 | A | SD | A | A | A | R | **A/R** |
| Entrada de vendas | A | SD | A | A | A | A | **A** |
| Consórcio | A | SD | A | A | R | R | **R** |
| Fechamento SDR/Closer | A | SD | R | A | V | R | **A/R** |
| Financeiro / Cobranças | A | SD | A | A | A | A | **A** |
| Pós Venda | A | SD | V | V | V | A | **A/V** |
| Check-in / WhatsApp | A | SD | A | A | A | A | **A** |
| Marketing | A | SD | A | A | A | A | **A** |
| RH / Academia / Patrimônio | V | SD | V | A | V | A | **V/A** |
| Administração | V | SD | V | A | A | A | **A** |
| Painéis, BI e TV | V | SD | A | A | A | V | **A** |
| **App geral** | **A** | **SD** | **A** | **A** | **A** | **R** | **A** |

### Evidências
- **Funcional (A):** o projeto tem só 1 arquivo de teste. Nenhum fluxo crítico (venda para negócio, fechamento, parcelas) tem teste.
- **Propósito (SD):** nenhuma feature registra eventos de uso.
- **Performance:**
  - Os índices de busca por e-mail já existiam. A lentidão vinha do formato das consultas e da regra de leitura das vendas, que era conferida linha a linha. Isso já foi corrigido. A confirmação virá nas estatísticas dos próximos dias.
  - Resta a lista das primeiras compras: 90 mil chamadas, média de 2,3 s e até 30 s. Ela é usada em 7 telas de faturamento, e por isso o Fechamento ficou com nota R.
  - 641 arquivos consultam o banco, mas só 30 paginam. O corte silencioso em 1.000 linhas pode deixar relatórios incompletos sem aviso.
- **Confiabilidade (A):** 6 integrações não tratam erro (backfill-a010-em-aberto-from-logs, daily-a010-reconcile, export-all-contacts, export-orfaos-2026, meetgeek-gravacao, pos-venda-gravacao). Outras 33 chamam serviços externos sem limite de tempo.
- **Segurança (A; R no Consórcio):**
  - Todas as tabelas têm proteção ativa.
  - 78 regras de escrita em 52 tabelas liberam qualquer usuário logado, como consorcio_proposals, consorcio_proposal_cartas, consorcio_indicacoes, crm_contacts, product_price_history e sdr_squad_history.
  - A T4 está pausada por sua decisão e a T5 depende de você.
- **Manutenibilidade (R):**
  - 47 arquivos passam de 800 linhas. Os maiores são ConsorcioCardForm (3.303), useAgendaData (2.684), AgendaCalendar (2.034) e AgendaMeetingDrawer (1.981).
  - Há 1.567 "as any", 1.629 cores fixas e versões paralelas como useSdrMetricsV2.
- **Pontos positivos:** 134 telas carregam sob demanda e não há blocos de erro vazios. O Pós Venda registra as falhas de entrada sem bloquear a venda.

## 4. Gargalos concretos

```text
Banco      lista das primeiras compras recalculada a cada chamada (até 30 s)
Consultas  ~610 arquivos sem paginação (corte silencioso em 1.000)
Telas      9 arquivos com 1.500+ linhas em Agenda, Consórcio e CRM
Integração 6 sem tratamento de erro; 33 sem limite de tempo
Proteção   78 regras de escrita abertas a qualquer usuário logado
Usuário    sem teste: entrada de venda, fechamento, geração de parcelas
```

## 5. Top 10 (impacto x facilidade)

| # | Problema | Impacto | Facilidade |
|---|---|---|---|
| 1 | Ligar a proteção contra senhas vazadas (T5) | Alto | Muito fácil (painel) |
| 2 | Tratamento de erro nas 6 integrações | Alto | Fácil |
| 3 | Limite de tempo nas 33 integrações externas | Médio-alto | Fácil |
| 4 | Lista das primeiras compras: guardar o resultado por alguns minutos | Alto | Média |
| 5 | Fechar a escrita aberta nas tabelas sensíveis do Consórcio, contatos, preços e squad | Alto | Média |
| 6 | Relatórios com corte em 1.000 linhas: paginar ou avisar | Alto | Média |
| 7 | Testes nos 3 fluxos críticos | Alto | Média |
| 8 | Conferência de cargo nas funções chamáveis por logados (T4, pausada) | Médio | Média |
| 9 | Dividir os 4 maiores arquivos | Médio | Difícil |
| 10 | Remover versões paralelas (as 5 telas sem acesso ficam como estão) | Baixo-médio | Fácil |

## 6. O que hoje NÃO é mensurável

- Uso das features, porque não há registro de eventos.
- Tempo de abertura das telas, porque não há métricas do navegador.
- Taxa de erro por tela, porque os erros não são centralizados.
- Tempo das funções do banco por tela. Hoje só existe o total geral.
- Vendas que falharam ao entrar via Hubla, Kiwify e MCF Pay. Só o Pós Venda registra essas falhas.
- Disponibilidade das integrações, das TVs e do BI público.
- Cobertura de testes.

## Próximos passos (aprovação item a item)

1. Você liga a T5 no painel do Supabase.
2. Corrijo o tratamento de erro e o limite de tempo nas integrações, uma por vez.
3. Corrijo a lista das primeiras compras e confiro que os totais das telas não mudam.
4. Reviso as regras de escrita abertas, tabela por tabela.
5. Coloco a medição mínima: registro de erros e eventos de sucesso.

Nenhuma venda, cota ou cadastro será alterado.
