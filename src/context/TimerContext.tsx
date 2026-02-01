import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

interface TimerContextType {
    timeLeft: number;
    duration: number;
    isActive: boolean;
    mode: 'focus' | 'short' | 'long' | 'custom';
    taskName: string;
    setTaskName: (name: string) => void;
    toggleTimer: () => void;
    resetTimer: () => void;
    setTimerMode: (mode: 'focus' | 'short' | 'long' | 'custom') => void;
    setCustomDuration: (minutes: number) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [duration, setDuration] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'focus' | 'short' | 'long' | 'custom'>('focus');
    const [taskName, setTaskName] = useState('Focus');

    const intervalRef = useRef<any>(null);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Optional: Play sound or notification here
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, timeLeft]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(duration);
    };

    const setTimerMode = (newMode: 'focus' | 'short' | 'long' | 'custom') => {
        setMode(newMode);
        setIsActive(false);

        if (newMode === 'focus') { setDuration(25 * 60); setTimeLeft(25 * 60); }
        if (newMode === 'short') { setDuration(5 * 60); setTimeLeft(5 * 60); }
        if (newMode === 'long') { setDuration(15 * 60); setTimeLeft(15 * 60); }
        // Custom mode doesn't reset time immediately, handled by setCustomDuration
    };

    const setCustomDuration = (minutes: number) => {
        setDuration(minutes * 60);
        setTimeLeft(minutes * 60);
    };

    return (
        <TimerContext.Provider value={{
            timeLeft,
            duration,
            isActive,
            mode,
            taskName,
            setTaskName,
            toggleTimer,
            resetTimer,
            setTimerMode,
            setCustomDuration
        }}>
            {children}
        </TimerContext.Provider>
    );
};

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
};
