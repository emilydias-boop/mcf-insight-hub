import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { OUTCOME_LABELS, STATUS_LABELS, formatDuration, getCallDuration } from './callPresentation';
import { activityIsAutomatic, hasCorrespondingHangup, metadataAuthor, MEETING_STATUS, otherActivityPresentation, isAutoStageCopyRow } from './eventPresentation';
import { sonaxDurationSeconds } from '../../../lib/sonaxRecording';
const id = '00000000-0000-4000-8000-000000000001';
const actor = '00000000-0000-4000-8000-000000000002';
const date = '2026-10-26T12:00:00Z';
const rows: Record<string, any[]> = {
  deal_activities: [
    { id:'stage',deal_id:id,activity_type:'stage_change',created_at:date,user_id:actor,metadata:{owner_email:'Wrong owner',moved_by_name:'Wrong fallback'},from_stage:'A',to_stage:'B' },
    { id:'down',deal_id:id,activity_type:'ligacao_sonax_desligamento',created_at:date,user_id:null,metadata:{STATUS_ATENDIMENTO:'S',URL_GRAVACAO:'sonax-api:1',sdr_name:'SDR',DURACAO_CHAMADA:'00:01:30'} },
    { id:'up',deal_id:id,activity_type:'ligacao_sonax_atendimento',created_at:date,metadata:{} },
    { id:'click',deal_id:id,activity_type:'click_to_call',created_at:date,metadata:{} },
    { id:'attempt',deal_id:id,activity_type:'click_to_call',created_at:'2026-10-26T10:00:00Z',user_id:actor,metadata:{} },
    { id:'distribution',deal_id:id,activity_type:'lead_distributed',created_at:date,metadata:{} },
    { id:'unknown',deal_id:id,activity_type:'system_event',created_at:date,metadata:{} },
  ],
  calls:[{id:'twilio',deal_id:id,user_id:actor,status:'completed',outcome:'agendou_r1',started_at:date,ended_at:'2026-10-26T12:01:30Z',duration_seconds:0}],
  meeting_slot_attendees:[{id:'r2',deal_id:id,status:'contract_paid',created_at:date,notes:'SDR scheduling note',closer_notes:'Closer note',meeting_slots:{meeting_type:'r2',closers:{name:'Closer'}}}],
  attendee_notes:[{id:'reschedule',note_type:'reschedule',note:'Moved',created_at:date,created_by:actor},{id:'summary',note_type:'call_summary',note:'AI',created_at:date}],
  profiles:[{id:actor,full_name:'Actual actor'}], crm_deals:[],
};
const db = {from(table:string) { const chain:any={}; for (const method of ['select','or','in','order','limit']) chain[method]=()=>chain;
  chain.then=(resolve:any)=>Promise.resolve({data:rows[table]||[],error:null}).then(resolve); return chain; }};
const source=readFileSync('src/hooks/useLeadFullTimeline.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const run = new Function('useQuery','useContactDealIds','supabase','OUTCOME_LABELS','STATUS_LABELS','formatDuration','getCallDuration','MEETING_STATUS','metadataAuthor','activityIsAutomatic','hasCorrespondingHangup','otherActivityPresentation','sonaxDurationSeconds','isAutoStageCopyRow',
  ts.transpile(source+'\nreturn useLeadFullTimeline;', {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}));
const hook=run((x:any)=>x,()=>({data:[id],isSuccess:true}),db,OUTCOME_LABELS,STATUS_LABELS,formatDuration,getCallDuration,MEETING_STATUS,metadataAuthor,activityIsAutomatic,hasCorrespondingHangup,otherActivityPresentation,sonaxDurationSeconds,isAutoStageCopyRow);
const events=await hook({dealId:id,dealUuid:id}).queryFn();
const event=(id:string)=>events.find((e:any)=>e.id===id);
assert.equal(event('stage').author,'Actual actor');
assert.equal(event('down').type,'call');
assert.equal(event('down').metadata.recording_url,'sonax-api:1');
assert.equal(event('down').metadata.duration_seconds,90);
assert.equal(event('down').automatic,false);
assert.equal(event('up'),undefined);
assert.equal(event('click'),undefined);
assert.equal(event('attempt').title,'Tentativa de ligação');
assert.equal(event('distribution').type,'owner_change');
assert.equal(event('distribution').automatic,true);
assert.equal(event('unknown').type,'automation');
assert.equal(event('twilio').title,'Ligação: Agendou R1');
assert.equal(event('twilio').metadata.duration_seconds,90);
assert.equal(event('r2').title,'Reunião R2 · contrato pago com Closer');
assert.equal(event('r2').metadata.sdr_notes,'SDR scheduling note');
assert.equal(event('r2-sdr-note').type,'scheduling_note');
assert.equal(event('r2-closer-note').description,'Closer note');
assert.equal(event('reschedule').title,'Reagendamento');
assert.equal(event('summary').title,'Resumo IA');
const noteSource=readFileSync('src/hooks/useNextAction.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const invalidated:any[]=[];
const getNote=new Function('useQueryClient','useMutation','toast',ts.transpile(noteSource+'\nreturn useAddDealNote();',{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}));
const mutation=getNote(()=>({invalidateQueries:(v:any)=>invalidated.push(v.queryKey)}),(v:any)=>v,{success:()=>{}});
mutation.onSuccess(null,{dealId:id});
assert.ok(invalidated.some(k=>k.length===1&&k[0]==='all-deal-notes'));
assert.ok(invalidated.some(k=>k.length===1&&k[0]==='lead-full-timeline'));
assert.ok(invalidated.some(k=>k.length===1&&k[0]==='kanban'));
console.log('22 assertions passed — real timeline hook and note invalidations, simulated data only');
