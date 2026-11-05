import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const endpoint = `${Deno.env.get('SUPABASE_URL')}/functions/v1/consultar-jornada`;
const headers = { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' };

Deno.test('CPF de Nívia retorna f4 e datas somente das atividades registradas', async () => {
  const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ cpf: '632.070.522-15' }) });
  assertEquals(r.status, 200);
  const d = await r.json();
  assertEquals(d.primeiro_nome, 'Nivia');
  assertEquals(d.etapa_atual, 'f4');
  assertEquals(d.data_compra, '2026-10-22T19:08:37.221+00:00');
  assertEquals(d.historico.f3, '2026-10-29T19:35:53.749837+00:00');
  assertEquals(d.historico.f4, '2026-11-03T14:53:02.267824+00:00');
  for (const codigo of ['f5', 'f6', 'f7', 'f8']) assertEquals(d.historico[codigo], null);
});

Deno.test('CPF inexistente mantém 404 com erro sem dados cadastrais', async () => {
  const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ cpf: '00000000000' }) });
  assertEquals(r.status, 404);
  assertEquals(await r.json(), { erro: 'Não encontramos uma jornada com esse CPF.' });
});