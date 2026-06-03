"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck,
  User,
  Users
} from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  timestamp: string;
  status: "sent" | "delivered" | "read";
}

interface Contact {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  type: "user" | "group";
  avatar?: string;
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([
    { id: "1234567890@c.us", name: "John Doe", type: "user", lastMessage: "Hello!", lastMessageTime: "10:30 AM", unreadCount: 2 },
    { id: "0987654321@c.us", name: "Alice Smith", type: "user", lastMessage: "See you later.", lastMessageTime: "Yesterday" },
    { id: "1122334455@g.us", name: "Team Group", type: "group", lastMessage: "Meeting at 3 PM", lastMessageTime: "Yesterday" }
  ]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    "1234567890@c.us": [
      { id: "m1", text: "Hi there!", sender: "them", timestamp: "10:28 AM", status: "read" },
      { id: "m2", text: "Hello! How can I help you?", sender: "me", timestamp: "10:29 AM", status: "read" },
      { id: "m3", text: "Hello!", sender: "them", timestamp: "10:30 AM", status: "read" }
    ]
  });
  const [inputText, setInputText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch contacts & groups
    const fetchContacts = async () => {
      try {
        const [contactsRes, groupsRes] = await Promise.all([
          fetch("http://localhost:3001/api/contacts").catch(() => null),
          fetch("http://localhost:3001/api/groups").catch(() => null)
        ]);

        let loadedContacts: Contact[] = [];
        if (contactsRes?.ok) {
          const data = await contactsRes.json();
          if (Array.isArray(data)) {
            loadedContacts = [...loadedContacts, ...data.map(c => ({
              id: c.id?.replace?.(/@c\.us/g, '') + '@c.us' || c.number + '@c.us',
              name: c.name || c.pushname || c.number || "Unknown",
              type: "user" as const
            }))];
          }
        }
        if (groupsRes?.ok) {
          const data = await groupsRes.json();
          if (Array.isArray(data)) {
            loadedContacts = [...loadedContacts, ...data.map(g => ({
              id: g.id || g.groupMetadata?.id || "unknown",
              name: g.name || g.groupMetadata?.subject || "Unknown Group",
              type: "group" as const
            }))];
          }
        }
        
        if (loadedContacts.length > 0) {
          // Keep existing sample messages/states if not in fetched, or just merge
          setContacts(prev => {
            const merged = [...loadedContacts];
            // Just using fetched for simplicity, but if empty we fallback to initial
            return merged;
          });
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      }
    };

    fetchContacts();

    // Initialize socket
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("new_message", (msg: any) => {
      console.log("New message received:", msg);
      
      const isFromMe = msg.isFromMe || false;
      const targetId = isFromMe ? msg.to : msg.senderId;
      
      if (!targetId) return; // Prevent crashes if malformed

      const newMessage: Message = {
        id: msg.id || Date.now().toString(),
        text: msg.body || "",
        sender: isFromMe ? "me" : "them",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "read"
      };

      setMessages(prev => {
        const chatMessages = prev[targetId] || [];
        return {
          ...prev,
          [targetId]: [...chatMessages, newMessage]
        };
      });

      // Update contact list last message
      setContacts(prev => {
        const existing = prev.find(c => c.id === targetId);
        if (existing) {
          const updated = {
            ...existing,
            lastMessage: newMessage.text,
            lastMessageTime: newMessage.timestamp,
            unreadCount: (existing.unreadCount || 0) + (isFromMe ? 0 : 1)
          };
          return [updated, ...prev.filter(c => c.id !== targetId)];
        } else {
          // Add new contact if not exists
          const newContact: Contact = {
            id: targetId,
            name: msg.senderName || msg._data?.notifyName || targetId.split('@')[0],
            type: targetId.includes('@g.us') ? "group" : "user",
            lastMessage: newMessage.text,
            lastMessageTime: newMessage.timestamp,
            unreadCount: isFromMe ? 0 : 1
          };
          return [newContact, ...prev];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedContact]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedContact) return;

    const messageText = inputText.trim();
    setInputText("");

    try {
      const res = await fetch("http://localhost:3001/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: selectedContact.id,
          message: messageText
        })
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }
      
      // We could update the status to "delivered" here based on response
    } catch (err) {
      console.error("Send error:", err);
      // Could mark message as failed in UI
    }
  };

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    // Clear unread count
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unreadCount: 0 } : c));
    
    try {
      const res = await fetch(`http://localhost:3001/api/messages/${contact.id}`);
      if (res.ok) {
        const history = await res.json();
        setMessages(prev => ({
          ...prev,
          [contact.id]: history
        }));
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full overflow-hidden bg-background border border-border rounded-xl shadow-sm">
      {/* Sidebar Contacts */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-border bg-card/50">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-semibold mb-4 text-foreground tracking-tight">Live Chat</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              className="w-full bg-muted/50 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {contacts.map(contact => (
            <div 
              key={contact.id}
              onClick={() => handleSelectContact(contact)}
              className={`
                flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-border/50
                ${selectedContact?.id === contact.id ? 'bg-primary/10' : 'hover:bg-muted/50'}
              `}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold overflow-hidden">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                  ) : contact.type === 'group' ? (
                    <Users size={24} />
                  ) : (
                    <User size={24} />
                  )}
                </div>
                {contact.type === 'user' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-medium text-sm truncate text-foreground">{contact.name}</h3>
                  {contact.lastMessageTime && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {contact.lastMessageTime}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground truncate pr-2">
                    {contact.lastMessage || "No messages yet"}
                  </p>
                  {!!contact.unreadCount && contact.unreadCount > 0 && (
                    <span className="flex-shrink-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          {/* Chat Header */}
          <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/80 backdrop-blur-sm absolute top-0 w-full z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                {selectedContact.type === 'group' ? <Users size={20} /> : <User size={20} />}
              </div>
              <div>
                <h2 className="font-semibold text-sm text-foreground">{selectedContact.name}</h2>
                <p className="text-xs text-green-500 font-medium">
                  {selectedContact.type === 'user' ? 'Online' : 'Group Chat'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <button className="hover:text-foreground transition-colors"><Video size={20} /></button>
              <button className="hover:text-foreground transition-colors"><Phone size={20} /></button>
              <button className="hover:text-foreground transition-colors"><MoreVertical size={20} /></button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-24 pb-20 custom-scrollbar flex flex-col gap-4">
            {(messages[selectedContact.id] || []).map((msg, index) => {
              const isMe = msg.sender === 'me';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
                  <div 
                    className={`
                      px-4 py-2 rounded-2xl relative group
                      ${isMe 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted text-foreground rounded-tl-sm border border-border/50'
                      }
                    `}
                  >
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                    {isMe && (
                      <span className="text-primary/70">
                        {msg.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 w-full p-4 bg-card/80 backdrop-blur-sm border-t border-border">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-muted/30 p-2 rounded-xl border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <Smile size={20} />
              </button>
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <Paperclip size={20} />
              </button>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="w-full max-h-32 bg-transparent border-none resize-none focus:ring-0 text-sm py-2 px-2 text-foreground placeholder:text-muted-foreground scrollbar-hide"
                rows={1}
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className={`
                  p-2 rounded-lg flex-shrink-0 transition-all
                  ${inputText.trim() 
                    ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                <Send size={18} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-background/50 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Search size={32} className="opacity-50" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">WhatsApp Live Chat</h2>
          <p className="text-sm max-w-md text-center">
            Select a contact or group from the sidebar to start messaging. Your messages are synced in real-time.
          </p>
        </div>
      )}
    </div>
  );
}
