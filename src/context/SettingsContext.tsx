import React, { createContext, useContext, useState } from 'react';

interface SettingsContextType {
    dashboardBg: string | null;
    journalBg: string | null;
    tasksBg: string | null;
    tomorrowBg: string | null;
    customWallpapers: string[];

    // Theme-specific settings
    bgDarknessLight: number;
    bgDarknessDark: number;
    bgBlurLight: number;
    bgBlurDark: number;

    setDashboardBg: (url: string | null) => void;
    setJournalBg: (url: string | null) => void;
    setTasksBg: (url: string | null) => void;
    setTomorrowBg: (url: string | null) => void;
    addCustomWallpaper: (url: string) => void;
    removeCustomWallpaper: (index: number) => void;

    setBgDarknessLight: (value: number) => void;
    setBgDarknessDark: (value: number) => void;
    setBgBlurLight: (value: number) => void;
    setBgBlurDark: (value: number) => void;

    isBiometricEnabled: boolean;
    setBiometricEnabled: (enabled: boolean) => void;
    isAutoBiometricOn: boolean;
    setAutoBiometricOn: (enabled: boolean) => void;
    skipLoginPage: boolean;
    setSkipLoginPage: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dashboardBg, setDashboardBgState] = useState<string | null>(() => {
        return localStorage.getItem('trunotes-dashboard-bg');
    });

    const [journalBg, setJournalBgState] = useState<string | null>(() => {
        return localStorage.getItem('trunotes-journal-bg');
    });

    const [tasksBg, setTasksBgState] = useState<string | null>(() => {
        return localStorage.getItem('trunotes-tasks-bg');
    });

    const [tomorrowBg, setTomorrowBgState] = useState<string | null>(() => {
        return localStorage.getItem('trunotes-tomorrow-bg');
    });

    const [customWallpapers, setCustomWallpapers] = useState<string[]>(() => {
        const saved = localStorage.getItem('trunotes-custom-wallpapers');
        return saved ? JSON.parse(saved) : [];
    });

    // --- DARKNESS ---
    const [bgDarknessLight, setBgDarknessLightState] = useState<number>(() => {
        const saved = localStorage.getItem('trunotes-bg-darkness-light');
        if (saved) return parseFloat(saved);
        // Migration/Default
        const old = localStorage.getItem('trunotes-bg-darkness');
        return old ? parseFloat(old) : 0.2; // Default light mode is cleaner
    });

    const [bgDarknessDark, setBgDarknessDarkState] = useState<number>(() => {
        const saved = localStorage.getItem('trunotes-bg-darkness-dark');
        if (saved) return parseFloat(saved);
        // Migration/Default
        const old = localStorage.getItem('trunotes-bg-darkness');
        return old ? parseFloat(old) : 0.5; // Default dark mode is deeper
    });

    // --- BLUR ---
    const [bgBlurLight, setBgBlurLightState] = useState<number>(() => {
        const saved = localStorage.getItem('trunotes-bg-blur-light');
        if (saved) return parseFloat(saved);
        // Migration/Default
        const old = localStorage.getItem('trunotes-bg-blur');
        return old ? parseFloat(old) : 8;
    });

    const [bgBlurDark, setBgBlurDarkState] = useState<number>(() => {
        const saved = localStorage.getItem('trunotes-bg-blur-dark');
        if (saved) return parseFloat(saved);
        // Migration/Default
        const old = localStorage.getItem('trunotes-bg-blur');
        return old ? parseFloat(old) : 12;
    });

    const [isBiometricEnabled, setBiometricEnabledState] = useState<boolean>(() => {
        const saved = localStorage.getItem('trunotes-biometric-enabled');
        return saved === null ? true : saved === 'true';
    });

    const [isAutoBiometricOn, setAutoBiometricOnState] = useState<boolean>(() => {
        const saved = localStorage.getItem('trunotes-auto-biometric');
        return saved === 'true'; // Default is false
    });

    const [skipLoginPage, setSkipLoginPageState] = useState<boolean>(() => {
        const saved = localStorage.getItem('trunotes-skip-login');
        return saved === 'true';
    });

    const setDashboardBg = (url: string | null) => {
        setDashboardBgState(url);
        if (url) localStorage.setItem('trunotes-dashboard-bg', url);
        else localStorage.removeItem('trunotes-dashboard-bg');
    };

    const setJournalBg = (url: string | null) => {
        setJournalBgState(url);
        if (url) localStorage.setItem('trunotes-journal-bg', url);
        else localStorage.removeItem('trunotes-journal-bg');
    };

    const setTasksBg = (url: string | null) => {
        setTasksBgState(url);
        if (url) localStorage.setItem('trunotes-tasks-bg', url);
        else localStorage.removeItem('trunotes-tasks-bg');
    };

    const setTomorrowBg = (url: string | null) => {
        setTomorrowBgState(url);
        if (url) localStorage.setItem('trunotes-tomorrow-bg', url);
        else localStorage.removeItem('trunotes-tomorrow-bg');
    };

    const setBgDarknessLight = (value: number) => {
        setBgDarknessLightState(value);
        localStorage.setItem('trunotes-bg-darkness-light', value.toString());
    };

    const setBgDarknessDark = (value: number) => {
        setBgDarknessDarkState(value);
        localStorage.setItem('trunotes-bg-darkness-dark', value.toString());
    };

    const setBgBlurLight = (value: number) => {
        setBgBlurLightState(value);
        localStorage.setItem('trunotes-bg-blur-light', value.toString());
    };

    const setBgBlurDark = (value: number) => {
        setBgBlurDarkState(value);
        localStorage.setItem('trunotes-bg-blur-dark', value.toString());
    };

    const setBiometricEnabled = (enabled: boolean) => {
        setBiometricEnabledState(enabled);
        localStorage.setItem('trunotes-biometric-enabled', enabled.toString());
    };

    const setAutoBiometricOn = (enabled: boolean) => {
        setAutoBiometricOnState(enabled);
        localStorage.setItem('trunotes-auto-biometric', enabled.toString());
    };

    const setSkipLoginPage = (enabled: boolean) => {
        setSkipLoginPageState(enabled);
        localStorage.setItem('trunotes-skip-login', enabled.toString());
    };

    const addCustomWallpaper = (url: string) => {
        const newWallpapers = [...customWallpapers, url];
        setCustomWallpapers(newWallpapers);
        localStorage.setItem('trunotes-custom-wallpapers', JSON.stringify(newWallpapers));
    };

    const removeCustomWallpaper = (index: number) => {
        const newWallpapers = customWallpapers.filter((_, i) => i !== index);
        setCustomWallpapers(newWallpapers);
        localStorage.setItem('trunotes-custom-wallpapers', JSON.stringify(newWallpapers));
    };

    return (
        <SettingsContext.Provider value={{
            dashboardBg,
            journalBg,
            tasksBg,
            tomorrowBg,
            customWallpapers,
            bgDarknessLight,
            bgDarknessDark,
            bgBlurLight,
            bgBlurDark,
            setDashboardBg,
            setJournalBg,
            setTasksBg,
            setTomorrowBg,
            addCustomWallpaper,
            removeCustomWallpaper,
            setBgDarknessLight,
            setBgDarknessDark,
            setBgBlurLight,
            setBgBlurDark,
            isBiometricEnabled,
            setBiometricEnabled,
            isAutoBiometricOn,
            setAutoBiometricOn,
            skipLoginPage,
            setSkipLoginPage
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
