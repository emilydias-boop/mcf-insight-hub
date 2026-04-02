

## Plano: Botao rapido "Marcar como Paga" + Robô Newcon

### Parte 1 — Botao rapido de confirmar pagamento (implementar agora)

Hoje o "Marcar como Paga" ja existe no dropdown (tres pontinhos), mas exige 2 cliques. Vamos adicionar um botao direto na linha para parcelas nao pagas.

**Mudanca em `src/components/consorcio/pagamentos/PagamentosTable.tsx`**:
- Adicionar um botao `CheckCircle` visivel diretamente na coluna "Acoes" ao lado do dropdown, apenas para parcelas com status diferente de `paga`
- Ao clicar, chama `handleMarkAsPaid(row)` imediatamente (mesmo fluxo ja existente via `usePayInstallment`)
- Botao verde com tooltip "Marcar como paga" para acao rapida com 1 clique

### Parte 2 — Robo Newcon (analise de viabilidade)

A intranet Newcon funciona via login/senha no navegador, sem API publica. Para automatizar a coleta de boletos e status de pagamento, seria necessario fazer **web scraping** (navegacao automatizada simulando um usuario).

**Limitacoes tecnicas**:
- Edge Functions do Supabase nao suportam navegadores headless (Puppeteer/Playwright) — sao ambiente Deno com recursos limitados
- Seria necessario um servidor externo rodando o bot (ex: servidor VPS com Puppeteer, n8n self-hosted, ou servico como Apify/BrowserBase)
- O scraping depende da estrutura HTML da Newcon, que pode mudar sem aviso

**Opcoes possiveis**:
1. **n8n workflow** — Usar n8n (ja disponivel como MCP) com nodes de HTTP Request para simular login e navegar na intranet, extraindo boletos e status. Requer que a Newcon nao bloqueie automacao.
2. **Servidor externo com Puppeteer** — Script Node.js rodando em VPS que faz login, navega, baixa PDFs e envia para o Supabase via API. Mais robusto mas requer infraestrutura separada.
3. **Extensao de navegador** — Uma extensao Chrome que o operador ativa enquanto esta logado na Newcon, capturando os dados automaticamente.

Nenhuma dessas opcoes pode ser implementada 100% dentro do Lovable. Precisariamos de acesso a Newcon para entender a estrutura do site antes de propor a melhor abordagem.

### Recomendacao

Implementar agora a **Parte 1** (botao rapido) para agilizar o fluxo manual. Para a Parte 2, precisamos:
1. Voce compartilhar a URL da intranet Newcon
2. Entender a estrutura de navegacao (como chega nos boletos)
3. Definir qual infraestrutura externa voce tem disponivel (VPS, n8n, etc.)

