

## Diagnóstico: Configuração de Metas do Time

### O que aconteceu

Verifiquei os dados no banco para fevereiro 2026 (BU Incorporador):

| Campo | Valor no Banco |
|---|---|
| meta_valor | 900.000 |
| supermeta_valor | 1.000.000 |
| ultrameta_valor | 1.200.000 |
| ultrameta_premio_ifood | 1.000 |
| meta_divina_valor | 1.600.000 |
| meta_divina_premio_sdr | **50.000** |
| meta_divina_premio_closer | **50.000** |

### Problemas identificados

**1. Prêmio Meta Divina veio automático (R$ 50.000)**
Quando você criou as metas de fevereiro, o sistema pré-preencheu o formulário com valores padrão hardcoded no código:
```text
meta_divina_premio_sdr: 50000
meta_divina_premio_closer: 50000
```
Ou seja, mesmo sem você definir, ao clicar "Salvar" esses valores foram gravados. Isso é um bug — os defaults deveriam ser **zero**, não 50 mil.

**2. Onde configurar tudo isso**
A configuração fica em: **Configurações** (botão no topo da tela de Fechamento Equipe) **→ aba "Metas do Time"**. Lá tem campos para:
- Meta / Supermeta / Ultrameta: valor alvo + prêmio iFood de cada nível
- Meta Divina: valor alvo + prêmio SDR + prêmio Closer

O iFood da Ultrameta **já está configurado** (R$ 1.000) e aparece no badge da tela.

### Correção proposta

1. **Alterar DEFAULT_GOAL_VALUES**: Zerar os prêmios padrão para que novos meses não venham com valores fantasma:
   - `meta_divina_premio_sdr: 0`
   - `meta_divina_premio_closer: 0`
   - `ultrameta_premio_ifood: 0`
   - `supermeta_premio_ifood: 0`

2. **Destacar visualmente quando há valores padrão não salvos**: Quando o mês ainda não tem configuração salva, mostrar um aviso "Valores padrão — salve para confirmar" para evitar gravar acidentalmente.

3. **Corrigir fevereiro no banco**: Zerar os prêmios da Meta Divina de fevereiro já que você não pretendia configurá-los (ou ajustar para o valor desejado via a aba Metas do Time).

