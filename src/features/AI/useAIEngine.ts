import { useState, useRef, useEffect } from 'react';
import AIBridge from './AIBridge';
import type { Message, ChatSession } from '../../types';
import { isSmallTalkMessage } from './promptBuilder';


export const useAIEngine = (
    loadedModel: string | null,
    aiConfig: any,
    chatMessages: Message[],
    setChatMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    activeSessionId: string | null,
    setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
    activeSessionRef: React.MutableRefObject<string | null>,
    getContext: (userInput: string) => Promise<string> | string,
    formatPrompt: (modelId: string, history: Message[], userMsg: string, context: string, aiConfig: any) => string,
    parseCommands: (text: string) => Promise<string>,
    persistSessions: (sessions?: ChatSession[]) => Promise<void>
) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const lastContextRef = useRef<string>("");
    const tokenBufferRef = useRef("");
    const lastUpdateRef = useRef(0);
    const tokenCountRef = useRef(0);
    const generationStartTimeRef = useRef(0);
    const isGeneratingRef = useRef(false);

    useEffect(() => {
        isGeneratingRef.current = isGenerating;
    }, [isGenerating]);

    useEffect(() => {
        const tokenListener = AIBridge.addListener('token', (data: { token: string }) => {
            if (!isGeneratingRef.current) return;
            tokenBufferRef.current += data.token;
            tokenCountRef.current++;

            if (tokenCountRef.current === 1) {
                generationStartTimeRef.current = Date.now();
                setIsThinking(false);
            }

            const now = Date.now();
            if (now - lastUpdateRef.current > 40) {
                const elapsed = now - generationStartTimeRef.current;
                const msPerToken = tokenCountRef.current > 0 ? (elapsed / tokenCountRef.current).toFixed(1) : 0;
                const bufferedText = tokenBufferRef.current;
                tokenBufferRef.current = "";
                lastUpdateRef.current = now;

                setChatMessages(prev => {
                    if (prev.length === 0) return prev;
                    const last = prev[prev.length - 1];
                    if (last && last.sender === 'bot') {
                        return [...prev.slice(0, -1), {
                            ...last,
                            text: last.text + bufferedText,
                            msPerToken: Number(msPerToken)
                        }];
                    }
                    return [...prev, {
                        id: Date.now().toString(),
                        text: bufferedText,
                        sender: 'bot',
                        timestamp: Date.now(),
                        msPerToken: Number(msPerToken)
                    }];
                });
            }
        });

        const doneListener = AIBridge.addListener('done', async (data: { fullResponse: string }) => {
            if (!isGeneratingRef.current) return;
            if (generationStartTimeRef.current === -1) return;

            const finalBotText = data.fullResponse;
            tokenBufferRef.current = "";
            setIsGenerating(false);
            setIsThinking(false);

            const currentSessionId = activeSessionRef.current;
            if (!currentSessionId) return;

            const cleanedText = await parseCommands(finalBotText);

            setChatMessages(prev => {
                if (prev.length === 0) return prev;
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.sender === 'bot') last.text = cleanedText;

                setSessions(currS => {
                    const updatedSessions = currS.map(s =>
                        s.id === currentSessionId ? { ...s, messages: updated, lastModified: Date.now() } : s
                    );
                    persistSessions(updatedSessions);
                    return updatedSessions;
                });
                return updated;
            });
        });

        return () => {
            tokenListener.then(h => h.remove());
            doneListener.then(h => h.remove());
        };
    }, [parseCommands, persistSessions, setChatMessages, setSessions, activeSessionRef]);

const isFollowUp = (msg: string) => {
    const short = msg.trim().toLowerCase();

    const followUps = [
        "why",
        "why?",
        "how",
        "how?",
        "explain",
        "explain more",
        "tell me more",
        "what about that",
        "and then",
        "continue",
        "go on"
    ];

    if (short.length < 15 && followUps.some(f => short.includes(f))) {
        return true;
    }

    return false;
};

const getGenerationOverrides = (aiConfig: any, inputText: string) => {
    if (!isSmallTalkMessage(inputText)) {
        return {
            n_predict: aiConfig.n_predict ?? 256,
            temperature: aiConfig.temperature ?? 0.5,
            top_k: aiConfig.top_k ?? 20,
            top_p: aiConfig.top_p ?? 0.85,
            penalty: aiConfig.penalty ?? 1.2
        };
    }

    // Small talk: ultra-fast, short responses
    return {
        n_predict: Math.min(aiConfig.n_predict ?? 256, 48),
        temperature: 0.4,
        top_k: 15,
        top_p: 0.8,
        penalty: 1.15
    };
};

    const handleSendMessage = async (inputText: string, setInputText: (t: string) => void) => {
        if (!inputText.trim() || isGenerating) return;
        if (!loadedModel) {
            setError("Please load a model first");
            setTimeout(() => setError(null), 3000);
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            timestamp: Date.now()
        };

        let turnSessionId = activeSessionId;
        if (!turnSessionId) {
            turnSessionId = Date.now().toString();
            const newSession: ChatSession = {
                id: turnSessionId,
                title: inputText.length > 30 ? inputText.substring(0, 27) + '...' : inputText,
                messages: [userMsg],
                lastModified: Date.now(),
                modelName: loadedModel || undefined
            };
            setSessions(prev => [newSession, ...prev]);
            activeSessionRef.current = turnSessionId;
        }

        if (chatMessages.length === 0) {
            const title = inputText.length > 30 ? inputText.substring(0, 27) + '...' : inputText;
            setSessions(prev => prev.map(s => s.id === turnSessionId ? { ...s, title } : s));
        }

        setChatMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsGenerating(true);
        setIsThinking(true);
        tokenCountRef.current = 0;
        tokenBufferRef.current = "";
        lastUpdateRef.current = 0;
        generationStartTimeRef.current = Date.now();

        try {
            let contextGrounding = "";
            const shouldUseFastPath = aiConfig.directMode || isSmallTalkMessage(userMsg.text);

if (!aiConfig.disableContext && !shouldUseFastPath) {

    if (isFollowUp(userMsg.text) && lastContextRef.current) {
        contextGrounding = lastContextRef.current;
    } else {
        contextGrounding = await getContext(userMsg.text);
        lastContextRef.current = contextGrounding;
    }

}
            const prompt = formatPrompt(loadedModel, chatMessages, userMsg.text, contextGrounding, aiConfig);
            const generationOverrides = getGenerationOverrides(aiConfig, userMsg.text);

            await AIBridge.generate({
                prompt: prompt,
                stop: ["<|im_end|>", "<|eot_id|>", "<end_of_turn>", "<|end_of_turn|>", "User:", "Assistant:", "</s>", "System:"],
                temperature: generationOverrides.temperature,
                n_predict: generationOverrides.n_predict,
                top_k: generationOverrides.top_k,
                top_p: generationOverrides.top_p,
                penalty: generationOverrides.penalty,
                threads: aiConfig.threads
            });
        } catch (err) {
            setError("Generation failed: " + err);
            setIsGenerating(false);
            setIsThinking(false);
        }
    };

    const handleStopGeneration = async () => {
        await AIBridge.stopGenerate();
        generationStartTimeRef.current = -1;
        setIsGenerating(false);
        setIsThinking(false);
    };

    return {
        isGenerating,
        error, setError,
        isThinking,
        handleSendMessage,
        handleStopGeneration
    };
};
