import React, { createContext, useContext, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { App as CapacitorApp } from '@capacitor/app';

interface TimeContextType {
    now: Date;
    dateKey: string;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export const TimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            const nextNow = new Date();
            // Optional: Only update if minute changes to avoid too many renders
            if (nextNow.getMinutes() !== now.getMinutes() || nextNow.getDate() !== now.getDate()) {
                setNow(nextNow);
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [now]);

    const dateKey = format(now, 'yyyy-MM-dd');

    useEffect(() => {
        // Trigger widget sync when the day actually changes
        // This ensures the native widget clearing logic runs
        import('../lib/storage').then(({ storage }) => {
            storage.triggerWidgetSync().catch(err => console.error('Day change sync failed', err));
        });
    }, [dateKey]);

    useEffect(() => {
        // Force time refresh when app gains focus
        const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                setNow(new Date());
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, []);

    return (
        <TimeContext.Provider value={{ now, dateKey }}>
            {children}
        </TimeContext.Provider>
    );
};

export const useCurrentTime = () => {
    const context = useContext(TimeContext);
    if (!context) throw new Error('useCurrentTime must be used within TimeProvider');
    return context;
};
