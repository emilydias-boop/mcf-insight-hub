# Application Health Assessment — Parte 4: SLIs, SLOs, Scorecard e Gargalos

Somente leitura. Nenhum código, banco ou integração foi alterado. As notas são preliminares e se baseiam só no código e nas estatísticas do banco.

Legenda: V = verde, A = amarelo, R = vermelho, SD = sem dados.

## 1. SLIs e SLOs padrão (valem para todas as features)

| Dimensão | Indicador (SLI) | Meta (SLO) | Como medir |
|---|---|---|---|
| Funcional | % de fluxos críticos com teste automatizado passando | 100% dos fluxos críticos | Testes ponta a ponta por fluxo |
| Propósito | Evento de sucesso por feature (ver tabela 2) | Meta definida pelo dono da BU | Registro de evento de uso (ainda não existe) |
| Performance | Tempo até a tela abrir com dados (p75) / tempo das consultas e funções do banco (p95) | Tela < 2,5 s; consulta < 500 ms; integração < 3 s | Métricas do navegador + estatísticas de consultas lentas |
| Confiabilidade | % de requisições com erro / % de vendas que falharam ao entrar | < 1% nas telas; 0 vendas perdidas por dia | Logs de erro do navegador + logs das integrações |
| Segurança | Tabelas com regra de escrita aberta; funções abertas sem login; entradas sem validação | 0 nas tabelas sensíveis | Alertas do Supabase + revisão de regras |
| Manutenibilidade | Arquivos > 800 linhas; uso de "as any"; lógica duplicada | Nenhum arquivo crítico > 800 linhas; "as any" caindo a cada mês | Contagem no código |

## 2. Critério de sucesso por feature (Propósito)

| Feature | Evento de sucesso a medir |
|---|---|
| CRM / Negócios | Negócio movido de etapa; lead novo atendido em até X horas |
| Agenda R1/R2 | Reunião agendada → realizada (comparecimento) |
| Entrada de vendas (Hubla, Kiwify, MCF Pay) | Venda recebida → registrada e vinculada ao negócio |
| Consórcio: cotas e parcelas | Cota cadastrada sem retrabalho; parcela gerada com a data certa |
| Fechamento SDR/Closer | Fechamento do mês aprovado sem recálculo manual |
| Contas a receber / Cobranças | Título em atraso → cobrança feita → pago |
| Pós Venda | Novo licenciado contatado e com nota registrada |
| Check-in / WhatsApp | Mensagem do cliente respondida em até X minutos |
| Marketing / A010 | Custo por lead e lead → R1 por canal |
| RH / Academia / Patrimônio | Trilha concluída; equipamento com responsável atual |
| Painéis Crédito/Solar, BI, TV | Painel aberto com dados do dia |

## 3. Notas preliminares por módulo

| Módulo | Func. | Prop. | Perf. | Conf. | Seg. | Manut. | Geral |
|---|---|---|---|---|---|---|---|
| CRM / Negócios | A | SD | R | A | A | R | **R** |
| Agenda R1/R2 | A | SD | A | A | A | R | **A/R** |
| Entrada de vendas | A | SD | R | A | A | A | **A** |
| Consórcio | A | SD | A | A | R | R | **R** |
| Fechamento SDR/Closer | A | SD | A | A | V | R | **A** |
| Financeiro / Cobranças | A | SD | A | A | A | A | **A** |
| Pós Venda | A | SD | V | V | V | A | **A/V** |
| Check-in / WhatsApp | A | SD | A | A | A | A | **A** |
| Marketing | A | SD | A | A | A | A | **A** |
| RH / Academia / Patrimônio | V | SD | V | A | V | A | **V/A** |
| Administração | V | SD | V | A | A | A | **A** |
| Painéis, BI e TV | V | SD | A | A | A | V | **A** |
| **App geral** | **A** | **SD** | **A/R** | **A** | **A** | **R** | **A** |

### Evidências
- **Funcional (A):** o projeto inteiro tem só 1 arquivo de teste. Nenhum fluxo crítico (venda → negócio, fechamento, parcelas) tem teste automatizado.
- **Propósito (SD):** não existe registro de eventos de uso em nenhuma feature.
- **Performance (R no CRM e na entrada de vendas):**
  - A tabela de vendas (hubla_transactions, 63 mil linhas) foi lida inteira 2,85 milhões de vezes.
  - A tabela de negócios (crm_deals, 72 mil) foi lida inteira 1,04 milhão de vezes.
  - A de contatos (206 mil) foi lida inteira 373 mil vezes.
  - Isso indica que faltam índices nos filtros mais usados.
- **Busca sem paginação:** 641 arquivos consultam o banco, mas só 30 paginam. O Supabase corta silenciosamente em 1.000 linhas, então pode haver relatórios incompletos sem aviso.
- **Confiabilidade (A):**
  - 6 integrações não tratam erro nenhum: backfill-a010-em-aberto-from-logs, daily-a010-reconcile, export-all-contacts, export-orfaos-2026, meetgeek-gravacao e pos-venda-gravacao.
  - 33 integrações chamam serviços externos sem limite de tempo de espera.
- **Segurança (A; R no Consórcio):**
  - Todas as tabelas têm proteção ativa.
  - Porém 78 regras de escrita em 52 tabelas liberam qualquer usuário logado. Entre elas: crm_contacts, consorcio_proposals, consorcio_proposal_cartas, consorcio_indicacoes, automation_queue, product_configurations, product_price_history e sdr_squad_history.
  - Continuam pendentes a T4 (27 funções), a T5 (senhas vazadas) e a T6 (deal_current_stages).
- **Manutenibilidade (R):**
  - 47 arquivos têm mais de 800 linhas. Os maiores: ConsorcioCardForm (3.303), useAgendaData (2.684), AgendaCalendar (2.034), AgendaMeetingDrawer (1.981), useConsorcioPostMeeting (1.662), useSdrFechamento (1.624), QuickScheduleModal (1.592), OpenCotaModal (1.519) e Negocios (1.517).
  - Há 1.567 usos de "as any", que desligam a checagem de tipos.
  - Há 1.629 cores fixas fora do padrão visual.
  - Existem versões paralelas, como useSdrMetricsV2.
  - 5 telas não têm caminho de acesso (Partes 2 e 3).
- **Pontos positivos:**
  - 134 telas carregam sob demanda, então o carregamento inicial é leve.
  - Não há blocos de erro vazios.
  - A entrada de vendas do Pós Venda registra as falhas em vez de bloquear a venda.

## 4. Gargalos concretos

```text
Banco      leituras inteiras repetidas em hubla_transactions, crm_deals, crm_contacts
           e consortium_installments (426 mil linhas, lida inteira 48 mil vezes)
Consultas  ~610 arquivos sem paginação (corte silencioso em 1.000)
Telas      9 arquivos com 1.500 linhas ou mais na Agenda, Consórcio e CRM
           (re-renderizações grandes a cada mudança)
Integração 6 sem tratamento de erro; 33 sem limite de tempo de espera
Proteção   78 regras de escrita abertas a qualquer usuário logado
Usuário    fluxos sem teste: entrada de venda, fechamento e geração de parcelas
```

## 5. Top 10 problemas (impacto × facilidade)

| # | Problema | Impacto | Facilidade |
|---|---|---|---|
| 1 | Ligar a proteção contra senhas vazadas (T5) | Alto | Muito fácil (painel) |
| 2 | Índices para os filtros de vendas, negócios e contatos | Alto | Fácil |
| 3 | Tratamento de erro nas 6 integrações sem nenhum | Alto | Fácil |
| 4 | Limite de tempo de espera nas 33 integrações externas | Médio-alto | Fácil |
| 5 | Fechar a escrita aberta nas tabelas sensíveis (propostas e cartas do consórcio, contatos, preços, histórico de squad) | Alto | Média |
| 6 | Relatórios com corte silencioso em 1.000 linhas: paginar ou avisar | Alto | Média |
| 7 | Testes nos 3 fluxos críticos (venda → negócio, fechamento, parcelas) | Alto | Média |
| 8 | Revisar a leitura externa de deal_current_stages (T6) | Médio | Fácil |
| 9 | Dividir os 4 maiores arquivos (ConsorcioCardForm, useAgendaData, AgendaCalendar, AgendaMeetingDrawer) | Médio | Difícil |
| 10 | Remover versões paralelas e telas sem acesso, depois de confirmar | Baixo-médio | Fácil |

## 6. O que hoje NÃO é mensurável

- **Uso das features (Propósito):** não há registro de eventos.
- **Tempo de abertura das telas:** não há métricas do navegador.
- **Taxa de erro por tela:** os erros não são centralizados.
- **Tempo de cada função do banco por tela:** só existe o total geral.
- **Vendas que falharam ao entrar:** só o Pós Venda registra falhas. Hubla, Kiwify e MCF Pay não têm painel de falhas.
- **Disponibilidade das integrações e das TVs/BI público.**
- **Cobertura de testes**, porque não existem testes.

## Próximos passos (só com aprovação, item a item)

1. Você liga a T5 no painel do Supabase.
2. Proponho os índices do item 2, com as consultas exatas, para você aprovar.
3. Corrijo o tratamento de erro e o limite de tempo nas integrações (itens 3 e 4), uma por vez.
4. Reviso as regras de escrita abertas, tabela por tabela, conferindo quais telas usam cada uma.
5. Coloco a medição mínima: registro de erros e eventos de sucesso por feature.

Em cada passo, nenhuma venda, cota ou cadastro é alterado. Antes de seguir para o próximo, confiro na tela que nada quebrou.
