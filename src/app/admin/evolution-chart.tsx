'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  label: string;
  realizadas: number;
  faltas: number;
  faturamento: number;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Gráficos de evolução mensal (sessões e faturamento). */
export function EvolutionCharts({ data }: { data: Point[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure aria-label="Gráfico de sessões por mês">
        <figcaption className="mb-2 text-sm font-medium">Sessões por mês</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 85%)" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="realizadas" name="Realizadas" fill="#2f6b4f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="faltas" name="Faltas" fill="#b42318" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure aria-label="Gráfico de faturamento por mês">
        <figcaption className="mb-2 text-sm font-medium">Faturamento recebido</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 85%)" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => brl(Number(v))} width={70} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Line
                type="monotone"
                dataKey="faturamento"
                name="Recebido"
                stroke="#3f6554"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
