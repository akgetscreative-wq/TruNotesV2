import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, ArrowRight, User, Cloud, Fingerprint, ShieldCheck, AlertCircle } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { googleDriveService } from '../Sync/googleDrive';
import { storage } from '../../lib/storage';
import { useSettings } from '../../context/SettingsContext';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import { showToast } from '../../App';

export const LoginPage: React.FC = () => {
    const { login, register, isRegistered, username, biometricLogin } = useAuth();
    const { isAutoBiometricOn } = useSettings();
    const { theme } = useThemeContext();

    const isDesktop = (window as any).electron || navigator.userAgent.includes('Electron');

    const [mode, setMode] = useState<'auth' | 'recovery' | 'reset'>('auth');
    const [inputUsername, setInputUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [recoveryStatus, setRecoveryStatus] = useState<string>('idle');

    const [error, setError] = useState<string | null>(null);
    const [shake, setShake] = useState(false);

    // Status for visual feedback
    const [biometricStatus, setBiometricStatus] = useState<'idle' | 'checking' | 'prompting' | 'failed'>('idle');
    const isEntering = useRef(false);

    const isBiometricRunning = useRef(false);
    const autoAttempted = useRef(false);
    const lastAutoTriggerTime = useRef(0);

    const handleBiometric = async (isManual: boolean = false) => {
        if (isBiometricRunning.current || isEntering.current) return;

        try {
            isBiometricRunning.current = true;
            setBiometricStatus('checking');
            console.log("LoginPage: handleBiometric start, manual=" + isManual);

            // Start biometric prompt immediately

            // 1. Check if hardware is ready 
            let hardwareAvailable = false;
            try {
                const result = await NativeBiometric.isAvailable();
                hardwareAvailable = result.isAvailable;
            } catch (e) {
                console.warn("LoginPage: Hardware check failed.");
            }

            // CRITICAL: We bypass hardwareAvailable check for the FIRST auto-trigger 
            // because the sensor service often takes a moment to initialize on Android 
            // after the app starts, but the verification call can still succeed.
            if (hardwareAvailable || isManual || biometricStatus === 'idle') {
                setBiometricStatus('prompting');

                await NativeBiometric.verifyIdentity({
                    reason: "Unlock TruNotes",
                    title: "Security Verification",
                    subtitle: "Log in with Biometrics",
                    description: "Verify your identity to unlock your notes",
                });

                console.log("LoginPage: Biometric Success!");
                isEntering.current = true;
                showToast("Identity verified!", "success");
                biometricLogin();
            } else {
                console.warn("LoginPage: Biometric hardware reported unavailable.");
                setBiometricStatus('failed');
                if (isManual) {
                    showToast("Biometric sensor not ready. Try again in a second.", "error");
                }
            }
        } catch (e: any) {
            console.error("LoginPage: Biometric Error:", e);
            setBiometricStatus('failed');
            const msg = (e.message || "").toLowerCase();
            if (isManual && !msg.includes('cancel') && !msg.includes('user exit')) {
                showToast("Verification failed: " + (e.message || "Unknown error"), "error");
            }
        } finally {
            isBiometricRunning.current = false;
        }
    };

    useEffect(() => {
        let listener: PluginListenerHandle | null = null;

        const init = async () => {
            listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                const now = Date.now();
                // Safety: Prevent auto-triggers if we're currently failing or prompting
                // and enforce a 2s cooldown
                const isCoolEnough = now - lastAutoTriggerTime.current > 2000;

                // CRITICAL: We only auto-trigger if status is 'idle'. 
                // If it's 'failed', we STAY in the failed overlay so the user can choose 'Use Password'.
                setBiometricStatus(prev => {
                    if (isActive && isRegistered && isAutoBiometricOn && !isDesktop && isCoolEnough && prev === 'idle') {
                        console.log("LoginPage: App resumed, triggering auto-biometrics...");
                        lastAutoTriggerTime.current = now;
                        handleBiometric(false);
                    }
                    return prev;
                });
            });
        };

        if (!isDesktop) init();
        return () => { if (listener) listener.remove(); };
    }, [isRegistered, isAutoBiometricOn, isDesktop]);

    // Handle initial login trigger separately for cleaner cleanup and reliability
    useEffect(() => {
        if (isRegistered && isAutoBiometricOn && !autoAttempted.current && !isDesktop) {
            autoAttempted.current = true;
            console.log("LoginPage: Scheduling auto-biometric trigger...");

            // If skip login is on, trigger almost immediately
            const delay = 300;
            const timer = setTimeout(() => {
                lastAutoTriggerTime.current = Date.now();
                handleBiometric(false);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isRegistered, isAutoBiometricOn, isDesktop]);

    useEffect(() => {
        setClientId(localStorage.getItem('google_client_id') || '');
        setClientSecret(localStorage.getItem('google_client_secret') || '');
    }, []);

    const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (isRegistered) {
            // If registered, use either the input username OR the stored one
            const effectiveUsername = inputUsername || username || '';
            if (!login(effectiveUsername, password)) { setError('Incorrect credentials'); triggerShake(); }
        } else {
            if (!inputUsername || !password) { setError('All fields required'); triggerShake(); return; }
            if (password !== confirmPassword) { setError('Passwords mismatch'); triggerShake(); return; }
            register(inputUsername, password);
        }
    };

    const handleGoogleLogin = async () => {
        if (!clientId) { setError("Client ID required"); return; }
        try {
            const url = googleDriveService.getAuthUrl(clientId, 'http://localhost');
            await Browser.open({ url });
            setRecoveryStatus('waiting_code');
        } catch (e: any) { showToast("Browser failed: " + e.message, "error"); }
    };

    const handleRecoveryVerify = async () => {
        if (!authCode) return;
        try {
            setRecoveryStatus('verifying');
            const tokens = await googleDriveService.getToken(clientId, clientSecret, authCode, 'http://localhost');
            setRecoveryStatus('restoring');
            const file = await googleDriveService.findBackupFile(tokens.access_token);
            if (!file) throw new Error("No backup found");
            const data = await googleDriveService.downloadBackup(tokens.access_token, file.id);
            await storage.importDatabase(data);
            setRecoveryStatus('success');
            setTimeout(() => { setMode('reset'); setError(null); }, 1000);
        } catch (e: any) { setRecoveryStatus('idle'); setError(e.message || "Failed"); triggerShake(); }
    };

    const isDark = theme === 'dark';

    return (
        <div style={{
            height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)'
        }}>
            {/* Ambient Background */}
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px', background: 'var(--accent-primary)', opacity: 0.1, filter: 'blur(100px)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '600px', height: '600px', background: '#ec4899', opacity: 0.1, filter: 'blur(100px)', borderRadius: '50%' }} />

            <motion.div
                animate={{ x: shake ? [0, -10, 10, -10, 10, 0] : 0 }}
                className="glass-panel"
                style={{
                    width: '90%', maxWidth: '420px', padding: '3rem 2rem', borderRadius: '32px',
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(20px)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-3d)',
                    zIndex: 10, position: 'relative'
                }}
            >
                {/* --- Biometric Overlay if Prompting --- */}
                <AnimatePresence>
                    {(biometricStatus === 'prompting' || (isAutoBiometricOn && isRegistered && !isDesktop && biometricStatus !== 'idle')) && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute', inset: 0, borderRadius: '32px', zIndex: 100,
                                background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255,255,255,0.98)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
                                pointerEvents: 'auto'
                            }}
                        >
                            <div className="pulse" style={{ width: '80px', height: '80px', borderRadius: '50%', background: biometricStatus === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {biometricStatus === 'failed' ? <AlertCircle size={40} color="#ef4444" /> : <ShieldCheck size={40} color="var(--accent-primary)" />}
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{biometricStatus === 'failed' ? 'Verification Failed' : 'Biometric Lock'}</h2>
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '0 2rem' }}>
                                {biometricStatus === 'failed' ? 'Could not verify your identity. Please try again or use your password.' : 'Please verify your identity using the system prompt.'}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', width: '100%', alignItems: 'center' }}>
                                {biometricStatus === 'failed' && (
                                    <button
                                        onClick={() => handleBiometric(true)}
                                        style={{
                                            background: 'var(--accent-primary)', color: 'white', border: 'none',
                                            padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >
                                        Try Again
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        autoAttempted.current = true;
                                        setBiometricStatus('idle');
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Use Password Instead
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <img
                        src="logo.png"
                        alt="TruNotes"
                        style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'contain', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    />

                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{isRegistered ? (username ? `Welcome, ${username}` : 'Welcome Back') : 'Get Started'}</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Securely access your personal brain.</p>
                    </div>

                    <form onSubmit={handleAuthSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {!isRegistered ? (
                            <div style={{ position: 'relative' }}>
                                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '1.1rem' }} />
                                <input type="text" placeholder="Username" value={inputUsername} onChange={e => setInputUsername(e.target.value)} style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '14px', border: '2px solid var(--border-subtle)', background: isDark ? '#0f172a' : '#ffffff', color: 'var(--text-primary)' }} />
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Logging in as <strong style={{ color: 'var(--text-primary)' }}>{username}</strong></p>
                                <button type="button" onClick={() => { localStorage.removeItem('trunotes_creds'); window.location.reload(); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.25rem' }}>Not you?</button>
                            </div>
                        )}
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '1.1rem' }} />
                            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus={isRegistered} style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '14px', border: '2px solid var(--border-subtle)', background: isDark ? '#0f172a' : '#ffffff', color: 'var(--text-primary)' }} />
                        </div>
                        {!isRegistered && (
                            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid var(--border-subtle)', background: isDark ? '#0f172a' : '#ffffff', color: 'var(--text-primary)' }} />
                        )}

                        {error && <div style={{ color: '#ef4444', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

                        <button type="submit" style={{ width: '100%', padding: '1.1rem', borderRadius: '14px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            {isRegistered ? 'Unlock' : 'Create Account'} <ArrowRight size={20} />
                        </button>

                        {!isDesktop && (
                            <button type="button" onClick={() => handleBiometric(true)} style={{ width: '100%', padding: '1.1rem', borderRadius: '14px', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, border: '2px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Fingerprint size={20} /> Biometric Unlock
                            </button>
                        )}
                    </form>

                    {isRegistered && (
                        <button onClick={() => setMode('recovery')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.9rem', cursor: 'pointer' }}>Trouble signing in?</button>
                    )}
                </div>

                {/* --- Recovery Mode Drawer/Popup --- */}
                <AnimatePresence>
                    {mode === 'recovery' && (
                        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'absolute', inset: 0, background: 'var(--bg-primary)', borderRadius: '32px', zIndex: 100, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Cloud size={24} color="var(--accent-primary)" /><h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Recovery</h2></div>
                            <input type="text" placeholder="Client ID" value={clientId} onChange={e => setClientId(e.target.value)} style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }} />
                            <input type="password" placeholder="Client Secret" value={clientSecret} onChange={e => setClientSecret(e.target.value)} style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }} />
                            <button onClick={handleGoogleLogin} style={{ padding: '1rem', borderRadius: '14px', background: '#db4437', color: 'white', fontWeight: 600, border: 'none' }}>Authenticate with Google</button>
                            {recoveryStatus !== 'idle' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <input type="text" placeholder="Paste Auth Code" value={authCode} onChange={e => setAuthCode(e.target.value)} style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }} />
                                    <button onClick={handleRecoveryVerify} style={{ padding: '1rem', borderRadius: '14px', background: 'var(--accent-primary)', color: 'white', fontWeight: 600, border: 'none' }}>Verify & Restore</button>
                                </div>
                            )}
                            <button onClick={() => setMode('auth')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', marginTop: 'auto' }}>Go Back</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
