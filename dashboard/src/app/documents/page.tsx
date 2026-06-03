import * as React from "react";
import { prisma } from "@/lib/prisma";
import { Search, Download, Filter } from "lucide-react";
import DocumentTable from "./DocumentTable";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  
  // Fetch documents from PostgreSQL
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { client: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { poNumber: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { timestamp: "desc" },
    take: 50, // Limit to 50 for now, can implement pagination later
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Document Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola, cari, dan jelajahi seluruh dokumen masuk secara terorganisir.</p>
        </div>
        
        {/* Actions / Export */}
        <div className="flex gap-2 shrink-0">
          <button 
            type="button" 
            className="flex items-center gap-2 bg-background hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-bold transition-all border border-border shadow-sm active:scale-95 cursor-pointer"
          >
            <Filter size={14} />
            Filter Lanjutan
          </button>
          <button 
            type="button" 
            className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Search Bar & Table Container */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col border border-border shadow-sm bg-card">
        {/* Toolbar (Compact) */}
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3 items-center bg-muted/5">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <form method="GET" action="/documents">
              <input 
                type="text" 
                name="q"
                defaultValue={q}
                placeholder="Cari berdasarkan klien, kategori, atau nomor PO..." 
                className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
              />
            </form>
          </div>
          
          <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-md border border-border/50 sm:ml-auto">
            Menampilkan {documents.length} dokumen terbaru
          </div>
        </div>

        <DocumentTable documents={documents} query={q} />
        
        {/* Pagination Footer (Compact) */}
        <div className="p-3.5 border-t border-border flex items-center justify-between bg-muted/5 text-xs font-bold text-muted-foreground">
          <span>Halaman 1 dari 1</span>
          <div className="flex gap-1.5">
            <button 
              type="button" 
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm" 
              disabled
            >
              Sebelumnya
            </button>
            <button 
              type="button" 
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm" 
              disabled
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
