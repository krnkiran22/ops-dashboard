"use client";

export interface TransitRow {
  id: string;
  eta: string;
  route: string;
  quantity: number;
  type: string;
  status: string;
}

const ST: Record<string, string> = {
  "In Transit": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Shipped: "bg-green-500/15 text-green-700 dark:text-green-400",
  Customs: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  Packed: "bg-muted text-muted-foreground",
  Mfg: "bg-muted text-muted-foreground",
};

interface Props { shipments?: TransitRow[] }

export function InTransitTable({ shipments = [] }: Props) {
  if (shipments.length === 0) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-xs">No shipments</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header — same style as Devices / Sales / Ops */}
      <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground">In-Transit</h2>
          <span className="text-[10px] text-muted-foreground tabular-nums">{shipments.length} shipments</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {shipments.map((r) => {
          const label = r.status === "Manufacturing" ? "Mfg" : r.status;
          const cls = ST[label] ?? "bg-muted text-muted-foreground";
          return (
            <div key={r.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-[6px] border-b border-border/15 hover:bg-muted/10 text-[12px]">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {r.route.split("→").map((p, i, a) => (
                    <span key={i}>
                      {p.trim()}
                      {i < a.length - 1 && <span className="text-muted-foreground"> → </span>}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">{r.eta} · {r.type}</div>
              </div>
              <span className="tabular-nums font-bold text-sm">{r.quantity}</span>
              {/* Same w-[52px] badge as devices */}
              <span className={`w-[52px] py-0.5 text-[9px] font-semibold text-center uppercase tracking-wide ${cls}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
