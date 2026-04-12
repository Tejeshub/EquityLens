import { candlestickData } from "@/data/dummyData";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Line } from "recharts";

const CandlestickChart = () => {
  const data = candlestickData.map((d) => ({
    ...d,
    fill: d.close >= d.open ? "hsl(152 60% 40%)" : "hsl(0 72% 51%)",
  }));

  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Price Chart (60D)</h3>
        <div className="flex gap-0.5">
          {["1D", "1W", "1M", "3M", "1Y", "5Y"].map((p) => (
            <button key={p} className={`px-2 py-0.5 text-[11px] rounded font-medium ${p === "3M" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 91%)", borderRadius: "6px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            labelStyle={{ color: "hsl(220 15% 15%)" }}
            formatter={(value: any, name: string) => {
              if (name === "close") return [`₹${value}`, "Close"];
              return [value, name];
            }}
          />
          <Line type="monotone" dataKey="close" stroke="hsl(215 80% 50%)" strokeWidth={1.5} dot={false} />
          <Bar dataKey="volume" fill="hsl(220 14% 93%)" yAxisId="volume" />
          <YAxis yAxisId="volume" orientation="right" hide />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CandlestickChart;
