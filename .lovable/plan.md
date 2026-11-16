# Relatório PDF — Transcrições das reuniões de Viabilidade (Pós-venda), novembro/2026

## O que será entregue
Um PDF no mesmo estilo dos relatórios anteriores (capa MCF CAPITAL, sumário, paginação), com todas as reuniões de viabilidade do Pós-venda de 01/11 a 30/11/2026 que tenham gravação.

Hoje existem em novembro: 76 realizadas, 53 agendadas, 7 no-show e 9 canceladas. Só reuniões realizadas têm transcrição; as demais aparecem apenas numa tabela de resumo.

## Conteúdo
1. Capa e sumário.
2. Visão geral: totais por status e por gerente; quantas realizadas têm ou não gravação encontrada.
3. Uma seção por reunião realizada (ordem por data): cliente, gerente, data/hora (São Paulo), resumo, próximos passos e transcrição completa.
4. Anexo: lista das reuniões realizadas sem gravação localizada, para conferência.

## Observações
- Somente leitura: nada é alterado no sistema nem publicado.
- As gravações são associadas às reuniões pela mesma regra já usada nas notas automáticas (e-mail do cliente, gerente e horário). Reuniões sem correspondência ficam no anexo.
- O PDF pode ficar extenso por causa das transcrições completas.
- O relatório incluirá dados pessoais e conversas de clientes; compartilhe com cuidado.

## Detalhes técnicos
- Consultas SELECT em pos_venda_reunioes + crm_deals/contatos + tabela de gravações/transcrições MeetGeek, usando a mesma lógica de associação do trigger de retroalimentação da jornada.
- Geração com reportlab (fonte DejaVu), QA visual de todas as páginas, arquivo em /mnt/documents/Relatorio_Transcricoes_Viabilidade_PosVenda_Nov2026.pdf.
