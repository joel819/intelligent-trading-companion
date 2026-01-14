import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/client';
import {
    Send,
    Mic,
    MicOff,
    Loader2,
    Bot,
    User,
    Sparkles,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface TradingContext {
    symbol?: string;
    price?: number;
    rsi?: number;
    adx?: number;
    trend?: string;
    marketMode?: string;
    positions?: Array<{ symbol: string; pnl: number; type: string }>;
    skippedSignals?: Array<{ symbol: string; reason: string }>;
    botStatus?: { isRunning: boolean; strategy: string };
}

interface AIChatPanelProps {
    tradingContext?: TradingContext;
}

export const AIChatPanel = ({ tradingContext }: AIChatPanelProps) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "👋 Hello! I'm your AI trading assistant. I can help you understand your trades, analyze market conditions, and answer questions about your trading strategies. What would you like to know?",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Build context from trading data
            const context = tradingContext ? {
                symbol: tradingContext.symbol,
                price: tradingContext.price,
                rsi: tradingContext.rsi,
                adx: tradingContext.adx,
                trend: tradingContext.trend,
                market_mode: tradingContext.marketMode,
                open_positions: tradingContext.positions?.length || 0,
                recent_skipped: tradingContext.skippedSignals?.slice(0, 3).map(s => s.reason) || [],
                bot_running: tradingContext.botStatus?.isRunning,
                active_strategy: tradingContext.botStatus?.strategy
            } : undefined;

            const response = await api.ai.chat(messageText.trim(), context);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '❌ Sorry, I encountered an error processing your request. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                try {
                    setIsLoading(true);
                    const response = await api.ai.transcribe(audioBlob);
                    if (response.text) {
                        setInput(response.text);
                    }
                } catch (error) {
                    console.error('Transcription error:', error);
                } finally {
                    setIsLoading(false);
                }
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (error) {
            console.error('Microphone access error:', error);
            alert('Unable to access microphone. Please check your browser permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const handleClearChat = async () => {
        try {
            await api.ai.clearHistory();
            setMessages([{
                id: 'welcome-new',
                role: 'assistant',
                content: "🔄 Chat history cleared! How can I help you today?",
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Failed to clear chat history:', error);
        }
    };

    const quickActions = [
        { label: 'Analyze Market', prompt: 'Analyze the current market conditions for my selected symbol' },
        { label: 'Explain Last Skip', prompt: 'Why was the last trade signal skipped?' },
        { label: 'Position Summary', prompt: 'Summarize my current open positions' },
        { label: 'Strategy Help', prompt: 'Explain how the current trading strategy works' }
    ];

    return (
        <Card className="h-[calc(100vh-180px)] flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
            <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">AI Trading Assistant</CardTitle>
                            <p className="text-xs text-muted-foreground">Powered by GPT-4</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Trading Context Badge */}
                        {tradingContext?.symbol && (
                            <Badge variant="outline" className="gap-1.5 text-xs">
                                {tradingContext.trend === 'up' ? (
                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                ) : tradingContext.trend === 'down' ? (
                                    <TrendingDown className="w-3 h-3 text-red-500" />
                                ) : null}
                                {tradingContext.symbol}
                                {tradingContext.price && (
                                    <span className="text-muted-foreground ml-1">
                                        @ {tradingContext.price.toFixed(2)}
                                    </span>
                                )}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearChat}
                            className="h-8 w-8"
                            title="Clear chat history"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "flex gap-3 animate-fade-in",
                                    message.role === 'user' ? 'flex-row-reverse' : ''
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                )}>
                                    {message.role === 'user' ? (
                                        <User className="w-4 h-4" />
                                    ) : (
                                        <Bot className="w-4 h-4" />
                                    )}
                                </div>
                                <div className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-2.5",
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                        : 'bg-muted rounded-tl-sm'
                                )}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <p className={cn(
                                        "text-[10px] mt-1",
                                        message.role === 'user'
                                            ? 'text-primary-foreground/70 text-right'
                                            : 'text-muted-foreground'
                                    )}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex gap-3 animate-fade-in">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Quick Actions */}
                <div className="px-4 py-2 border-t bg-muted/30">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {quickActions.map((action, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="shrink-0 text-xs h-7"
                                onClick={() => sendMessage(action.prompt)}
                                disabled={isLoading}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-background">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Textarea
                                placeholder="Ask about your trades, market analysis, or strategies..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(input);
                                    }
                                }}
                                className="min-h-[44px] max-h-[120px] resize-none pr-20"
                                disabled={isLoading || isRecording}
                            />
                            <div className="absolute right-2 bottom-2 flex gap-1">
                                <Button
                                    size="icon"
                                    variant={isRecording ? 'destructive' : 'ghost'}
                                    className={cn(
                                        "h-8 w-8 transition-all",
                                        isRecording && "animate-pulse"
                                    )}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isLoading}
                                    title={isRecording ? 'Stop recording' : 'Voice input'}
                                >
                                    {isRecording ? (
                                        <MicOff className="w-4 h-4" />
                                    ) : (
                                        <Mic className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            className="h-[44px] w-[44px]"
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
