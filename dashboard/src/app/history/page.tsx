import * as React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { History, Filter, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const filter = typeof resolvedSearchParams.filter === "string" ? resolvedSearchParams.filter : "ALL";
  
  const whereClause = filter !== "ALL" ? { status: filter } : {};

  const logs = await prisma.logHistory.findMany({
    where: whereClause,
    orderBy: { timestamp: "desc" },
    take: 100, // Show latest 100 logs
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Activity History</h1>
          <p className="text-muted-foreground mt-2">Monitor all bot interactions and system events.</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col border border-border shadow-sm bg-card">
        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center bg-muted/10 gap-4">
          <div className="flex gap-2">
            {["ALL", "SUCCESS", "WARNING", "ERROR"].map((status) => {
              const isActive = filter === status;
              return (
                <Link 
                  key={status}
                  href={`/history?filter=${status}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
                    isActive 
                      ? "bg-foreground text-background" 
                      : "bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {status}
                </Link>
              );
            })}
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="px-6 py-3 w-48">Time</th>
                <th className="px-6 py-3 w-40">Type</th>
                <th className="px-6 py-3 w-64">Sender</th>
                <th className="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  const isError = log.status === "ERROR";
                  const isWarning = log.status === "WARNING";
                  
                  return (
                    <tr key={log.id} className={`transition-colors group hover:bg-muted/30 ${
                      isError ? "bg-red-500/5 dark:bg-red-500/10" : 
                      isWarning ? "bg-yellow-500/5 dark:bg-yellow-500/10" : ""
                    }`}>
                      <td className="px-6 py-3 text-muted-foreground text-xs font-mono">
                        {log.timestamp.toLocaleTimeString('en-GB')} - {log.timestamp.toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-3 font-semibold text-foreground">
                        {log.type}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground font-medium">
                        {log.sender}
                      </td>
                      <td className="px-6 py-3 flex items-center gap-2">
                        <span className="shrink-0">
                          {isSuccess ? "✅" : isError ? "❌" : isWarning ? "⚠️" : "ℹ️"}
                        </span>
                        <span className={`truncate max-w-[400px] xl:max-w-[600px] ${
                          isError ? "text-red-600 dark:text-red-400 font-medium" : 
                          isWarning ? "text-yellow-600 dark:text-yellow-400 font-medium" : 
                          "text-muted-foreground"
                        }`}>
                          {log.details}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History size={24} className="text-muted-foreground/50" />
                      <p>No activity logs found for filter "{filter}".</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
