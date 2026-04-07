

# Limpeza: 20 Leads Backfill Duplicados no Inside Sales

## Diagnostico

Dos **147 deals com tag Backfill** criados ontem, **20 sao duplicatas** de leads que ja existiam no sistema. Eles nao foram detectados pelo backfill porque usavam **emails diferentes** (ex: `andresmacedos@gmail.com` vs `andre_smacedo@hotmail.com`) — a deduplicacao foi feita apenas por email, mas o telefone e o mesmo.

Esses 20 leads ja estavam sendo trabalhados e **nao sao leads perdidos novos**. Mante-los gera:
- Contagem inflada no funil (86 "Novo Lead" inclui duplicatas)
- SDR recebe lead que outro SDR ja trabalha
- Historico do lead fica fragmentado entre dois contatos

### Os 20 duplicados

| Backfill | Email Backfill | Ja existia como | Email original |
|----------|---------------|-----------------|----------------|
| André Santos | andresmacedos@gmail.com | André Santos | andre_smacedo@hotmail.com |
| Andresa Cristina Vaz | kizy.andresa@gmail.com | Andresa Vaz | (phone match) |
| Bhruno Nalin de Souza | bhruno.nalin@gmail.com | Bhruno Souza | bhruno.niteroi@gmail.com |
| Carlos Barros | carlos.barros@monetali.com | Carlos Barros | camdbgalo@gmail.com |
| Cesar Schneider | cesar@eworlslabs.com | Cesar Schneider | cesar@eworkslabs.com |
| Danilo Corado | danilo@gestora... | DANILO SERRA CORAO | raimundoalvesnunes78@... |
| Danilo Pellegrino | danilo.pellegrino@icloud.com | Danilo Pellegrino | danilo@sport360.com.br |
| Fabio Gomes | fabiogomesoliveira@hotmail.com | Fabio Gomes | ec.fabio.oliveira@gmail.com |
| Fernando Lucas | engfernando.assumpcao@gmail.com | Fernando Lucas | fernando.assumpcao@outlook.com |
| Fernando Rodrigo | fermoraisfer@gmail.com | Fernando Rodrigo | fernandorodrigodemorais@... |
| Francisco Wellington | wellingtonms2@hotmail.com | Francisco Wellington | wmedeirosrep@hotmail.com |
| Gilberto Pavanelli | gilberto.pavanell.jr@gmail.com | Gilberto Pavanelli | gilberto.pavanelli.jr@... |
| Liliana Miranda | lilianamcapanema@gmail.com | Liliana Miranda | lmcapa@hotmail.com |
| Lucine Ferrari | lucineferrari@gmail.com | Lucne Serina | (phone match) |
| Murillo Heguer | murilloheguer0223@gmail.com | Murillo Heguer | mhservicosemsaude@gmail.com |
| Rafael Santos | eng.rferreira97@gmail.com | Rafael Santos Ferreira | rafael141197@gmail.com |
| Thiago Grossi | tgrossis17@gmail.com | Thiago Grossi | thiago@tgplanejamentos.com |
| Valdecir Ribeiro | engenhariavival@gmail.com | Valdecir Ribeiro | engenheirovaldecir7@... |
| Vinicius Valente | vinicius0@outlook.com | Vinicius Valente | vinivalente27@gmail.com |

Alem disso, **17 backfill deals** tem o mesmo `contact_id` com deals em outras pipelines (Viver de Aluguel, Efeito Alavanca, Gerentes de Relacionamento) — esses sao validos pois o lead pode ter deal em Inside Sales + outra pipeline.

## Plano de Correcao

### 1. Migration: Deletar os 20 deals duplicados + arquivar contatos duplicados

Para cada duplicata:
- **Deletar** o deal backfill (o lead ja tem deal ativo no Inside Sales sob outro contato)
- **Arquivar** o contato backfill e vincular ao contato principal (`merged_into_contact_id`)

Isso reduz o funil de ~86 "Novo Lead" para ~66 leads genuinamente perdidos.

### 2. Melhoria futura no backfill (opcional)

Adicionar verificacao por sufixo de 9 digitos do telefone antes de criar deal, nao apenas por email. Isso preveniria esse tipo de duplicata em backfills futuros.

### Arquivos

| Recurso | Acao |
|---------|------|
| Migration SQL | DELETE 20 deals + UPDATE 20 contacts (archive + merge) |
| `supabase/functions/backfill-orphan-a010-deals/index.ts` | (futuro) Adicionar check por phone suffix |

