'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const macroData = [
  { name: 'Mon', protein: 140, carbs: 220, fat: 65 },
  { name: 'Tue', protein: 155, carbs: 200, fat: 70 },
  { name: 'Wed', protein: 130, carbs: 240, fat: 60 },
  { name: 'Thu', protein: 160, carbs: 210, fat: 75 },
  { name: 'Fri', protein: 145, carbs: 230, fat: 68 },
  { name: 'Sat', protein: 135, carbs: 250, fat: 72 },
  { name: 'Sun', protein: 150, carbs: 215, fat: 66 },
]

const calorieData = [
  { name: 'Mon', actual: 2100, target: 2200 },
  { name: 'Tue', actual: 2050, target: 2200 },
  { name: 'Wed', actual: 2300, target: 2200 },
  { name: 'Thu', actual: 2150, target: 2200 },
  { name: 'Fri', actual: 2250, target: 2200 },
  { name: 'Sat', actual: 2400, target: 2200 },
  { name: 'Sun', actual: 2180, target: 2200 },
]

const pieData = [
  { name: 'Protein', value: 35, color: 'var(--chart-3)' },
  { name: 'Carbs', value: 45, color: 'var(--color-success)' },
  { name: 'Fat', value: 20, color: 'var(--color-warning)' },
]

export default function TestChart() {
  return (
    <div className="space-y-8 p-6" data-testid="recharts-test-container">
      <h1 className="text-2xl font-bold text-white">Recharts Test — Data Visualization</h1>
      <p className="text-muted-foreground text-sm">
        Verifying Recharts works with Next.js 15 App Router + React 19 (client component).
      </p>

      {/* Bar Chart — Macro Breakdown */}
      <section data-testid="bar-chart-section" className="bg-card border border-secondary rounded-lg p-4">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Weekly Macro Breakdown (Bar Chart)
        </h2>
        <div data-testid="bar-chart-responsive" style={{ width: '100%', minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={macroData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--secondary)" />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--secondary)" unit="g" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--secondary)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: 13, paddingTop: 8 }} />
              <Bar dataKey="protein" name="Protein (g)" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="carbs" name="Carbs (g)" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fat" name="Fat (g)" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Line Chart — Calories Actual vs Target */}
      <section data-testid="line-chart-section" className="bg-card border border-secondary rounded-lg p-4">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Calories — Actual vs Target (Line Chart)
        </h2>
        <div data-testid="line-chart-responsive" style={{ width: '100%', minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={calorieData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--secondary)" />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} stroke="var(--secondary)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--secondary)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: 13, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: 'var(--primary)', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="var(--chart-5)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-5)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Pie Chart — Macro Distribution */}
      <section data-testid="pie-chart-section" className="bg-card border border-secondary rounded-lg p-4">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Macro Distribution (Pie Chart)
        </h2>
        <div data-testid="pie-chart-responsive" style={{ width: '100%', minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--secondary)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
