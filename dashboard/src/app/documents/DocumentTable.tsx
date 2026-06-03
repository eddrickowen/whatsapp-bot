"use client";

import * as React from "react";
import { 
  Search, 
  FileImage, 
  ArrowUpDown, 
  Folder, 
  ChevronRight, 
  ArrowLeft, 
  LayoutGrid, 
  List, 
  Download, 
  Eye, 
  Calendar
} from "lucide-react";
import ImageViewer from "@/components/ImageViewer";

export default function DocumentTable({ documents, query }: { documents: any[], query: string }) {
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  
  // Tampilan Utama: "list" (Tabel) atau "explorer" (File Explorer)
  const [viewMode, setViewMode] = React.useState<"list" | "explorer">("list");
  
  // State navigasi berjenjang (Multi-Folder Path)
  const [activePath, setActivePath] = React.useState<string[]>([]);
  
  // Opsi Pengelompokan Tingkat Pertama: "client" atau "category"
  const [groupBy, setGroupBy] = React.useState<"client" | "category">("client");

  // Ketika opsi grouping diubah, bersihkan jalur navigasi
  React.useEffect(() => {
    setActivePath([]);
  }, [groupBy]);

  // LEVEL 1: Folder pada Root (Tingkat Pertama)
  const level1Folders = React.useMemo(() => {
    const map: { [key: string]: number } = {};
    documents.forEach(doc => {
      const key = (groupBy === "client" ? doc.client : doc.category) || "Unclassified";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [documents, groupBy]);

  // LEVEL 2: Folder di dalam Folder Terpilih (Tingkat Kedua)
  const level2Folders = React.useMemo(() => {
    if (activePath.length !== 1) return [];
    const parentFolder = activePath[0];
    const map: { [key: string]: number } = {};
    
    documents.forEach(doc => {
      const docParent = (groupBy === "client" ? doc.client : doc.category) || "Unclassified";
      if (docParent === parentFolder) {
        const subKey = (groupBy === "client" ? doc.category : doc.client) || "Unclassified";
        map[subKey] = (map[subKey] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [documents, activePath, groupBy]);

  // LEVEL 3: File yang berada di tingkat paling dalam
  const level3Files = React.useMemo(() => {
    if (activePath.length !== 2) return [];
    const val1 = activePath[0];
    const val2 = activePath[1];
    
    const clientVal = groupBy === "client" ? val1 : val2;
    const categoryVal = groupBy === "client" ? val2 : val1;
    
    return documents
      .map((doc, idx) => ({ ...doc, originalIndex: idx }))
      .filter(doc => {
        const docClient = doc.client || "Unclassified";
        const docCategory = doc.category || "Unclassified";
        return docClient === clientVal && docCategory === categoryVal;
      });
  }, [documents, activePath, groupBy]);

  return (
    <>
      {viewerIndex !== null && (
        <ImageViewer 
          documents={documents}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* Toolbar Atas: Pilihan Mode Tampilan (Sesuai Token Standard) */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/5 gap-4">
        {/* Toggle Mode View */}
        <div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/50">
          <button 
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "list" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={14} className="shrink-0" />
            Tabel
          </button>
          <button 
            type="button"
            onClick={() => setViewMode("explorer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "explorer" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={14} className="shrink-0" />
            Explorer
          </button>
        </div>

        {/* Opsi Pengelompokan khusus File Explorer pada Root Level */}
        {viewMode === "explorer" && activePath.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold">Kelompokkan:</span>
            <div className="flex bg-muted/30 p-0.5 rounded-md border border-border/50">
              <button 
                type="button"
                onClick={() => setGroupBy("client")}
                className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                  groupBy === "client" 
                    ? "bg-background text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Klien
              </button>
              <button 
                type="button"
                onClick={() => setGroupBy("category")}
                className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                  groupBy === "category" 
                    ? "bg-background text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Kategori
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. TAMPILAN TABEL DENSE & AUTO LAYOUT (Bebas Overlap & Font Lebih Besar) */}
      {viewMode === "list" && (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/20 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="cell-token-dense text-sm">Nama File</th>
                <th className="cell-token-dense text-sm">Klien</th>
                <th className="cell-token-dense text-sm">Kategori</th>
                <th className="cell-token-dense text-sm">Nomor PO</th>
                <th className="cell-token-dense text-sm">Tanggal</th>
                <th className="cell-token-dense text-sm text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {documents.length > 0 ? (
                documents.map((doc, index) => (
                  <tr key={doc.id} className="hover:bg-muted/10 transition-colors group">
                    {/* NAMA FILE (Lebih Besar & Scrollable) */}
                    <td className="cell-token-dense min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-primary/10 rounded-md text-primary shrink-0">
                          <FileImage size={16} className="shrink-0" />
                        </div>
                        {/* Nama file dapat di-scroll horizontal jika terlalu panjang */}
                        <div className="overflow-x-auto whitespace-nowrap scrollbar-none pr-1 max-w-[240px] sm:max-w-[320px]">
                          <span 
                            onClick={() => setViewerIndex(index)}
                            className="font-bold text-foreground text-sm hover:text-primary transition-colors cursor-pointer select-all block"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    {/* KLIEN (Font Lebih Besar & Tebal) */}
                    <td className="cell-token-dense min-w-0">
                      <span className="font-bold text-foreground text-sm">{doc.client}</span>
                    </td>
                    
                    {/* KATEGORI */}
                    <td className="cell-token-dense min-w-0">
                      <span className="px-2.5 py-1 bg-muted rounded-md text-xs font-bold text-muted-foreground uppercase tracking-wide border border-border/40">
                        {doc.category}
                      </span>
                    </td>
                    
                    {/* NOMOR PO */}
                    <td className="cell-token-dense min-w-0 font-mono text-sm text-muted-foreground">
                      <div className="overflow-x-auto whitespace-nowrap scrollbar-none pr-1 max-w-[120px]" title={doc.poNumber || "-"}>
                        {doc.poNumber || "-"}
                      </div>
                    </td>
                    
                    {/* TANGGAL */}
                    <td className="cell-token-dense min-w-0 text-sm text-muted-foreground">
                      {new Date(doc.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    
                    {/* AKSI */}
                    <td className="cell-token-dense text-right min-w-0 text-sm">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          type="button"
                          onClick={() => setViewerIndex(index)}
                          className="font-bold text-primary hover:underline transition-all cursor-pointer text-sm"
                        >
                          View
                        </button>
                        <span className="text-border/60">|</span>
                        <a 
                          href={`/api/file?path=${encodeURIComponent(doc.filePath)}`}
                          download={doc.fileName}
                          className="font-bold text-muted-foreground hover:text-foreground hover:underline transition-all text-sm"
                        >
                          Download
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search size={20} className="text-muted-foreground/45" />
                      <p className="italic text-sm">Tidak ada dokumen yang cocok dengan "{query}".</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. TAMPILAN FILE EXPLORER COMPACT DENGAN TIPOGRAFI STANDAR (Lebih Besar & Jelas) */}
      {viewMode === "explorer" && (
        <div className="w-full min-h-[250px] bg-card flex flex-col">
          {/* Breadcrumb Navigation Bar */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {/* Root Link */}
              <button 
                type="button"
                onClick={() => setActivePath([])}
                className={`font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer bg-background border px-3 py-1.5 rounded-lg hover:bg-muted ${
                  activePath.length === 0 
                    ? "border-primary/20 text-primary bg-primary/5" 
                    : "border-border text-muted-foreground"
                }`}
              >
                Documents
              </button>
              
              {/* Level 1 Folder Breadcrumb */}
              {activePath.length >= 1 && (
                <>
                  <ChevronRight size={13} className="text-muted-foreground/60 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setActivePath([activePath[0]])}
                    className={`font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer bg-background border px-3 py-1.5 rounded-lg hover:bg-muted truncate max-w-[150px] ${
                      activePath.length === 1 
                        ? "border-primary/20 text-primary bg-primary/5" 
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    📂 {activePath[0]}
                  </button>
                </>
              )}

              {/* Level 2 Folder Breadcrumb */}
              {activePath.length === 2 && (
                <>
                  <ChevronRight size={13} className="text-muted-foreground/60 shrink-0" />
                  <span className="font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg truncate max-w-[150px] flex items-center gap-1">
                    📂 {activePath[1]}
                  </span>
                </>
              )}
            </div>

            {/* Path Status info */}
            <span className="text-xs text-muted-foreground font-semibold bg-muted px-3 py-1 rounded-md border border-border/50 shrink-0">
              {activePath.length === 0 && `${level1Folders.length} Folders`}
              {activePath.length === 1 && `${level2Folders.length} Subfolders`}
              {activePath.length === 2 && `${level3Files.length} Files`}
            </span>
          </div>

          {/* FOLDER / FILE CONTAINER (Tipografi Standar / Lebih Terbaca) */}
          <div className="p-4 flex-1">
            {/* LEVEL 1: ROOT FOLDERS VIEW (Lebih Jelas) */}
            {activePath.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {level1Folders.map(folder => (
                  <div 
                    key={folder.name}
                    onClick={() => setActivePath([folder.name])}
                    className="flex items-center gap-3.5 p-3.5 bg-muted/10 border border-border/80 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer shadow-sm hover:scale-[1.01] group select-none"
                  >
                    <Folder size={24} className="text-amber-500 fill-amber-500/20 group-hover:scale-105 transition-transform shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span 
                        className="text-base font-bold text-foreground block truncate group-hover:text-primary transition-colors" 
                        title={folder.name}
                      >
                        {folder.name}
                      </span>
                      <span className="text-xs text-muted-foreground block mt-1">
                        {folder.count} items
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LEVEL 2: SUBFOLDERS VIEW */}
            {activePath.length === 1 && (
              <div className="space-y-4">
                {/* Back Button */}
                <button 
                  type="button"
                  onClick={() => setActivePath([])}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all active:scale-95 bg-muted/40 border border-border px-3.5 py-2 rounded-xl"
                >
                  <ArrowLeft size={14} className="shrink-0" /> Kembali ke Root
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {level2Folders.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60 italic py-2 col-span-2">Tidak ada subfolder.</p>
                  ) : (
                    level2Folders.map(subfolder => (
                      <div 
                        key={subfolder.name}
                        onClick={() => setActivePath([activePath[0], subfolder.name])}
                        className="flex items-center gap-3.5 p-3.5 bg-muted/15 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer shadow-sm hover:scale-[1.01] group select-none"
                      >
                        <Folder size={24} className="text-amber-500 fill-amber-500/15 group-hover:scale-105 transition-transform shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span 
                            className="text-base font-bold text-foreground block truncate group-hover:text-primary transition-colors" 
                            title={subfolder.name}
                          >
                            {subfolder.name}
                          </span>
                          <span className="text-xs text-muted-foreground block mt-1">
                            {subfolder.count} files
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* LEVEL 3: FILES VIEW */}
            {activePath.length === 2 && (
              <div className="space-y-4">
                {/* Back Button */}
                <button 
                  type="button"
                  onClick={() => setActivePath([activePath[0]])}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all active:scale-95 bg-muted/40 border border-border px-3.5 py-2 rounded-xl"
                >
                  <ArrowLeft size={14} className="shrink-0" /> Kembali ke {activePath[0]}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {level3Files.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60 italic py-2 col-span-2">Belum ada file di dalam folder ini.</p>
                  ) : (
                    level3Files.map(file => (
                      <div 
                        key={file.id}
                        className="flex items-center gap-3 bg-muted/5 border border-border rounded-xl p-3 hover:border-primary/45 hover:shadow-sm transition-all group"
                      >
                        {/* Thumbnail */}
                        <div 
                          onClick={() => setViewerIndex(file.originalIndex)}
                          className="relative w-11 h-11 bg-muted/50 flex items-center justify-center rounded-lg border border-border overflow-hidden cursor-pointer shrink-0"
                        >
                          {file.filePath ? (
                            <img 
                              src={`/api/file?path=${encodeURIComponent(file.filePath)}`}
                              alt={file.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <FileImage size={18} className="text-muted-foreground/60" />
                          )}
                        </div>
                        
                        {/* File Details (Font Standard Lebih Jelas) */}
                        <div className="min-w-0 flex-1">
                          <div className="overflow-x-auto whitespace-nowrap scrollbar-none pr-1">
                            <span 
                              onClick={() => setViewerIndex(file.originalIndex)}
                              className="text-sm font-bold text-foreground block hover:text-primary cursor-pointer" 
                              title={file.fileName}
                            >
                              {file.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar size={11} className="shrink-0" />
                            <span>
                              {new Date(file.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            type="button"
                            onClick={() => setViewerIndex(file.originalIndex)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                            title="Buka Gambar"
                          >
                            <Eye size={16} />
                          </button>
                          <a 
                            href={`/api/file?path=${encodeURIComponent(file.filePath)}`}
                            download={file.fileName}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
