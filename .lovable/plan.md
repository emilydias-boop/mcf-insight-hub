# Padronização visual do Painel Comercial do Crédito

## Escopo
- Alterar exclusivamente `src/pages/bu-credito/PainelComercialCredito.tsx`.
- Preservar a RPC `painel_comercial_credito(p_from, p_to)`, seus tipos e os helpers `num`, `fmtBRL`, `fmtInt` e `fmtPct`.
- Não alterar dados, banco, hooks compartilhados ou o painel do Incorporador.

## Implementação
- Reproduzir o cabeçalho, filtros com URL, navegação mensal, período/horário de atualização e estados visuais do painel do Incorporador.
- Substituir os cards e o funil atuais por `TeamKPICards` com os dez indicadores e segmentações ICP solicitados.
- Reorganizar SDRs e Closers em abas, com tabelas, totais e estados vazios.
- Manter os três detalhamentos específicos do Crédito em uma grade compacta.
- Implementar exportação XLSX contextual por aba, sempre incluindo ICP e Origem.

## Validação
- Executar `npx tsgo --noEmit -p tsconfig.app.json`.
- Conferir o diagnóstico automático mais recente.
- Confirmar pelo diff que nenhum outro arquivo de aplicação mudou.
