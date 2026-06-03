import { useState } from "react";
import { X, Send, Bot, User, ExternalLink, Loader } from "lucide-react";
import { useAsk } from "@/hooks/useAsk";
import type { CompanyRequest } from "@/types/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { document: string; page?: number; excerpt?: string; source: string }[];
  isLoading?: boolean;
};

const CopilotSidebar = ({
  isOpen,
  onClose,
  context,
  company,
}: {
  isOpen: boolean;
  onClose: () => void;
  context: string;
  company?: CompanyRequest;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const askQuery = useAsk();

  const handleSend = async () => {
    if (!input.trim() || !company?.name) return;

    const userMessage = input;
    setInput("");

    // Add user message
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    // Add loading message
    setMessages((prev) => [...prev, { role: "assistant", content: "", isLoading: true }]);

    try {
      // Call /ask endpoint
      const response = await askQuery.mutateAsync({
        question: userMessage,
        company: company.name,
        top_k: 5,
      });

      // Replace loading message with actual response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: response.answer,
          sources: response.citations.map((c) => ({
            document: c.document,
            page: c.page,
            excerpt: c.excerpt,
            source: c.source,
          })),
        },
      ]);
    } catch (error) {
      // Replace loading message with error
      console.error("Ask error:", error);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "Sorry, I encountered an error answering your question. Please try again.",
          sources: [],
        },
      ]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-12 bottom-0 w-96 bg-card border-l border-border z-40 flex flex-col animate-slide-in-right shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Research Copilot</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {context && (
        <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Selected Context</p>
          <p className="text-xs text-foreground line-clamp-3">{context}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Ask anything about this report</p>
            <p className="text-xs mt-1">Every response is source-cited</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && <Bot className="w-4 h-4 text-primary flex-shrink-0 mt-1" />}
            <div className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"} rounded-md p-2.5`}>
              {msg.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader className="w-3 h-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              ) : (
                <>
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                      {msg.sources.map((s, j) => (
                        <div key={j} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <ExternalLink className="w-3 h-3" />
                          <span title={s.excerpt} className="hover:text-primary cursor-pointer truncate">
                            {s.source}
                            {s.page ? ` p.${s.page}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {msg.role === "user" && <User className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={company?.name ? "Ask about this report..." : "Select a company first..."}
            disabled={!company?.name || askQuery.isPending}
            className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!company?.name || !input.trim() || askQuery.isPending}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Agent will refuse unverifiable claims
        </p>
      </div>
    </div>
  );
};

export default CopilotSidebar;
