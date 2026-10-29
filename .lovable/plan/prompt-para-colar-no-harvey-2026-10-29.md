# Prompt para colar no HARVEY

Copie o bloco abaixo e cole no HARVEY. Nada muda no MCF; ao aprovar, só salvo este texto também em um arquivo para download.

```text
Quero receber, guardar e mostrar aos meus clientes o "Relatório da Cota" de consórcio enviado pelo sistema MCF. Cada cliente deve ver SOMENTE as próprias cotas.

1) ENDPOINT DE RECEBIMENTO
Crie uma função de backend pública (sem login) que aceite POST JSON em /mcf-relatorio-cota.
- Valide o cabeçalho X-MCF-Signature: é o HMAC-SHA256 em hexadecimal do corpo bruto da requisição, usando a chave secreta MCF_WEBHOOK_SECRET (guarde como segredo; a mesma chave será configurada no MCF). Compare em tempo constante. Assinatura inválida => 401 e não grava nada.
- Aceite só tipo = "consorcio.relatorio_cota.v1". Outro tipo => 400.
- Responda 200 com {"ok": true} quando gravar. Erros devolvem status 4xx/5xx com texto curto (o MCF registra o erro e reenvia depois).
- Reenvio do mesmo cota.id + mes_referencia deve SUBSTITUIR o registro anterior (upsert), nunca duplicar.

Formato recebido:
{
  "tipo": "consorcio.relatorio_cota.v1",
  "mes_referencia": "2026-10",
  "cota": {
    "id": "uuid da cota no MCF",
    "cliente": "Nome completo ou razão social",
    "cpf": "string ou null",
    "cnpj": "string ou null",
    "email": "string ou null",
    "grupo": "string", "cota": "string",
    "valor_credito": 0, "tipo_produto": "string ou null",
    "data_contratacao": "AAAA-MM-DD ou null",
    "data_contemplacao": "AAAA-MM-DD ou null",
    "motivo_contemplacao": "string ou null"
  },
  "meses": [
    {
      "mes": "AAAA-MM",
      "assembleia": { "numero": 0, "data": "AAAA-MM-DD", "sorteio": "string ou null" } | null,
      "loteria": { "numero": "string", "aplicado": "string ou null", "consultado_em": "data/hora ISO" } | null,
      "lances": [ { "data": "AAAA-MM-DD", "tipo": "embutido|livre|fixo|null", "percentual": 0, "valor": 0, "chance": "string", "posicao_estimada": 0 | null } ],
      "resultados": [ { "modalidade": "string ou null", "percentual": 0 | null, "data": "AAAA-MM-DD ou null" } ]
    }
  ]
}

2) DADOS
- Tabela mcf_cotas: mcf_cota_id (único), cliente_nome, documento (só dígitos de cpf ou, se nulo, cnpj), email, grupo, cota, valor_credito, tipo_produto, data_contratacao, data_contemplacao, motivo_contemplacao, cliente_id (vínculo com o cliente do HARVEY, pode ser nulo), atualizado_em.
- Tabela mcf_relatorios: mcf_cota_id + mes_referencia (únicos juntos), meses (JSON completo recebido), recebido_em.
- Guarde o payload exatamente como veio; não recalcule nada.

3) VÍNCULO DE/PARA (CPF + NOME)
Ao receber, vincule a cota ao cliente do HARVEY assim:
- Normalize CPF/CNPJ removendo tudo que não for dígito.
- Normalize nome: maiúsculas, sem acentos, espaços extras removidos.
- Vincule SOMENTE quando o documento for igual E o primeiro nome for igual ao do cadastro do cliente. As duas condições são obrigatórias.
- Se não achar cliente, ou achar mais de um, ou o documento bater e o nome não: grave a cota com cliente_id nulo e registre em uma lista "Cotas sem vínculo" para um administrador vincular manualmente. Nunca vincule por aproximação.
- Quando um cliente for cadastrado/atualizado depois, tente vincular de novo as cotas pendentes com a mesma regra.

4) SEGURANÇA (OBRIGATÓRIO)
- Ative políticas de acesso por linha nas duas tabelas: o cliente logado só lê linhas cujo cliente_id seja o dele; mcf_relatorios só é visível se a cota correspondente for dele.
- Cliente não pode inserir, alterar nem apagar nada. Só a função de recebimento (com chave de serviço) grava.
- Administradores veem tudo, inclusive "Cotas sem vínculo". Papéis em tabela própria de papéis, nunca no perfil.
- Nunca exponha CPF completo na tela do cliente; mostre mascarado (***.***.123-45).

5) TELA DO CLIENTE: "Minha Cota"
- Lista das cotas do cliente (grupo/cota, crédito, situação: contemplada ou em andamento).
- Ao abrir uma cota, linha do tempo mês a mês (mais recente primeiro) com:
  - Data e número da assembleia.
  - Número da Loteria Federal usado e número aplicado ao grupo.
  - Lances ofertados: tipo (Lance embutido / Lance livre / Lance fixo; null = "Tipo não informado"), percentual, valor em R$, chance e posição estimada.
  - Resultado do mês, quando houver.
  - Mês sem nenhum dado: "Sem movimentação registrada neste mês".
- Destaque no topo: "Nossa equipe acompanha sua cota todos os meses para buscar a contemplação." Se contemplada, mostre data e motivo.
- Datas no formato brasileiro, fuso America/Sao_Paulo, valores em R$.
- Não mostre o id interno do MCF.

6) TELA DO ADMIN
- Lista de recebimentos (cota, cliente, mês, data de recebimento) e a lista "Cotas sem vínculo" com botão para escolher o cliente manualmente.
```

## O que você precisa me devolver depois

1. A URL final do endpoint criado no HARVEY (ex.: `https://.../functions/v1/mcf-relatorio-cota`).
2. A chave secreta escolhida (cadastro aqui como segredo do MCF, nunca em código).

Com isso eu ligo o envio do lado MCF.
