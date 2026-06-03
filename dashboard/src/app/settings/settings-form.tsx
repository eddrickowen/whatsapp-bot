"use client";

import * as React from "react";
import { Save, Plus, X, RefreshCw, Smartphone, Check, FolderOpen } from "lucide-react";
import { FolderPickerModal } from "./folder-picker-modal";

export default function SettingsForm({
  initialConfig,
  initialCategories,
  initialClients,
  initialGroups,
  initialUsers,
  initialFolderMappings,
}: any) {
  const [groups, setGroups] = React.useState<any[]>(initialGroups || []);
  const [users, setUsers] = React.useState<any[]>(initialUsers || []);
  const [folderMappings, setFolderMappings] = React.useState<any[]>(initialFolderMappings || []);
  const [config, setConfig] = React.useState(initialConfig || { 
    autoReply: true, 
    useOcr: false, 
    mediaFormat: 'original',
    bufferMode: 'fixed',
    bufferTimeout: 3,
    catchupDays: 3,
    catchupSessionGap: 30,
    catchupLimit: 50,
    blacklistWords: ["SEMALAM", "KEMARIN", "HARI_INI", "HARI INI", "TADI", "OK", "SIAP", "DARI", "UNTUK", "DAN", "YANG", "DENGAN", "SUDAH", "BELUM", "BARU", "LAMA", "PAGI", "SIANG", "SORE", "MALAM", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU", "BUAT", "INI", "ITU", "YA", "OKE", "BESOK", "LUSA", "BULAN", "TAHUN", "TANGGAL", "JAM", "MENIT", "DETIK", "HARI"],
    baseDirectory: ""
  });
  
  const [blacklistInput, setBlacklistInput] = React.useState(
    config.blacklistWords ? config.blacklistWords.join(', ') : ""
  );
  const [categories, setCategories] = React.useState<any[]>(initialCategories || []);
  const [clients, setClients] = React.useState<any[]>(initialClients || []);
  
  const [liveGroups, setLiveGroups] = React.useState<{id: string, name: string}[]>([]);
  const [liveContacts, setLiveContacts] = React.useState<{id: string, name: string}[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = React.useState(false);
  
  const [selectedGroupInput, setSelectedGroupInput] = React.useState("");
  const [selectedUserInput, setSelectedUserInput] = React.useState("");

  const [mappingSourceInput, setMappingSourceInput] = React.useState("");
  const [mappingFolderInput, setMappingFolderInput] = React.useState("");

  const [newCatName, setNewCatName] = React.useState("");
  const [newCatAliases, setNewCatAliases] = React.useState("");
  
  const [newClientName, setNewClientName] = React.useState("");
  const [newClientAliases, setNewClientAliases] = React.useState("");

  // States for inline editing
  const [editingCatId, setEditingCatId] = React.useState<any>(null);
  const [editCatName, setEditCatName] = React.useState("");
  const [editCatAliases, setEditCatAliases] = React.useState("");

  const [editingClientId, setEditingClientId] = React.useState<any>(null);
  const [editClientName, setEditClientName] = React.useState("");
  const [editClientAliases, setEditClientAliases] = React.useState("");

  React.useEffect(() => {
    fetchLiveContacts();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { saveSettings } = await import('./actions');
      const formData = {
        config: {
          ...config,
          blacklistWords: blacklistInput.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        },
        groups: groups.map(g => ({ id: g.id, name: getGroupName(g.id) })),
        users: users.map(u => ({ id: u.id, name: getUserName(u.id) })),
        categories: categories.map(c => ({ name: c.name, aliases: c.aliases || [] })),
        clients: clients.map(c => ({ name: c.name, aliases: c.aliases || [] })),
        folderMappings: folderMappings.map(m => ({ id: m.id, name: getSourceMappingName(m.id), folderName: m.folderName })),
      };
      const res = await saveSettings(formData);
      if (res.success) {
        alert("✅ Pengaturan berhasil disimpan!");
      } else {
        alert("❌ Gagal menyimpan: " + res.error);
      }
    } catch (e: any) {
      alert("❌ Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLiveContacts = async () => {
    try {
      const gRes = await fetch("http://localhost:3001/api/groups");
      const cRes = await fetch("http://localhost:3001/api/contacts");
      if (gRes.ok) setLiveGroups(await gRes.json());
      if (cRes.ok) setLiveContacts(await cRes.json());
    } catch (e) {
      console.warn("Could not fetch live WhatsApp contacts. Ensure Bot is running.");
    }
  };

  const handleRefreshConnection = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("http://localhost:3001/api/refresh", { method: "POST" });
      if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to refresh");
      }
      await fetchLiveContacts();
      alert("✅ Berhasil menarik kontak terbaru dari WhatsApp!");
    } catch (e: any) {
      alert("Gagal menarik kontak: " + e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const addGroup = () => {
    if (selectedGroupInput && !groups.find(g => g.id === selectedGroupInput)) {
      setGroups([...groups, { id: selectedGroupInput }]);
      setSelectedGroupInput("");
    }
  };

  const addUser = () => {
    if (selectedUserInput && !users.find(u => u.id === selectedUserInput)) {
      setUsers([...users, { id: selectedUserInput }]);
      setSelectedUserInput("");
    }
  };

  const removeGroup = (id: string) => setGroups(groups.filter(g => g.id !== id));
  const removeUser = (id: string) => setUsers(users.filter(u => u.id !== id));

  const addFolderMapping = () => {
    if (mappingSourceInput && mappingFolderInput && !folderMappings.find(m => m.id === mappingSourceInput)) {
      setFolderMappings([...folderMappings, { id: mappingSourceInput, folderName: mappingFolderInput }]);
      setMappingSourceInput("");
      setMappingFolderInput("");
    }
  };
  const removeFolderMapping = (id: string) => setFolderMappings(folderMappings.filter(m => m.id !== id));

  const addCategory = () => {
    if (!newCatName) return;
    const aliases = newCatAliases.split(',').map(s => s.trim()).filter(s => s);
    setCategories([...categories, { id: Date.now(), name: newCatName, aliases }]);
    setNewCatName("");
    setNewCatAliases("");
  };
  const removeCategory = (name: string) => setCategories(categories.filter(c => c.name !== name));

  const addClient = () => {
    if (!newClientName) return;
    const aliases = newClientAliases.split(',').map(s => s.trim()).filter(s => s);
    setClients([...clients, { id: Date.now(), name: newClientName, aliases }]);
    setNewClientName("");
    setNewClientAliases("");
  };
  const removeClient = (name: string) => setClients(clients.filter(c => c.name !== name));

  // Inline edit handlers for Categories
  const startEditCategory = (cat: any) => {
    setEditingCatId(cat.id || cat.name);
    setEditCatName(cat.name);
    setEditCatAliases(cat.aliases ? cat.aliases.join(', ') : "");
  };

  const saveEditCategory = (originalName: string) => {
    if (!editCatName.trim()) return;
    const aliases = editCatAliases.split(',').map(s => s.trim()).filter(s => s);
    setCategories(categories.map(c => {
      if ((c.id || c.name) === editingCatId || c.name === originalName) {
        return { ...c, name: editCatName.trim(), aliases };
      }
      return c;
    }));
    setEditingCatId(null);
  };

  // Inline edit handlers for Clients
  const startEditClient = (client: any) => {
    setEditingClientId(client.id || client.name);
    setEditClientName(client.name);
    setEditClientAliases(client.aliases ? client.aliases.join(', ') : "");
  };

  const saveEditClient = (originalName: string) => {
    if (!editClientName.trim()) return;
    const aliases = editClientAliases.split(',').map(s => s.trim()).filter(s => s);
    setClients(clients.map(c => {
      if ((c.id || c.name) === editingClientId || c.name === originalName) {
        return { ...c, name: editClientName.trim(), aliases };
      }
      return c;
    }));
    setEditingClientId(null);
  };

  // Helpers to get friendly names
  const getGroupName = (id: string) => {
    const live = liveGroups.find(g => g.id === id);
    return live ? live.name : id;
  };
  const getUserName = (id: string) => {
    const live = liveContacts.find(u => u.id === id);
    return live ? live.name : id;
  };
  const getSourceMappingName = (id: string) => {
    const groupName = liveGroups.find(g => g.id === id)?.name;
    if (groupName) return groupName;
    const userName = liveContacts.find(u => u.id === id)?.name;
    if (userName) return userName;
    return id;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* General Settings */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
        <div className="p-6 border-b border-border bg-muted/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              General Configuration
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Atur perilaku utama serta media penyimpanan dari WhatsApp bot.</p>
          </div>
          
          <button 
            type="button"
            onClick={handleRefreshConnection}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-background border border-border hover:bg-muted text-foreground px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 select-none cursor-pointer"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"} />
            {isRefreshing ? "Menyinkronkan..." : "Sinkronisasi Kontak"}
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Bot Operations */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Bot Operations</h3>
            
            {/* Auto Reply Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/10 border border-border/50 hover:bg-muted/20 transition-all duration-200">
              <div className="space-y-0.5 pr-4">
                <h4 className="font-semibold text-foreground text-sm">Auto-Reply Sender</h4>
                <p className="text-xs text-muted-foreground">Kirim balasan otomatis ke pengirim WhatsApp saat sukses atau gagal.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.autoReply} 
                  onChange={(e) => setConfig({...config, autoReply: e.target.checked})} 
                />
                <div className="w-11 h-6 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all duration-300 peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>

            {/* OCR Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/10 border border-border/50 hover:bg-muted/20 transition-all duration-200">
              <div className="space-y-0.5 pr-4">
                <h4 className="font-semibold text-foreground text-sm">Experimental Image OCR</h4>
                <p className="text-xs text-muted-foreground">Ekstrak teks di dalam gambar secara otomatis jika teks caption kosong.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.useOcr} 
                  onChange={(e) => setConfig({...config, useOcr: e.target.checked})} 
                />
                <div className="w-11 h-6 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all duration-300 peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* Right Column: Storage Configuration */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Storage Optimization</h3>
            
            <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-sm">Media Storage Format</h4>
                <p className="text-xs text-muted-foreground">Format penyimpanan gambar untuk efisiensi ruang server.</p>
              </div>
              
              <select 
                value={config.mediaFormat}
                onChange={(e) => setConfig({...config, mediaFormat: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200"
              >
                <option value="original">Original (Kualitas Tinggi / Tanpa Kompresi)</option>
                <option value="webp_lossless">WebP Lossless (Sangat Hemat Penyimpanan)</option>
              </select>
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg flex items-start gap-2">
                <span className="text-xs text-primary leading-relaxed">
                  💡 <strong>Info:</strong> Fitur <strong>WebP Lossless</strong> secara otomatis mengompresi gambar dokumen tanpa pecah sedikit pun menggunakan pustaka <code>sharp</code> berperforma tinggi pada backend bot.
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-4 mt-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-sm">Base Download Directory</h4>
                <p className="text-xs text-muted-foreground">Lokasi folder di mana file akan disimpan. Sub-folder (berdasarkan grup/bulan) akan dibuat di dalamnya.</p>
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={config.baseDirectory || ""}
                  onChange={(e) => setConfig({...config, baseDirectory: e.target.value})}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200 min-w-0"
                  placeholder="Contoh: C:\Downloads\BotDocuments"
                />
                <button
                  type="button"
                  onClick={() => setIsFolderPickerOpen(true)}
                  className="bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                  title="Pilih Folder"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Second Grid Row: Buffer & Catch-up Settings */}
        <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-border/50 mt-6">
          {/* Buffer Settings */}
          <div className="space-y-4 pt-6">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Buffer & Processing</h3>
            
            <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-sm">Buffer Mode</h4>
                <p className="text-xs text-muted-foreground">How incoming media is grouped before processing.</p>
              </div>
              <select 
                value={config.bufferMode}
                onChange={(e) => setConfig({...config, bufferMode: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200"
              >
                <option value="fixed">Fixed Window (Process exactly after timeout)</option>
                <option value="debounce">Idle Timeout (Wait until sender stops sending)</option>
              </select>

              <div className="space-y-1 mt-4">
                <h4 className="font-semibold text-foreground text-sm">Timeout Duration (Minutes)</h4>
                <p className="text-xs text-muted-foreground">Time to wait before processing the group.</p>
              </div>
              <input 
                type="number"
                min="1" max="15"
                value={config.bufferTimeout}
                onChange={(e) => setConfig({...config, bufferTimeout: parseInt(e.target.value) || 3})}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200"
              />
            </div>
          </div>

          {/* Catch-up Settings */}
          <div className="space-y-4 pt-6">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Catch-up Sync Configuration</h3>
            
            <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground text-sm">Sync Range (Days)</h4>
                  <p className="text-[10px] text-muted-foreground">How far back to check when restarting.</p>
                  <input 
                    type="number" min="1" max="14"
                    value={config.catchupDays}
                    onChange={(e) => setConfig({...config, catchupDays: parseInt(e.target.value) || 3})}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm mt-1 focus:ring-primary"
                  />
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground text-sm">Session Gap (Mins)</h4>
                  <p className="text-[10px] text-muted-foreground">Max gap to group missed messages.</p>
                  <input 
                    type="number" min="5" max="120"
                    value={config.catchupSessionGap}
                    onChange={(e) => setConfig({...config, catchupSessionGap: parseInt(e.target.value) || 30})}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm mt-1 focus:ring-primary"
                  />
                </div>
              </div>
              
              <div className="space-y-1 pt-2">
                <h4 className="font-semibold text-foreground text-sm">Sync Limit per Chat</h4>
                <p className="text-xs text-muted-foreground">Max messages to fetch per chat during startup.</p>
                <input 
                  type="number" min="10" max="200"
                  value={config.catchupLimit}
                  onChange={(e) => setConfig({...config, catchupLimit: parseInt(e.target.value) || 50})}
                  className="w-full bg-background border border-border rounded-lg px-2 py-1 text-sm focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Third Row: Parser Blacklist */}
        <div className="p-6 pt-0 border-t border-border/50 mt-6">
          <div className="space-y-4 pt-6">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Parser Blacklist Words</h3>
            <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-2">
              <h4 className="font-semibold text-foreground text-sm">Ignored Client Keywords</h4>
              <p className="text-xs text-muted-foreground">Words to ignore when guessing client names (e.g. SEMALAM, BESOK). Comma separated.</p>
              <textarea 
                rows={3}
                value={blacklistInput}
                onChange={(e) => setBlacklistInput(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200"
                placeholder="TODAY, TOMORROW, PLEASE, OK..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Target Groups & Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Target Groups */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-sm border border-border bg-card">
          <div className="p-4 border-b border-border bg-muted/5">
            <h3 className="font-bold text-foreground text-base">Target Groups</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Grup WhatsApp yang dipantau oleh bot untuk mengklasifikasikan dokumen.</p>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select 
                  value={selectedGroupInput}
                  onChange={(e) => setSelectedGroupInput(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200 min-w-0"
                >
                  <option value="">Pilih Grup dari WhatsApp...</option>
                  {liveGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={addGroup} 
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/95 transition-all text-sm font-semibold active:scale-95 shrink-0 cursor-pointer shadow-sm"
                >
                  Add Group
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                {groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic py-2">Belum ada grup yang dipantau.</p>
                ) : (
                  groups.map((group) => (
                    <div 
                      key={group.id} 
                      className="min-w-0 max-w-full flex items-center justify-between gap-2.5 bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl group transition-all hover:bg-emerald-500/15"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Smartphone size={13} className="shrink-0 text-emerald-500" />
                        <span 
                          className="text-xs font-semibold truncate max-w-[150px] sm:max-w-[200px]" 
                          title={getGroupName(group.id)}
                        >
                          {getGroupName(group.id)}
                        </span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeGroup(group.id)} 
                        className="text-emerald-500/50 hover:text-red-500 transition-colors shrink-0 p-0.5 rounded-md hover:bg-red-500/10"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Target Users */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-sm border border-border bg-card">
          <div className="p-4 border-b border-border bg-muted/5">
            <h3 className="font-bold text-foreground text-base">Target Users</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Kontak pribadi WhatsApp yang dipantau oleh bot untuk dokumen.</p>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select 
                  value={selectedUserInput}
                  onChange={(e) => setSelectedUserInput(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200 min-w-0"
                >
                  <option value="">Pilih Kontak dari WhatsApp...</option>
                  {liveContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={addUser} 
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/95 transition-all text-sm font-semibold active:scale-95 shrink-0 cursor-pointer shadow-sm"
                >
                  Add User
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                {users.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic py-2">Belum ada kontak yang dipantau.</p>
                ) : (
                  users.map((user) => (
                    <div 
                      key={user.id} 
                      className="min-w-0 max-w-full flex items-center justify-between gap-2.5 bg-sky-500/10 dark:bg-sky-500/5 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-xl group transition-all hover:bg-sky-500/15"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Smartphone size={13} className="shrink-0 text-sky-500" />
                        <span 
                          className="text-xs font-semibold truncate max-w-[150px] sm:max-w-[200px]" 
                          title={getUserName(user.id)}
                        >
                          {getUserName(user.id)}
                        </span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeUser(user.id)} 
                        className="text-sky-500/50 hover:text-red-500 transition-colors shrink-0 p-0.5 rounded-md hover:bg-red-500/10"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Direct Folder Mapping */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
        <div className="p-4 border-b border-border bg-muted/5">
          <h3 className="font-bold text-foreground text-base">Direct Folder Routing (Bypass AI)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Semua dokumen dari sumber ini akan langsung masuk ke folder yang ditentukan, mengabaikan deteksi AI.</p>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <select 
              value={mappingSourceInput}
              onChange={(e) => setMappingSourceInput(e.target.value)}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200 min-w-0"
            >
              <option value="">Pilih Sumber (Grup / Kontak)...</option>
              <optgroup label="Groups">
                {liveGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </optgroup>
              <optgroup label="Contacts">
                {liveContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            </select>
            <input 
              type="text" 
              value={mappingFolderInput} 
              onChange={e => setMappingFolderInput(e.target.value)} 
              placeholder="Nama Folder (misal: Laporan_A)" 
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200 min-w-0" 
            />
            <button 
              type="button"
              onClick={addFolderMapping} 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/95 transition-all text-sm font-semibold active:scale-95 shrink-0 cursor-pointer shadow-sm"
            >
              Add Mapping
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folderMappings.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic py-2 col-span-full">Belum ada mapping folder langsung.</p>
            ) : (
              folderMappings.map((m) => (
                <div 
                  key={m.id} 
                  className="flex items-center justify-between gap-3 bg-amber-500/10 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-2 rounded-xl"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate" title={getSourceMappingName(m.id)}>
                      {getSourceMappingName(m.id)}
                    </span>
                    <span className="text-[10px] opacity-80 truncate flex items-center gap-1 mt-0.5">
                      <FolderOpen size={10} /> {m.folderName}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeFolderMapping(m.id)} 
                    className="text-amber-500/50 hover:text-red-500 transition-colors shrink-0 p-1 rounded-md hover:bg-red-500/10"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Direct Folder Routing (Bypass AI) */}
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-sm border border-border bg-card">
        <div className="p-4 border-b border-border bg-muted/5">
          <h3 className="font-bold text-foreground text-base">Direct Folder Routing (Bypass AI)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Petakan kontak atau grup tertentu agar file-nya langsung disimpan ke folder khusus (bypass klasifikasi AI).</p>
        </div>
        <div className="p-4 flex-1">
          <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-muted/5 p-3 rounded-xl border border-border/40">
            <select 
              value={mappingSourceInput}
              onChange={(e) => setMappingSourceInput(e.target.value)}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground min-w-0"
            >
              <option value="">Pilih Target Group / User...</option>
              <optgroup label="Groups">
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{getGroupName(g.id)}</option>
                ))}
              </optgroup>
              <optgroup label="Users">
                {users.map(u => (
                  <option key={u.id} value={u.id}>{getUserName(u.id)}</option>
                ))}
              </optgroup>
            </select>
            <input 
              type="text"
              value={mappingFolderInput}
              onChange={(e) => setMappingFolderInput(e.target.value)}
              placeholder="Folder Name (e.g. Laporan_Tim_A)"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground min-w-0"
            />
            <button 
              type="button"
              onClick={addFolderMapping} 
              className="bg-primary text-primary-foreground p-2 px-4 rounded-xl hover:bg-primary/95 transition-all text-sm font-semibold active:scale-95 shrink-0"
            >
              Add Rule
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
            {folderMappings.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic py-2">Belum ada aturan routing.</p>
            ) : (
              folderMappings.map((mapping) => (
                <div 
                  key={mapping.id} 
                  className="min-w-0 w-full sm:w-auto flex items-center justify-between gap-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-2 rounded-xl"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate max-w-[200px]" title={getSourceMappingName(mapping.id)}>
                      Dari: {getSourceMappingName(mapping.id)}
                    </span>
                    <span className="text-[10px] opacity-80 truncate">
                      ➔ Folder: {mapping.folderName}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeFolderMapping(mapping.id)} 
                    className="text-amber-500/50 hover:text-red-500 transition-colors shrink-0 p-1 rounded-md hover:bg-red-500/10"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Categories & Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-sm border border-border bg-card">
          <div className="p-4 border-b border-border bg-muted/5">
            <h3 className="font-bold text-foreground text-base">Valid Categories</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Jenis kategori dokumen yang valid diterima oleh sistem.</p>
          </div>
          <div className="p-4 flex-1">
            <div className="flex flex-col gap-2 mb-4 bg-muted/5 p-3 rounded-xl border border-border/40">
              <input 
                type="text" 
                value={newCatName} 
                onChange={e => setNewCatName(e.target.value)} 
                placeholder="Category Name (e.g. INVOICE)" 
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200" 
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCatAliases} 
                  onChange={e => setNewCatAliases(e.target.value)} 
                  placeholder="Aliases (pisahkan dengan koma)" 
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200" 
                />
                <button 
                  type="button"
                  onClick={addCategory} 
                  className="bg-primary text-primary-foreground p-2 rounded-xl hover:bg-primary/95 transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                  title="Tambah Kategori"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic py-2 col-span-2">Belum ada kategori yang dikonfigurasi.</p>
              ) : (
                categories.map((cat: any) => {
                  const isEditing = editingCatId === (cat.id || cat.name);
                  if (isEditing) {
                    return (
                      <div 
                        key={cat.id || cat.name} 
                        className="flex flex-col gap-2 bg-background border-2 border-primary/40 p-3 rounded-xl shadow-md transition-all duration-200"
                      >
                        <input 
                          type="text" 
                          value={editCatName} 
                          onChange={e => setEditCatName(e.target.value)} 
                          placeholder="Category Name" 
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <input 
                          type="text" 
                          value={editCatAliases} 
                          onChange={e => setEditCatAliases(e.target.value)} 
                          placeholder="Aliases (comma separated)" 
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button 
                            type="button"
                            onClick={() => setEditingCatId(null)} 
                            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => saveEditCategory(cat.name)} 
                            className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm flex items-center justify-center"
                            title="Simpan"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={cat.id || cat.name} 
                      className="min-w-0 max-w-full flex items-start justify-between gap-3 bg-muted/20 border border-border p-3 rounded-xl hover:border-primary/40 hover:bg-muted/30 transition-all duration-200 group cursor-pointer"
                      onClick={() => startEditCategory(cat)}
                      title="Klik untuk mengedit"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-foreground truncate block hover:text-primary transition-colors">
                          {cat.name}
                        </span>
                        {cat.aliases && cat.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5 max-w-full">
                            {cat.aliases.map((alias: string) => (
                              <span 
                                key={alias} 
                                className="text-[10px] font-medium bg-background border border-border/80 text-muted-foreground px-1.5 py-0.5 rounded shadow-sm truncate max-w-[80px]"
                                title={alias}
                              >
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 italic block mt-1">Tidak ada alias</span>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah memicu startEditCategory
                          removeCategory(cat.name);
                        }} 
                        className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0 p-0.5 rounded-md hover:bg-red-500/10 mt-0.5"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Clients */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-sm border border-border bg-card">
          <div className="p-4 border-b border-border bg-muted/5">
            <h3 className="font-bold text-foreground text-base">Smart Client Dictionary</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Kamus penyingkat otomatis atau singkatan untuk nama klien/perusahaan.</p>
          </div>
          <div className="p-4 flex-1">
            <div className="flex flex-col gap-2 mb-4 bg-muted/5 p-3 rounded-xl border border-border/40">
              <input 
                type="text" 
                value={newClientName} 
                onChange={e => setNewClientName(e.target.value)} 
                placeholder="Client Name (e.g. SJIO)" 
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200" 
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newClientAliases} 
                  onChange={e => setNewClientAliases(e.target.value)} 
                  placeholder="Aliases (pisahkan dengan koma)" 
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all duration-200" 
                />
                <button 
                  type="button"
                  onClick={addClient} 
                  className="bg-primary text-primary-foreground p-2 rounded-xl hover:bg-primary/95 transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                  title="Tambah Klien"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {clients.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic py-2 col-span-2">Belum ada klien yang dikonfigurasi.</p>
              ) : (
                clients.map((client: any) => {
                  const isEditing = editingClientId === (client.id || client.name);
                  if (isEditing) {
                    return (
                      <div 
                        key={client.id || client.name} 
                        className="flex flex-col gap-2 bg-background border-2 border-primary/45 p-3 rounded-xl shadow-md transition-all duration-200"
                      >
                        <input 
                          type="text" 
                          value={editClientName} 
                          onChange={e => setEditClientName(e.target.value)} 
                          placeholder="Client Name" 
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <input 
                          type="text" 
                          value={editClientAliases} 
                          onChange={e => setEditClientAliases(e.target.value)} 
                          placeholder="Aliases (comma separated)" 
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button 
                            type="button"
                            onClick={() => setEditingClientId(null)} 
                            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => saveEditClient(client.name)} 
                            className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm flex items-center justify-center"
                            title="Simpan"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={client.id || client.name} 
                      className="min-w-0 max-w-full flex items-start justify-between gap-3 bg-primary/5 border border-primary/10 p-3 rounded-xl hover:border-primary/45 hover:bg-primary/10 transition-all duration-200 group cursor-pointer"
                      onClick={() => startEditClient(client)}
                      title="Klik untuk mengedit"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary truncate block hover:text-primary transition-colors">
                          {client.name}
                        </span>
                        {client.aliases && client.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5 max-w-full">
                            {client.aliases.map((alias: string) => (
                              <span 
                                key={alias} 
                                className="text-[10px] font-medium bg-background border border-primary/20 text-primary/80 px-1.5 py-0.5 rounded shadow-sm truncate max-w-[80px]"
                                title={alias}
                              >
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-primary/40 italic block mt-1">Tidak ada alias</span>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah memicu startEditClient
                          removeClient(client.name);
                        }} 
                        className="text-primary/40 hover:text-red-500 transition-colors shrink-0 p-0.5 rounded-md hover:bg-red-500/10 mt-0.5"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Trigger CTA */}
      <div className="flex justify-end pt-4 border-t border-border">
        <button 
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground px-6 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 select-none cursor-pointer"
        >
          {isSaving ? (
            <RefreshCw size={17} className="animate-spin" />
          ) : (
            <Save size={17} />
          )}
          {isSaving ? "Menyimpan Pengaturan..." : "Save Settings"}
        </button>
      </div>

      <FolderPickerModal 
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        initialPath={config.baseDirectory}
        onSelect={(path) => {
          setConfig({...config, baseDirectory: path});
          setIsFolderPickerOpen(false);
        }}
      />
    </div>
  );
}
