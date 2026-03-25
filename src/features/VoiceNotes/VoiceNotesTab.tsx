import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AudioLines, BrainCircuit, Sparkles } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useThemeContext } from '../../context/ThemeContext';
import { transcribeAudio } from './mockAi';
import { summarizeTranscript } from './voiceAi';
import { syncBackgroundVoiceWorker } from './backgroundScheduler';
import { NotesList } from './NotesList';
import { NoteModal } from './NoteModal';
import { RecordButton } from './RecordButton';
import { WaveAnimation } from './WaveAnimation';
import { useVoiceNotes } from './useVoiceNotes';
import type { VoiceNote } from './types';

interface SpeechRecognitionResultLike {
    readonly isFinal: boolean;
    readonly 0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
    readonly resultIndex: number;
    readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
}

declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }
}

type RecorderPhase = 'idle' | 'recording' | 'transcribing' | 'summarizing';


function formatTimer(seconds: number) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
}

async function triggerFeedback(): Promise<void> {
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
        if (navigator.vibrate) navigator.vibrate(16);
    }
}

function createId() {
    try {
        return crypto.randomUUID();
    } catch {
        return `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export const VoiceNotesTab: React.FC = () => {
    const { voiceAiChargingEnabled } = useSettings();
    const { theme } = useThemeContext();
    const dark = theme === 'dark';
    const { notes, loading, updateNotes } = useVoiceNotes();
    const [phase, setPhase] = useState<RecorderPhase>('idle');
    const [seconds, setSeconds] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [activeNote, setActiveNote] = useState<VoiceNote | null>(null);
    const [statusMessage, setStatusMessage] = useState('Tap the mic and capture what is on your mind.');
    const [isMicSupported, setIsMicSupported] = useState(true);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const transcriptBufferRef = useRef('');
    const streamRef = useRef<MediaStream | null>(null);
    const listAnchorRef = useRef<HTMLDivElement | null>(null);

    const isRecording = phase === 'recording';
    const isBusy = phase === 'transcribing' || phase === 'summarizing';

    useEffect(() => {
        if (!isRecording) return;

        const interval = window.setInterval(() => {
            setSeconds(current => current + 1);
        }, 1000);

        return () => window.clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        setIsMicSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
    }, []);

    const pendingNotes = useMemo(() => notes.filter(note => note.status !== 'completed'), [notes]);
    const pendingCount = pendingNotes.length;
    const latestPendingNote = pendingNotes[0] ?? null;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;

    useEffect(() => {
        if (loading) return;
        void syncBackgroundVoiceWorker(voiceAiChargingEnabled && pendingCount > 0);
    }, [loading, voiceAiChargingEnabled, pendingCount]);

    const beginSpeechRecognition = () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return;

        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
            let transcript = '';
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                transcript += event.results[index][0].transcript;
            }
            transcriptBufferRef.current = transcript.trim();
            setLiveTranscript(transcriptBufferRef.current);
        };
        recognition.onerror = () => undefined;
        recognition.onend = () => {
            recognitionRef.current = null;
        };
        recognition.start();
        recognitionRef.current = recognition;
    };

    const stopRecorderInternals = () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
    };

    const startRecording = async () => {
        if (!isMicSupported || isBusy) return;

        try {
            await triggerFeedback();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioChunksRef.current = [];
            transcriptBufferRef.current = '';
            setLiveTranscript('');
            setSeconds(0);
            setPhase('recording');
            setStatusMessage('Listening softly. Tap again when you are done.');

            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            beginSpeechRecognition();
        } catch (error) {
            console.error('Unable to start recording', error);
            setStatusMessage('Microphone access is needed to record voice notes.');
            setPhase('idle');
        }
    };

    const saveRawNote = async (transcript: string, durationMs: number, audioDataUrl: string): Promise<VoiceNote> => {
        const note: VoiceNote = {
            id: createId(),
            title: 'Transcript Ready',
            transcript,
            summary: '',
            excerpt: transcript.slice(0, 120),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            durationMs,
            status: 'queued',
            audioDataUrl,
            summaryProvider: undefined,
        };

        await updateNotes(current => [note, ...current]);
        setTimeout(() => {
            listAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return note;
    };

    const extractNoteNow = async (noteId: string) => {
        let noteToProcess: VoiceNote | undefined;

        await updateNotes(current => current.map(note => {
            if (note.id === noteId) {
                noteToProcess = note;
                return { ...note, status: 'processing', updatedAt: Date.now() };
            }
            return note;
        }));

        if (!noteToProcess) return;

        setStatusMessage('Generating summary...');
        const result = await summarizeTranscript(noteToProcess.transcript);

        await updateNotes(current => current.map(note => (
            note.id === noteId
                ? {
                    ...note,
                    ...result,
                    status: 'completed',
                    updatedAt: Date.now(),
                    summaryProvider: result.provider,
                }
                : note
        )));

        setActiveNote(current => current?.id === noteId ? {
            ...current,
            ...result,
            status: 'completed',
            updatedAt: Date.now(),
            summaryProvider: result.provider,
        } : current);

        setStatusMessage(result.provider === 'qwen'
            ? 'Qwen polished your voice note into a cleaner summary.'
            : 'A basic summary is ready. Load Qwen in Akitsu for richer voice-note extraction.');
        setPhase('idle');
        await triggerFeedback();
    };

    const stopRecording = async () => {
        if (!mediaRecorderRef.current || phase !== 'recording') return;

        await triggerFeedback();
        setPhase('transcribing');
        setStatusMessage('Transcribing your recording...');

        const recorder = mediaRecorderRef.current;

        const stopPromise = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
        });

        stopRecorderInternals();
        await stopPromise;

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const durationMs = seconds * 1000;
        const audioDataUrl = await blobToDataUrl(audioBlob);
        const transcript = await transcribeAudio(transcriptBufferRef.current, Math.max(durationMs, audioBlob.size / 12));
        await saveRawNote(transcript, durationMs, audioDataUrl);

        setLiveTranscript(transcript);
        setPhase('idle');
        setStatusMessage(
            voiceAiChargingEnabled
                ? 'Transcript saved. It is queued for charging mode, or you can force extract right now.'
                : 'Transcript saved. You can extract now whenever you are ready.'
        );

        if (voiceAiChargingEnabled) {
            await syncBackgroundVoiceWorker(true);
        }
    };

    const handleRecordPress = () => {
        if (isRecording) {
            void stopRecording();
        } else {
            void startRecording();
        }
    };

    const pendingLabel = pendingCount === 1 ? '1 note waiting for AI' : `${pendingCount} notes waiting for AI`;
    const pageBg = dark ? 'linear-gradient(180deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.94) 52%, rgba(17,24,39,0.98) 100%)' : 'linear-gradient(180deg, rgba(247,248,255,0.72) 0%, rgba(243,248,255,0.78) 45%, rgba(255,245,248,0.8) 100%)';
    const panelBg = dark ? 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(30,41,59,0.72) 100%)' : 'linear-gradient(180deg, rgba(246, 244, 255, 0.92) 0%, rgba(236, 245, 255, 0.95) 45%, rgba(255, 244, 247, 0.92) 100%)';
    const softCard = dark ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.72)';

    return (
        <div className="dashboard-scrollbar" style={{
            height: '100%',
            overflowY: 'auto',
            padding: 'max(1.25rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom)) 1rem',
            background: pageBg,
            position: 'relative',
        }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute',
                    top: '-8rem',
                    left: '-5rem',
                    width: '18rem',
                    height: '18rem',
                    borderRadius: '999px',
                    background: dark ? 'radial-gradient(circle, rgba(96, 165, 250, 0.18) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(179, 197, 255, 0.48) 0%, transparent 72%)',
                    filter: 'blur(24px)',
                }} />
                <div style={{
                    position: 'absolute',
                    right: '-4rem',
                    top: '14rem',
                    width: '16rem',
                    height: '16rem',
                    borderRadius: '999px',
                    background: dark ? 'radial-gradient(circle, rgba(244, 114, 182, 0.16) 0%, transparent 72%)' : 'radial-gradient(circle, rgba(255, 201, 219, 0.48) 0%, transparent 72%)',
                    filter: 'blur(24px)',
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, maxWidth: '72rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <header style={{ paddingTop: '2.6rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.8rem', borderRadius: '999px', background: dark ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.72)', color: dark ? 'rgba(226,232,240,0.72)' : '#60718d', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.9rem' }}>
                        <Sparkles size={14} />
                        Voice-powered capture
                    </div>
                    <h1 style={{ margin: 0, fontSize: 'clamp(2.1rem, 4vw, 3.2rem)', fontWeight: 900, color: dark ? '#f8fafc' : '#22324f', letterSpacing: '-0.05em' }}>
                        Voice Notes
                    </h1>
                    <p style={{ margin: '0.45rem 0 0 0', fontSize: '1rem', color: dark ? 'rgba(226,232,240,0.7)' : '#687996', maxWidth: '32rem', lineHeight: 1.7 }}>
                        Turn thoughts into summaries. Capture the raw idea now, then let AI refine it instantly or later while your phone is charging.
                    </p>
                </header>

                <section style={{
                    padding: '1.2rem',
                    borderRadius: '2rem',
                    background: panelBg,
                    border: dark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(255,255,255,0.5)',
                    boxShadow: dark ? '0 28px 64px rgba(2, 6, 23, 0.34)' : '0 28px 64px rgba(76, 92, 146, 0.12)',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.4fr) minmax(260px, 1fr)',
                    gap: '1rem',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: dark ? 'rgba(226,232,240,0.64)' : '#6b7c97', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recorder</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: dark ? '#f8fafc' : '#243652', marginTop: '0.25rem' }}>
                                    {isRecording ? 'Recording live' : isBusy ? 'Processing beautifully' : 'Ready when you are'}
                                </div>
                            </div>
                            <div style={{ padding: '0.55rem 0.85rem', borderRadius: '999px', background: dark ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.72)', color: dark ? 'rgba(226,232,240,0.78)' : '#4e6080', fontWeight: 700, fontSize: '0.88rem' }}>
                                {formatTimer(seconds)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <RecordButton isRecording={isRecording} isDisabled={!isMicSupported || isBusy} onClick={handleRecordPress} dark={dark} />
                            <div style={{ flex: 1, minWidth: '14rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ color: dark ? 'rgba(226,232,240,0.74)' : '#61728f', fontSize: '0.96rem', lineHeight: 1.7 }}>{statusMessage}</div>
                                <div style={{
                                    minHeight: '6.75rem',
                                    borderRadius: '1.35rem',
                                    padding: '1rem',
                                    background: softCard,
                                    border: dark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(255,255,255,0.65)',
                                    color: dark ? 'rgba(226,232,240,0.88)' : '#304561',
                                    lineHeight: 1.65,
                                    boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.55)',
                                }}>
                                    {liveTranscript || (isRecording ? 'Your live transcript will appear here as you speak.' : 'Raw transcript preview appears here after recording.')}
                                </div>
                                {latestPendingNote && !isRecording && !isBusy && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPhase('summarizing');
                                                void extractNoteNow(latestPendingNote.id);
                                            }}
                                            style={{
                                                padding: '0.8rem 1rem',
                                                borderRadius: '999px',
                                                border: 'none',
                                                background: 'linear-gradient(135deg, #7d9cff 0%, #9fb4ff 100%)',
                                                color: 'white',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Force extract with AI
                                        </button>
                                        <div style={{ color: '#6b7c97', fontSize: '0.86rem' }}>
                                            {voiceAiChargingEnabled ? 'Charging mode will also pick this up later if you leave it queued.' : 'This stays as raw transcript until you ask AI to extract it.'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        borderRadius: '1.7rem',
                        padding: '1rem',
                        background: softCard,
                        border: dark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(255,255,255,0.58)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: dark ? 'rgba(226,232,240,0.64)' : '#6b7c97', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI lane</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: dark ? '#f8fafc' : '#263755', marginTop: '0.25rem' }}>Extraction activity</div>
                            </div>
                            <BrainCircuit size={22} color="#7190ff" />
                        </div>

                        <WaveAnimation active={isRecording || isBusy} color={isRecording ? (dark ? '#fb7185' : '#ff97b4') : (dark ? '#60a5fa' : '#84a2ff')} />

                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', color: dark ? 'rgba(226,232,240,0.74)' : '#50627f', fontSize: '0.9rem' }}>
                                <span>Charging mode</span>
                                <strong style={{ color: voiceAiChargingEnabled ? '#1f7a5e' : '#8b5f32' }}>
                                    {voiceAiChargingEnabled ? 'Enabled' : 'Manual extract'}
                                </strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', color: dark ? 'rgba(226,232,240,0.74)' : '#50627f', fontSize: '0.9rem' }}>
                                <span>Pending queue</span>
                                <strong style={{ color: '#273955' }}>{pendingLabel}</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.82rem', color: dark ? 'rgba(226,232,240,0.64)' : '#71839d', lineHeight: 1.6 }}>
                                <AudioLines size={16} />
                                Raw transcript is saved first, then Qwen can extract in-app or later in the background while charging when the local model is available.
                            </div>
                        </div>
                    </div>
                </section>

                {(phase === 'transcribing' || phase === 'summarizing') && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            padding: '1rem 1.1rem',
                            borderRadius: '1.5rem',
                            background: softCard,
                            border: dark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(255,255,255,0.58)',
                            boxShadow: dark ? '0 16px 40px rgba(2, 6, 23, 0.24)' : '0 16px 40px rgba(84, 101, 161, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.8rem',
                            color: dark ? 'rgba(226,232,240,0.76)' : '#556884',
                        }}
                    >
                        <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.15, repeat: Infinity, ease: 'linear' }}
                            style={{
                                width: '1.1rem',
                                height: '1.1rem',
                                borderRadius: '999px',
                                border: '2px solid rgba(123, 149, 255, 0.2)',
                                borderTopColor: '#7b95ff',
                                flexShrink: 0,
                            }}
                        />
                        {phase === 'transcribing' ? 'Turning speech into text...' : 'Generating summary...'}
                    </motion.section>
                )}

                <section ref={listAnchorRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', paddingBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: dark ? '#f8fafc' : '#233451' }}>Recent voice notes</h2>
                            <p style={{ margin: '0.3rem 0 0 0', color: dark ? 'rgba(226,232,240,0.68)' : '#6a7b96', fontSize: '0.92rem' }}>
                                Tap any card to open the full transcript and summary.
                            </p>
                        </div>
                    </div>

                    <NotesList
                        notes={notes}
                        loading={loading}
                        onOpen={setActiveNote}
                        dark={dark}
                        onExtractNow={(noteId) => {
                            setPhase('summarizing');
                            void extractNoteNow(noteId);
                        }}
                    />
                </section>
            </div>

            <NoteModal
                note={activeNote}
                onClose={() => setActiveNote(null)}
                onExtractNow={(noteId) => {
                    setPhase('summarizing');
                    void extractNoteNow(noteId);
                }}
            />
        </div>
    );
};

