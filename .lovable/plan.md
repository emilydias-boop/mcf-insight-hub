# Rotas e links para a Biblioteca de Materiais (somente leitura)

Nada foi alterado. Domínio: https://mcfgestao.com

1. Visão Geral do CRM Pós-Venda (com o Painel Comercial) → https://mcfgestao.com/pos-venda/crm → App.tsx (rota `pos-venda/crm`, index = CRMOverview) e menu lateral. A rota antiga `/pos-venda/painel-comercial` só redireciona para lá.
2. Distribuição de novos licenciados → https://mcfgestao.com/pos-venda/distribuicao → App.tsx e menu lateral (admin e gerente de relacionamento).
3. Agenda de Reuniões do Pós-Venda → https://mcfgestao.com/pos-venda/crm/agenda → App.tsx (AgendaPosVenda).
4. Agenda do Consórcio → https://mcfgestao.com/consorcio/crm/agenda → menu lateral. Não existe tela própria de "alavancagem"; a reunião é marcada nessa agenda.
5. IA de condomínios → não existe no Gestão. Não há rota, menu nem tela. A palavra só aparece numa pergunta de qualificação do Crédito.
6. Harvey → nenhuma URL do Harvey no código, no .env ou nas tabelas. Existem só campos de identificação nos cards: `harvey_crm_id`, `harvey_cliente_id`, `stage_harvey`. Tela interna de importação: https://mcfgestao.com/pos-venda/importar-harvey (só admin).
7. Anamnese → nenhuma URL pública de formulário no código ou no banco. O formulário fica no Harvey, e o Gestão só recebe as respostas pelas funções `pos-venda-anamnese` (Pós-Venda) e `crm-externo-encaminhamento` (Consórcio/GR). Não existe tela própria de anamneses: a ficha aparece dentro do card do negócio, pelo botão de anamnese (campo `anamnese_v2`), em https://mcfgestao.com/pos-venda/crm/negocios.
8. Playbook → https://mcfgestao.com/playbook ("Meu Playbook", App.tsx e menu). Há 1 documento: "IT" (teste, SDR, PDF) → https://rehcfgqvigfcekiipqkc.supabase.co/storage/v1/object/public/playbook-files/sdr/1765311449554-zlnzjp.pdf
9. Canva, apresentação de alavancagem ou da R1 → nenhum link encontrado em playbook_docs, kb_documents, bu_strategic_documents, process_rules, activity_templates nem processo_materiais. As palavras aparecem só em textos, sem URL.
10. Criação do card no Pós-Venda → gatilho `zzz_pos_venda_entrada` na tabela `hubla_transactions`, que chama a função `pos_venda_on_venda`, e esta chama `pos_venda_registrar_cliente`. Como todas as vendas são gravadas nessa tabela, ela cobre Hubla, Kiwify e MCF Pay (a fonte vem do campo `source`; o padrão é "hubla"). O gatilho está ativo.
