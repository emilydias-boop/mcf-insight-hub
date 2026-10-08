# Novos licenciados no Pós Venda

## O que conferimos hoje (08/10, somente leitura)
- Hoje entraram vendas de A001, A009 e R009 pela Hubla e pelo MCFPay: 15 pagamentos, 10 clientes.
- **Nenhuma delas chegou à pipeline "Relacionamento - Pós venda".** Os 1.314 cards que estão lá vieram todos da importação do Harvey.
- A pipeline tem 3 etapas hoje: Reunião de Viabilidade 1, Reunião de Viabilidade 2 e Viabilidade Concluída.

## O que será construído

### 1. Nova etapa "Novos licenciados"
- Criada como **primeira** etapa da pipeline Pós Venda, antes de "Reunião de Viabilidade 1". As outras etapas e os 1.314 cards não mudam.

### 2. Entrada automática das vendas novas
- Quando a Hubla, a Kiwify ou o MCFPay confirmarem um pagamento aprovado de **A001, A003, A004, A009, R001, R002, R004 ou R009**:
  - Ficam de fora: renovação (nome com "renova"), reembolso e parcela 2/12 em diante da recorrência (só a primeira compra conta).
  - Se o cliente já tiver card no Pós Venda: **não cria outro card**, só registra a compra nova no histórico dele.
  - Se não tiver: cria o card em "Novos licenciados" e reaproveita o cadastro de contato, se já existir (por e-mail; por telefone só se o nome também bater, a mesma regra do Harvey).
  - O card é entregue ao gerente sorteado pela distribuição (item 3).
- Nada muda no Inside Sales, no Consórcio ou no Crédito. A regra que bloqueia parceiros no Inside Sales continua igual.

### 3. Distribuição por gerente (configuração da BU Pós Venda)
- Nova tela em BU Pós Venda > Configurações > "Distribuição de novos licenciados". Só administradores e gestores do Pós Venda podem acessá-la.
- A tela lista os gerentes de relacionamento, cada um com: ativo sim/não e % de distribuição. Só salva se a soma dos ativos der 100%.
- Começa com Karen Nazário com 100%.
- A divisão segue o % com o tempo (quem estiver mais abaixo do seu % recebe o próximo cliente). Assim, a divisão fica equilibrada mesmo com poucas vendas.
- A divisão só vale para a etapa "Novos licenciados" do Pós Venda.

### 4. Regra para tirar o card de "Novos licenciados"
- Ao arrastar o card para fora dessa etapa, abre uma janela pedindo:
  - **Nota do contato** (obrigatória, salva no histórico do card).
  - **Destino**: próxima etapa do Pós Venda, **BU Consórcio** ou **BU Crédito Imobiliário**.
- Mesma pipeline: só a nota é exigida.
- Outra BU: o card do Pós Venda continua existindo, marcado como encaminhado. Um negócio novo é criado na primeira etapa da pipeline da BU escolhida, ligado ao card de origem, com a nota e quem encaminhou.
- A regra também é aplicada no banco, então o card não sai da etapa sem a nota, mesmo fora do arrastar.

### 5. Rastreabilidade para a linha do tempo
- Cada entrada (venda), mudança de etapa e transferência de BU é gravada num histórico único por cliente: data, de onde, para onde, quem fez e a nota.
- A tela de linha do tempo **não** entra agora. Fica pronta para ser feita quando você mandar o desenho.

## O que preciso confirmar antes de aplicar
- Hoje não existe nenhuma venda com nome A004, R002 ou R004. Vou incluir esses códigos para quando aparecerem.
- Gostaria de trazer para "Novos licenciados" as 10 vendas de hoje? Elas **não entram sozinhas**. Para trazê-las, preciso da sua autorização.
- Nada será publicado sem o seu pedido.

## Detalhes técnicos
- Migration: INSERT da etapa (stage_order 0) em crm_stages, na origem POS_VENDA_ORIGIN_ID; tabela `pos_venda_distribuicao` (profile_id, percentual, ativo, recebidos) com GRANT + RLS (admin/gerente_relacionamento) e trigger de soma 100; tabela `crm_cliente_timeline` (contact_id, deal_id, evento, origin/stage de/para, nota, actor, created_at); função SECURITY DEFINER `pos_venda_ingest_venda(tx)` com dedup por contato na origem Pós Venda e sorteio por déficit de %; trigger em crm_deals com WHEN na origem Pós Venda exigindo nota ao sair de "Novos licenciados", no mesmo padrão do bloqueio de entregáveis.
- Webhooks hubla-webhook-handler, kiwify-webhook-handler e o fluxo MCFPay: chamada adicional e isolada à função de ingestão, depois da gravação atual. A chamada fica em try/catch, para que uma falha não afete o fluxo existente.
- Frontend: StageMoveDialog para o Pós Venda reaproveitando crm-externo-encaminhamento / deal_replication para criar o card na BU de destino; tela de configuração em src/pages/pos-venda.
- AGENTS.md: registrar a regra de entrada das vendas e da distribuição isolada na origem Pós Venda.
