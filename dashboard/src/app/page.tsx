import * as React from "react";
import { ArrowUpRight, FileText, Activity, Layers, Users, History } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  // Fetch real metrics from PostgreSQL
  const [totalDocs, categoriesCount, activeClients, recentLogs] = await Promise.all([
    prisma.document.count(),
    prisma.validCategory.count(),
    prisma.targetUser.count() /* Assuming user count as active clients for now */,
    prisma.logHistory.findMany({
      take: 5,
      orderBy: { timestamp: "desc" },
    }),
  ]);

  // Calculate success rate dynamically based on logs
  const [successLogs, totalLogs] = await Promise.all([
    prisma.logHistory.count({ where: { status: "SUCCESS" } }),
    prisma.logHistory.count(),
  ]);
  
  const successRate = totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(1) + "%" : "100%";

  const stats = [
    { name: "Total Documents", value: totalDocs.toString(), change: "Live", icon: FileText },
    { name: "Success Rate", value: successRate, change: "Live", icon: Activity },
    { name: "Monitored Users", value: activeClients.toString(), change: "Live", icon: Users },
    { name: "Categories", value: categoriesCount.toString(), change: "Live", icon: Layers },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-2">Real-time metrics and system status for Agri Prima Bot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="glass-panel rounded-xl p-6 transition-all hover:border-primary/50 group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{stat.name}</span>
              <div className="p-2 bg-muted rounded-md group-hover:bg-primary/10 transition-colors">
                <stat.icon size={16} className="text-primary" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</h2>
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <ArrowUpRight size={10} />
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 min-h-[400px]">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <Activity size={18} className="text-primary"/> 
            Processing Activity
          </h3>
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-muted/30">
            [Chart Area - Ready for Next Update]
          </div>
        </div>
        
        <div className="glass-panel rounded-xl p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <History size={18} className="text-primary"/> 
            Recent Logs
          </h3>
          <div className="space-y-4">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => {
                const isSuccess = log.status === "SUCCESS";
                const isError = log.status === "ERROR";
                return (
                  <div key={log.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className={`w-2 h-2 mt-2 rounded-full shadow-sm ${
                      isSuccess ? "bg-green-500 shadow-green-500/40" : 
                      isError ? "bg-red-500 shadow-red-500/40" : 
                      "bg-yellow-500 shadow-yellow-500/40"
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{log.type}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.details}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-2">
                        {log.timestamp.toLocaleTimeString()} - {log.sender}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
