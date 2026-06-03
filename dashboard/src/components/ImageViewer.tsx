"use client";

import * as React from "react";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";

interface DocumentItem {
  id: number;
  fileName: string;
  filePath: string;
  client: string;
}

interface ImageViewerProps {
  documents: DocumentItem[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageViewer({ documents, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  const navigate = (direction: number) => {
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = documents.length - 1;
    if (newIndex >= documents.length) newIndex = 0;
    setCurrentIndex(newIndex);
    setScale(1); // Reset zoom
  };

  const currentDoc = documents[currentIndex];
  if (!currentDoc) return null;

  // Use the API route to fetch the image from the local path
  const imageUrl = `/api/file?path=${encodeURIComponent(currentDoc.filePath)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      {/* Header Actions */}
      <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
        <a 
          href={imageUrl} 
          download={currentDoc.fileName}
          className="p-2 bg-muted/50 hover:bg-muted text-foreground rounded-full transition-colors backdrop-blur-md"
          title="Download Image"
        >
          <Download size={20} />
        </a>
        <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 backdrop-blur-md">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:text-primary transition-colors">
            <ZoomOut size={20} />
          </button>
          <span className="text-xs font-medium w-8 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:text-primary transition-colors">
            <ZoomIn size={20} />
          </button>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full transition-colors backdrop-blur-md"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Left */}
      <button 
        onClick={(e) => { e.stopPropagation(); navigate(-1); }}
        className="absolute left-4 p-3 bg-muted/50 hover:bg-muted text-foreground rounded-full transition-colors backdrop-blur-md z-50"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Navigation Right */}
      <button 
        onClick={(e) => { e.stopPropagation(); navigate(1); }}
        className="absolute right-4 p-3 bg-muted/50 hover:bg-muted text-foreground rounded-full transition-colors backdrop-blur-md z-50"
      >
        <ChevronRight size={24} />
      </button>

      {/* Image Container */}
      <div 
        className="w-full h-full flex items-center justify-center overflow-auto p-12"
        onClick={onClose}
      >
        <img 
          src={imageUrl} 
          alt={currentDoc.fileName}
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
        />
      </div>
      
      {/* Footer Info */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-muted/80 backdrop-blur-md px-4 py-2 rounded-full flex flex-col items-center z-50 text-foreground shadow-lg">
        <span className="text-sm font-semibold truncate max-w-md">{currentDoc.fileName}</span>
        <span className="text-xs text-muted-foreground">{currentDoc.client} • {currentIndex + 1} of {documents.length}</span>
      </div>
    </div>
  );
}
