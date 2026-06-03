"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8 rounded-md border border-border" />;
  }

  return (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border/50">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        title="Light Mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "system" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        title="System Theme"
      >
        <Monitor size={16} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        title="Dark Mode"
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
