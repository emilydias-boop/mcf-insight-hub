import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface GaugeSemicircleProps {
  titulo: string;
  valor: number;
  meta: number;
  leadType?: "A" | "B";
}

export function GaugeSemicircle({ titulo, valor, meta, leadType }: GaugeSemicircleProps) {
  const percentual = meta > 0 ? Math.min((valor / meta) * 100, 100) : 0;
  
  const getColor = (percent: number) => {
    if (percent <= 35) return "hsl(var(--destructive))";
    if (percent <= 75) return "hsl(var(--warning))";
    return "hsl(var(--success))";
  };

  const color = getColor(percentual);
  const leadColor = leadType === "A" ? "hsl(var(--chart-1))" : leadType === "B" ? "hsl(var(--chart-2))" : color;

  const data = [
    { name: "Atingido", value: percentual },
    { name: "Restante", value: 100 - percentual },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 p-1.5 bg-card rounded border border-border flex-1 min-h-0">
      <div className="text-[9px] font-medium text-center text-muted-foreground truncate w-full px-1">
        {titulo}
      </div>
      <ResponsiveContainer width="100%" height={70}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius={28}
            outerRadius={40}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-2">
        <div className="text-xs font-bold" style={{ color }}>
          {percentual.toFixed(0)}%
        </div>
        <div className="text-[9px] text-muted-foreground">
          {valor} / {meta}
        </div>
      </div>
    </div>
  );
}
