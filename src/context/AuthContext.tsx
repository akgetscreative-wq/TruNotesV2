import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    isRegistered: boolean;
    register: (u: string, p: string) => void;
    login: (u: string, p: string) => boolean;
    resetCredentials: (u: string, p: string) => void;
    logout: () => void;
    biometricLogin: () => void;
    username: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userData, setUserData] = useState<{ username: string } | null>(null);

    useEffect(() => {
        // 1. Check if user is registered
        const storedCreds = localStorage.getItem('trunotes_creds');
        if (storedCreds) {
            setIsRegistered(true);
            const { username } = JSON.parse(storedCreds);
            setUserData({ username });
        }

        // 2. Check session storage for existing session
        const sessionAuth = sessionStorage.getItem('trunotes_auth');
        const skipLogin = localStorage.getItem('trunotes-skip-login') === 'true';

        if (sessionAuth === 'true' || (skipLogin && storedCreds)) {
            setIsAuthenticated(true);
        }

        setIsLoading(false);
    }, []);

    const register = (username: string, password: string) => {
        const creds = { username, password }; // In production, hash this!
        localStorage.setItem('trunotes_creds', JSON.stringify(creds));
        setIsRegistered(true);
        setUserData({ username });

        // Auto login on register
        setIsAuthenticated(true);
        sessionStorage.setItem('trunotes_auth', 'true');
    };

    const resetCredentials = (username: string, password: string) => {
        const creds = { username, password };
        localStorage.setItem('trunotes_creds', JSON.stringify(creds));
        setIsRegistered(true);
        setUserData({ username });

        // Don't auto-login here necessarily, or do? 
        // Let's auto-login for smoother UX after reset
        setIsAuthenticated(true);
        sessionStorage.setItem('trunotes_auth', 'true');
    };

    const login = (username: string, password: string) => {
        const stored = localStorage.getItem('trunotes_creds');
        if (!stored) return false;

        const { username: validUser, password: validPassword } = JSON.parse(stored);

        if (username === validUser && password === validPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem('trunotes_auth', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('trunotes_auth');
    };

    const biometricLogin = () => {
        setIsAuthenticated(true);
        sessionStorage.setItem('trunotes_auth', 'true');
    };

    if (isLoading) {
        return null;
    }

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isRegistered,
            register,
            login,
            resetCredentials,
            logout,
            biometricLogin,
            username: userData?.username || null
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
