import { useState, useEffect, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CallTimerProps {
  onEnd: (durationSeconds: number, notes: string, result: string) => void;
}

const RESULT_CHIPS = [
  { key: 'atendeu', label: 'Atendeu', color: 'bg-green-600 hover:bg-green-700' },
  { key: 'nao_atendeu', label: 'Não atendeu', color: 'bg-red-600 hover:bg-red-700' },
  { key: 'caixa_postal', label: 'Caixa postal', color: 'bg-amber-600 hover:bg-amber-700' },
  { key: 'pediu_retorno', label: 'Pediu retorno', color: 'bg-blue-600 hover:bg-blue-700' },
];

export function CallTimer({ onEnd }: CallTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsRunning(true);
    setSeconds(0);
  };

  const handleResult = (result: string) => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onEnd(seconds, notes, result);
    setNotes('');
    setSeconds(0);
  };

  if (!isRunning && seconds === 0) {
    return (
      <Button
        onClick={handleStart}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="sm"
      >
        <Play className="w-3.5 h-3.5 mr-1.5" />
        Iniciar ligação
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-2xl font-mono text-white">{formatTime(seconds)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleResult('cancelado')}
          className="text-gray-400 hover:text-white"
        >
          <Square className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas da ligação..."
        className="bg-[#0a0c14] border-[#1e2130] text-gray-300 text-xs min-h-[60px] resize-none"
      />

      {/* Result chips */}
      <div className="grid grid-cols-2 gap-1.5">
        {RESULT_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => handleResult(chip.key)}
            className={`px-2 py-1.5 rounded text-xs font-medium text-white transition-colors ${chip.color}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
