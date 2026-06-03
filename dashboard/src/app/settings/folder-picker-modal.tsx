import * as React from "react";
import { Folder, FolderOpen, ChevronLeft, X, Check } from "lucide-react";

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderPickerModal({ isOpen, onClose, onSelect, initialPath }: FolderPickerModalProps) {
  const [currentPath, setCurrentPath] = React.useState(initialPath || "");
  const [directories, setDirectories] = React.useState<string[]>([]);
  const [parentPath, setParentPath] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchPath = React.useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPath(data.currentPath);
        setDirectories(data.directories);
        setParentPath(data.parentPath);
      } else {
        console.error("Failed to fetch path");
      }
    } catch (e) {
      console.error("Error fetching path:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      fetchPath(currentPath);
    }
  }, [isOpen, fetchPath, currentPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl flex flex-col border border-border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
          <h2 className="text-lg font-bold text-foreground">Select Base Directory</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Current Path & Back Button */}
        <div className="p-4 bg-muted/10 border-b border-border flex items-center gap-2">
          <button 
            onClick={() => parentPath && fetchPath(parentPath)}
            disabled={!parentPath || isLoading}
            className="p-2 bg-background border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
            title="Go up one level"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 overflow-x-auto whitespace-nowrap bg-background border border-border px-3 py-2 rounded-lg text-sm text-foreground">
            {currentPath || "Loading..."}
          </div>
        </div>

        {/* Directories List */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Loading directories...</div>
          ) : directories.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No subdirectories found.</div>
          ) : (
            directories.map((dir) => (
              <button
                key={dir}
                onClick={() => fetchPath(`${currentPath}\\${dir}`.replace(/\\\\/g, '\\'))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 rounded-xl text-left transition-colors text-sm font-medium text-foreground group"
              >
                <Folder className="text-muted-foreground group-hover:text-primary transition-colors" size={18} />
                <span className="truncate">{dir}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSelect(currentPath)}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Check size={16} />
            Select Current Folder
          </button>
        </div>
      </div>
    </div>
  );
}
