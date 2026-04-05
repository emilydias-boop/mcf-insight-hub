import { SelectedDealData, LeadState } from '@/hooks/useSDRCockpit';
import { useQualification } from '@/hooks/useQualification';
import { QUALIFICATION_FIELDS, QualificationField } from '@/components/crm/qualification/QualificationFields';
import { Input } from '@/components/ui/input';
import { Calendar, Lock } from 'lucide-react';

interface CockpitQualificationPanelProps {
  deal: SelectedDealData | null;
  leadState: LeadState;
}

export function CockpitQualificationPanel({ deal, leadState }: CockpitQualificationPanelProps) {
  const { updateField, isUpdating } = useQualification({
    dealId: deal?.id || '',
    originId: deal?.originId || undefined,
    currentStageId: deal?.stageId,
  });

  const qualData = (deal?.customFields || {}) as Record<string, any>;

  if (!deal) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-600 text-xs p-4 text-center">
        Selecione um lead para ver a qualificação
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Qualification */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-[#1e2130]">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Qualificação {isUpdating && <span className="text-amber-400">•</span>}
          </span>
        </div>
        <div className="p-2 space-y-2">
          {QUALIFICATION_FIELDS.filter(f => {
            if (f.showIf) return !!qualData[f.showIf];
            return true;
          }).map((field) => (
            <QualFieldInline
              key={field.key}
              field={field}
              value={qualData[field.key]}
              onChange={(val) => updateField(field.key, val)}
            />
          ))}
        </div>
      </div>

      {/* Agenda section */}
      <div className="border-t border-[#1e2130]">
        <div className="px-3 py-2 border-b border-[#1e2130]">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Agenda
          </span>
        </div>
        {leadState === 'agendando' ? (
          <div className="p-3 text-xs text-gray-300">
            <p className="text-amber-400 mb-2">🗓 Agenda ativa</p>
            <p className="text-gray-500">
              Use o fluxo de agendamento existente para selecionar closer e horário.
            </p>
          </div>
        ) : (
          <div className="p-3 flex items-center gap-2 text-xs text-gray-600">
            <Lock className="w-3 h-3" />
            <span>Disponível quando lead estiver pronto para R1</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QualFieldInline({ field, value, onChange }: { 
  field: QualificationField; value: any; onChange: (v: any) => void 
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1e2130] cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-600 bg-[#0a0c14] text-green-500 w-3.5 h-3.5"
        />
        <span className="text-xs text-gray-300">{field.icon} {field.label}</span>
      </label>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="px-2">
        <label className="text-[10px] text-gray-500 mb-0.5 block">{field.icon} {field.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full bg-[#0a0c14] border border-[#1e2130] rounded text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-600"
        >
          <option value="">—</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="px-2">
      <label className="text-[10px] text-gray-500 mb-0.5 block">{field.icon} {field.label}</label>
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 bg-[#0a0c14] border-[#1e2130] text-xs text-gray-300"
      />
    </div>
  );
}
