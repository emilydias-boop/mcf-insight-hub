# Visão 360 do Cliente — jornada completa

Página nova, só de leitura, para consultar um cliente e ver tudo o que ele viveu na empresa. Ela não muda nenhum dado nem nenhuma regra de outra BU. A tela /clientes que já existe continua igual e ganha um botão "Abrir visão 360" que leva à página nova.

## Como o cliente é identificado
O cliente é encontrado pelo contato do CRM. A busca junta os registros do mesmo cliente usando o e-mail (sem diferença de maiúsculas) ou os 9 últimos dígitos do telefone, seguindo a regra de deduplicação que o app já usa. A busca aceita nome, e-mail, telefone ou CPF.

## Layout (seguindo o desenho)
```text
[Foto/iniciais] Nome · selo de perfil  [Editar] [Ações]
telefone · e-mail · cidade | Desde · ID · SDR · Closer · Gerente de Relacionamento
[Saúde do relacionamento][Valor total investido][Produtos ativos][Tempo de relacionamento][Pendências financeiras]
Abas: Visão 360 | Produtos | Financeiro | Interações | Documentos | Histórico | Oportunidades
Visão 360: Índice de Relacionamento | Carteira de Produtos | Resumo Financeiro
           Últimas Interações       | Linha do Tempo + Evolução do Patrimônio | Produtos sugeridos
```
O visual segue o desenho: fundo escuro, verde-limão como destaque e âmbar para alertas. As cores ficam valendo só nesta página.

## Linha do tempo (aba Histórico): eventos e de onde vêm
| Evento | Origem dos dados |
|---|---|
| Entrada como lead (canal, pipeline) | criação dos cards no CRM |
| Contatos do SDR (ligações, WhatsApp, notas, tarefas) | ligações, atividades e tarefas do card |
| Qualificação | respostas da qualificação |
| R1 agendada, realizada, no-show, reagendada (com SDR e closer) | Agenda R1 e participantes |
| Contrato A000 pago | vínculo do contrato com a R1 e transações |
| R2 agendada e realizada, carrinho | Agenda R2 |
| Venda A001, A002, A003, A005, A009 e R001, R002, R003, R005, R009 | transações Hubla, Kiwify e MCFPay |
| Reembolsos | reembolsos |
| Mudanças de etapa ou de pipeline | histórico de etapas do card |
| Entrada no Pós Venda, nota de contato, encaminhamentos para Crédito e Consórcio | linha do tempo do cliente e encaminhamentos já gravados |
| Cotas de consórcio (proposta, contratação, parcelas, contemplação) | propostas e cotas do consórcio |
| Operações de crédito | vendas de crédito |
| Anamnese do Harvey | ficha do card do Pós Venda |

Cada evento mostra data e hora (horário de Brasília), BU, responsável e um link para o card ou a tela de origem. Isso dá a rastreabilidade de ponta a ponta. A linha do tempo resumida da Visão 360 mostra só os marcos principais: primeira compra, entrada no Pós Venda e cada novo produto.

## Indicadores do desenho: de onde vem cada um
- **Valor total investido:** soma do valor contratado dos produtos, sem reembolsados, mais o crédito das cotas de consórcio.
- **Produtos ativos e adquiridos:** códigos distintos comprados, com status (ativo, parcelado, adimplente, atrasado).
- **Tempo de relacionamento:** data da primeira compra até hoje.
- **Pendências financeiras e Resumo financeiro:** parcelas abertas ou vencidas no contas a receber e no consórcio, com a adimplência geral em %.
- **Evolução do patrimônio:** valor acumulado mês a mês.
- **Índice de relacionamento (0 a 100) e nota (A+ a D):** a fórmula precisa da sua aprovação, veja abaixo.
- **Produtos sugeridos:** códigos que o cliente ainda não tem, com uma pontuação simples de aderência. A regra também precisa da sua aprovação.
- **Criar oportunidade:** usa o encaminhamento que já existe (Crédito "Em contato", Consórcio "Novo Lead"). Não há regra nova.

## Pontos que dependem da sua decisão
1. **Pesos do índice de relacionamento:** proponho os do desenho, ou seja, tempo de relacionamento 20%, valor investido 25%, quantidade de produtos 20%, engajamento 20% e adimplência 15%. Os cortes de nota também precisam ser definidos.
2. **Regra dos produtos sugeridos:** por enquanto, mostrar só "não possui" sem percentual, até a regra ser definida.
3. **Quem pode ver a página:** proponho admin, manager, coordenador, gerente de relacionamento e o SDR ou closer do próprio cliente.
4. **Itens do desenho sem dado no sistema hoje:** "The Club", "Holding Leilão", "Solar investidor", "App MCF" e o rendimento. Eles aparecem como "sem dado" até existir uma fonte para eles.

## Entregas
1. Busca e cabeçalho com indicadores.
2. Linha do tempo completa com filtros por BU e por tipo de evento.
3. Carteira de produtos, resumo financeiro e evolução do patrimônio.
4. Índice de relacionamento e produtos sugeridos, depois das decisões acima.
5. Abas Interações, Documentos e Oportunidades.

## Detalhes técnicos
- Uma função de banco somente leitura, `cliente_360(contact_id)`, que é SECURITY DEFINER com checagem de papel e devolve o cabeçalho, os KPIs e a carteira. Outra função, `cliente_timeline(contact_id)`, devolve um UNION com os eventos normalizados (ts, tipo, bu, titulo, detalhe, ator, link). Elas não criam tabelas nem gatilhos e não alteram dados. A migration só cria essas funções e os GRANTs.
- Rota nova `/clientes/:contactId/360` em App.tsx e um botão na ficha atual, sem mexer no restante.
- Tema escopado por uma classe no container da página, no mesmo padrão da Academia.
- Validação com typecheck e build, mais uma checagem no navegador com um cliente real, por exemplo um cliente com A000, A001 e Pós Venda.
