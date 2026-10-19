import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the production branches without creating meetings or payments.
const load = (path: string) => readFileSync(path, 'utf8');
const compile = (body: string, params: string[]) => new Function(...params,
  ts.transpile(body, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }));
function client(tables: Record<string, any[]>, rpcData: any = null, rpcError: any = null) {
  const calls: Array<[string, string, any[]]> = [];
  return {
    calls,
    rpc: async () => ({ data: rpcData, error: rpcError }),
    from(table: string) {
      let rows = tables[table] ?? [];
      const chain: any = {};
      for (const method of ['select', 'eq', 'in', 'neq', 'not', 'order', 'limit', 'ilike', 'or', 'is']) {
        chain[method] = (...args: any[]) => {
          calls.push([table, method, args]);
          if (method === 'is') rows = rows.filter(row => row[args[0]] == null);
          return chain;
        };
      }
      chain.maybeSingle = async () => ({ data: rows[0] ?? null });
      chain.then = (resolve: any, reject: any) => Promise.resolve({ data: rows }).then(resolve, reject);
      return chain;
    },
  };
}
const refund = '2026-10-19T12:00:00Z';
const att = (id: string, refunded_at: string | null, scheduled_at = refund) => ({
  id, deal_id: 'deal', status: 'contract_paid', contract_paid_at: '2026-10-18T12:00:00Z',
  refunded_at, created_at: scheduled_at, meeting_slot_id: id,
  meeting_slot: { scheduled_at, meeting_type: 'r1', status: 'scheduled' },
});
const agendaSource = load('src/hooks/useAgendaData.ts');
const agendaBody = agendaSource.slice(agendaSource.indexOf('export function useSearchDealsForSchedule('),
  agendaSource.indexOf('// Hook to search weekly meeting leads')).replace('export function', 'function');
const search = compile(agendaBody + '\nreturn useSearchDealsForSchedule("Lead").queryFn();',
  ['supabase', 'useQuery', 'getDealStatusFromStage', 'sanitizarTermoBusca']);
async function agenda(atts: any[], stage = 'won') {
  const db = client({ crm_deals: [{ id: 'deal', name: 'Lead', stage: { stage_name: stage } }], meeting_slot_attendees: atts });
  const result = await search(db, (options: any) => options, (name: string) => name, (s: string) => s);
  return { db, result };
}
assert.equal((await agenda([att('old', refund)])).result[0]?.blockReason, null);
assert.equal((await agenda([att('active', null)], 'open')).result[0]?.leadState, 'contract_paid');
assert.equal((await agenda([att('old', refund), att('active', null)])).result.length, 0);
assert.equal((await agenda([], 'won')).result.length, 0);
assert.equal((await agenda([att('old', refund)], 'lost')).result.length, 0);
const oldCompleted = { ...att('completed', null), status: 'completed' };
assert.equal((await agenda([att('old', refund), oldCompleted])).result[0]?.warningOnly, false);
assert.equal((await agenda([att('old', refund), { ...oldCompleted, meeting_slot: { ...oldCompleted.meeting_slot, scheduled_at: '2026-10-19T12:00:01Z' } }])).result[0]?.warningOnly, true);

const guardSource = load('supabase/functions/calendly-create-event/index.ts');
const guardStart = guardSource.indexOf('    if (!approvedRequest) {');
const guardEnd = guardSource.indexOf('    } // end if (!approvedRequest)', guardStart);
const guard = compile('return (async () => { const approvedRequest = null; const dealId = "deal"; const corsHeaders = {};\n' +
  guardSource.slice(guardStart, guardEnd) + '\n} return null; })();', ['supabase', 'console']);
const silent = { log() {}, warn() {} };
assert.equal(await guard(client({ crm_deals: [{ stage: { stage_name: 'Contrato Pago' } }] }, { teve_contrato: true, contrato_vigente: false }), silent), null);
assert.equal((await (await guard(client({}, { contrato_vigente: true }), silent)).json()).error, 'deal_already_paid');
assert.equal(await guard(client({ meeting_slot_attendees: [att('old', refund)] }, null, { message: 'RPC indisponível' }), silent), null);
assert.equal((await (await guard(client({ meeting_slot_attendees: [att('active', null)] }, null, { message: 'RPC indisponível' }), silent)).json()).error, 'deal_already_paid');

const linkSource = load('src/hooks/useLinkContractToAttendee.ts');
const linkStart = linkSource.indexOf('        const { data: existingPaid }');
const linkEnd = linkSource.indexOf('\n        if (existingPaid)', linkStart);
const duplicate = compile('return (async () => { const dealId = "deal"; const attendeeId = "new";\n' +
  linkSource.slice(linkStart, linkEnd) + '\nreturn existingPaid; })();', ['supabase']);
assert.equal(await duplicate(client({ meeting_slot_attendees: [att('old', refund)] })), null);
assert.equal((await duplicate(client({ meeting_slot_attendees: [att('active', null)] }))).id, 'active');

const callbackSource = load('supabase/functions/mcf-pay-callback/index.ts');
const callbackStart = callbackSource.indexOf('  let attendeeCriterio:');
const callbackEnd = callbackSource.indexOf('\n  const alreadyPaid', callbackStart);
const choose = compile('return (async () => { const resolvedDealId = "deal"; const paidAt = "2026-10-19T12:00:00Z";\n' +
  callbackSource.slice(callbackStart, callbackEnd) + '\nreturn { attendee, attendeeCriterio, r1ReembolsadasIgnoradas }; })();', ['supabase']);
const orphan = await choose(client({ meeting_slot_attendees: [att('old', refund)] }));
assert.equal(orphan.attendee, null);
assert.equal(orphan.attendeeCriterio, 'sem_r1_pos_reembolso');
assert.equal(orphan.r1ReembolsadasIgnoradas, 1);
assert.equal((await choose(client({ meeting_slot_attendees: [att('old', refund), att('new', null)] }))).attendee.id, 'new');
assert.equal((await choose(client({}))).attendeeCriterio, 'fallback_mais_recente');
console.log('Contrato reembolsado: 17 verificações dos ramos de produção passaram.');