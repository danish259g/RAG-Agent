"use client";
import React, { useState, useRef, useEffect } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface RetrievalContext {
    talk_id: string;
    title: string;
    chunk: string;
    score: number;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! Must answer only from TED context. Ask me anything." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState<RetrievalContext[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setLoading(true);

        try {
            const res = await fetch("/api/prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: userMessage }),
            });

            const data = await res.json();

            if (data.error) {
                setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
                if (data.context) {
                    setContext(data.context);
                }
            }
        } catch (err) {
            setMessages((prev) => [...prev, { role: "assistant", content: "Failed to fetch response." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 lg:flex-row h-[700px]">
            {/* Chat Area */}
            <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                                    ? "bg-blue-600/20 text-blue-100 border border-blue-500/30 rounded-br-none"
                                    : "bg-zinc-800/60 text-zinc-100 border border-zinc-700/50 rounded-bl-none"
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-800/60 text-zinc-400 px-4 py-2 rounded-xl text-xs animate-pulse">
                                Processing...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-white/5">
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-light"
                            placeholder="Ask a question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* Context Area */}
            <div className="w-full lg:w-80 flex flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden h-[300px] lg:h-auto">
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-sm font-medium text-zinc-300">Retrieved Context</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {context.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic text-center mt-10">No context retrieved yet.</p>
                    ) : (
                        context.map((ctx, i) => (
                            <div key={i} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider truncate max-w-[150px]">{ctx.title}</span>
                                    <span className="text-[10px] text-zinc-500 ml-2">Score: {ctx.score.toFixed(3)}</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 line-clamp-3 leading-loose border-l-2 border-zinc-700 pl-2">
                                    {ctx.chunk}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
