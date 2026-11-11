# Modo TV da Meta de Cobrança: semana atual e metas das cobradoras

## O que muda (só no Modo TV da Meta de Cobrança; BI Comercial, BI Consórcio e BI Incorporador ficam iguais)
- **Ranking Semanal**: mostra só a semana atual. Some a "Semana 0" de 01/11 a 01/11 e as outras semanas.
- **"Metas individuais dos Closers"** passa a ser **"Metas individuais dos Cobradores"**, sempre com duas pessoas:
  - Bruna Carielo (bruna.carielo@minhacasafinanciada.com)
  - Leticia Rodrigues Barbosa (leticia.rodrigues@minhacasafinanciada.com, perfil financeiro)
- A meta de cada uma é a meta mensal ÷ 2 (R$ 125 mil cada sobre R$ 250 mil). Se o admin tiver gravado meta individual para alguma delas, vale esse valor.
- Cada cartão mostra quanto ela já recebeu em cobranças no mês (mesma regra de hoje: parcela 2+ em cobrança regular) e quanto falta. As duas aparecem mesmo zeradas.
- Outros cobradores e "Sem cobrador" não aparecem nesses cartões.

## Detalhes técnicos
- `BITVMode.tsx`: novas props opcionais `closersTitle` (padrão "Metas individuais dos Closers") e `apenasSemanaAtual` (padrão false, filtra `semanas` por `isCurrent`). As outras telas não passam essas props, então não mudam.
- `MetaCobrancaPainel.tsx`: lista fixa `COBRADORAS_META` por e-mail; resolve ids via perfis carregados; meta = meta individual gravada ou `meta geral / 2`; realizado = `porCobrador` do id (0 se ausente). Passa `closersTitle="Metas individuais dos Cobradores"` e `apenasSemanaAtual`.
- Painel da aba (fora do TV) fica como está.
