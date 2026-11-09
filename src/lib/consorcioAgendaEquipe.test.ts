import { strict as assert } from 'node:assert';
import {
  filtrarClosersConsorcio,
  filtrarSdrsConsorcio,
  CONSORCIO_CLOSER_R1_PERMITIDOS,
  CONSORCIO_SDR_PERMITIDOS,
} from './consorcioAgendaEquipe';

/** Sem dependência de runner: roda com `bun src/lib/consorcioAgendaEquipe.test.ts`. */

const closersConsorcio = [
  { id: 'c1', name: 'Bruno de Souza Albuquerque', email: 'bruno.albuquerque@minhacasafinanciada.com' },
  { id: 'c2', name: 'Cleiton Lima', email: 'cleiton.lima@minhacasafinanciada.com' },
  { id: 'c3', name: 'Jessica Bellini', email: 'jessica.bellini@minhacasafinanciada.com' },
  { id: 'c4', name: 'João Pedro Martins Vieira', email: 'joao.pedro@minhacasafinanciada.com' },
  { id: 'c5', name: 'Thobson', email: 'thobson.motta@minhacasafinanciada.com' },
];

const sdrsConsorcio = [
  { id: 's1', name: 'Andre dos Santos Duarte', email: 'andre.duarte@minhacasafinanciada.com' },
  { id: 's2', name: 'Ithaline clara dos santos', email: 'ithaline.clara@minhacasafinanciada.com' },
  { id: 's3', name: 'João Pedro Martins Vieira', email: 'joao.pedro@minhacasafinanciada.com' },
  { id: 's4', name: 'Leonardo Lemos', email: 'leonardo.lemos@minhacasafinanciada.com' },
  { id: 's5', name: 'Mylena Ribeiro', email: 'mylena.ribeiro@minhacasafinanciada.com' },
];

// 1) Consórcio: closer da Agenda R1 só Cleiton e Bruno.
const closersLiberados = filtrarClosersConsorcio('consorcio', closersConsorcio);
assert.deepEqual(
  closersLiberados.map((c) => c.name),
  ['Bruno de Souza Albuquerque', 'Cleiton Lima'],
  'closer do Consórcio deve ficar só com Bruno e Cleiton',
);

// 2) Consórcio: SDR Responsável só Ithaline e Mylena.
const sdrsLiberados = filtrarSdrsConsorcio('consorcio', sdrsConsorcio);
assert.deepEqual(
  sdrsLiberados.map((s) => s.name),
  ['Ithaline clara dos santos', 'Mylena Ribeiro'],
  'SDR do Consórcio deve ficar só com Ithaline e Mylena',
);

// 3) Outras BUs continuam com a lista inteira.
assert.deepEqual(filtrarClosersConsorcio('solar', closersConsorcio), closersConsorcio);
assert.deepEqual(filtrarSdrsConsorcio('credito', sdrsConsorcio), sdrsConsorcio);
assert.deepEqual(filtrarClosersConsorcio(null, closersConsorcio), closersConsorcio);

// 4) E-mail com caixa/espaços diferentes no cadastro ainda casa.
assert.deepEqual(
  filtrarClosersConsorcio('consorcio', [
    { id: 'c2', name: 'Cleiton Lima', email: '  Cleiton.Lima@MinhaCasaFinanciada.com ' },
    { id: 'c3', name: 'Jessica Bellini', email: 'jessica.bellini@minhacasafinanciada.com' },
  ]).map((c) => c.name),
  ['Cleiton Lima'],
);

// 5) Se ninguém da lista estiver permitido, a lista volta intacta
//    (o usuário nunca pode ficar sem closer para agendar).
const semCorrespondencia = [{ id: 'x', name: 'Alguém', email: 'ningue@mcf.com' }];
assert.deepEqual(filtrarClosersConsorcio('consorcio', semCorrespondencia), semCorrespondencia);
assert.deepEqual(filtrarSdrsConsorcio('consorcio', []), []);

// 6) As duplas permitidas são exatamente as nomes acordados.
assert.deepEqual(
  [...CONSORCIO_CLOSER_R1_PERMITIDOS].sort(),
  ['bruno.albuquerque@minhacasafinanciada.com', 'cleiton.lima@minhacasafinanciada.com'],
);
assert.deepEqual(
  [...CONSORCIO_SDR_PERMITIDOS].sort(),
  ['ithaline.clara@minhacasafinanciada.com', 'mylena.ribeiro@minhacasafinanciada.com'],
);

console.log('consorcioAgendaEquipe: OK');
