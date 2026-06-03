"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FolderSearch, 
  History, 
  Settings, 
  Menu,
  X,
  Bot,
  MessageCircle,
  Users,
  FileText,
  GitBranch
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Live Chat", href: "/chat", icon: MessageCircle },
    { name: "Pipelines", href: "/pipelines", icon: GitBranch },
    { name: "Document Center", href: "/documents", icon: FolderSearch },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "Activity History", href: "/history", icon: History },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-muted/20 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 w-64 h-full bg-card border-r border-border transition-transform duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border justify-between">
          <div className="flex items-center gap-2 text-foreground font-semibold tracking-tight">
            <Bot size={20} className="text-primary" />
            <span>Agri Prima</span>
          </div>
          <button 
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                `}
              >
                <item.icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-card/50 backdrop-blur-md border-b border-border z-30">
          <button
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-md"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          
          <div className="flex-1 flex items-center justify-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              System Online
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
