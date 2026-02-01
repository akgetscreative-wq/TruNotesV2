
import React, { useState, useEffect } from 'react';
import { googleDriveService, type GoogleTokens } from './googleDrive';
import { Cloud, Loader2, Check, AlertCircle } from 'lucide-react';

export const SyncSettings: React.FC = () => {
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [redirectUri, setRedirectUri] = useState('http://localhost');
    const [authCode, setAuthCode] = useState('');
    const [tokens, setTokens] = useState<GoogleTokens | null>(null);
    const [status, setStatus] = useState<string>('idle');
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(false);
    const [isRealTime, setIsRealTime] = useState<boolean>(false);

    useEffect(() => {
        // Load settings
        setClientId(localStorage.getItem('google_client_id') || '');
        setClientSecret(localStorage.getItem('google_client_secret') || '');
        setRedirectUri(localStorage.getItem('google_redirect_uri') || 'http://localhost');
        setRedirectUri(localStorage.getItem('google_redirect_uri') || 'http://localhost');
        setIsSyncEnabled(localStorage.getItem('trunotes_sync_enabled') === 'true');
        setIsRealTime(localStorage.getItem('trunotes_realtime_sync') === 'true');

        const storedTokens = localStorage.getItem('google_tokens');
        const storedCid = localStorage.getItem('google_client_id');
        const storedSec = localStorage.getItem('google_client_secret');

        if (storedTokens && storedCid && storedSec) {
            setTokens(JSON.parse(storedTokens));
            setLastSync(localStorage.getItem('last_sync_time'));
        }
    }, []);

    const saveCredentials = () => {
        localStorage.setItem('google_client_id', clientId);
        localStorage.setItem('google_client_secret', clientSecret);
        localStorage.setItem('google_redirect_uri', redirectUri);
        setStatus('Credentials saved. Ready to login.');
    };

    const handleLogin = async () => {
        if (!clientId) {
            alert("Please enter Client ID first.");
            return;
        }
        // Redirect URI must match Console exactly
        const url = googleDriveService.getAuthUrl(clientId, redirectUri);

        if ((window as any).electron?.openExternal) {
            // Electron
            (window as any).electron.openExternal(url);
        } else {
            // Browser or Capacitor
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url });
        }

        setStatus('waiting_for_code');
    };


    const handleVerifyCode = async () => {
        if (!authCode || !clientId || !clientSecret) return;
        try {
            setStatus('verifying');
            // Clean code (remove 'code=' prefix if user accidentally included it)
            let cleanedCode = authCode.trim();
            if (cleanedCode.includes('code=')) {
                cleanedCode = new URLSearchParams(cleanedCode.split('?')[1] || cleanedCode).get('code') || cleanedCode;
            }

            const data = await googleDriveService.getToken(clientId, clientSecret, cleanedCode, redirectUri);
            setTokens(data);

            // CRITICAL: Ensure raw credentials are saved too, in case user skipped "Save Keys"
            localStorage.setItem('google_client_id', clientId);
            localStorage.setItem('google_client_secret', clientSecret);
            localStorage.setItem('google_redirect_uri', redirectUri);

            localStorage.setItem('google_tokens', JSON.stringify(data));
            localStorage.setItem('trunotes_sync_enabled', 'true');
            setIsSyncEnabled(true);
            if ((window as any).notifySyncPrefsChanged) {
                (window as any).notifySyncPrefsChanged();
            }
            setStatus('logged_in');
        } catch (e: any) {
            console.error(e);
            setStatus('error: ' + e.message);
        }
    };

    const handleSmartSync = async () => {
        if (!tokens || !isSyncEnabled) return;
        try {
            setStatus('backing_up');
            if ((window as any).triggerSync) {
                await (window as any).triggerSync();
            }
            setStatus('backup_success');
            setLastSync(new Date().toLocaleString());
            setTimeout(() => setStatus('logged_in'), 3000);
        } catch (e: any) {
            setStatus('error: ' + e.message);
        }
    };

    const handleManualUpload = async () => {
        if (!tokens || !isSyncEnabled) return;
        try {
            setStatus('backing_up');
            if ((window as any).triggerUpload) {
                await (window as any).triggerUpload();
            }
            setStatus('backup_success');
            setLastSync(new Date().toLocaleString());
            setTimeout(() => setStatus('logged_in'), 3000);
        } catch (e: any) {
            setStatus('error: ' + e.message);
        }
    };

    const handleManualDownload = async () => {
        if (!tokens || !isSyncEnabled) return;
        try {
            setStatus('restoring');
            if ((window as any).triggerDownload) {
                await (window as any).triggerDownload();
            }
            setStatus('restore_success');
            setLastSync(new Date().toLocaleString());
            setTimeout(() => setStatus('logged_in'), 3000);
        } catch (e: any) {
            setStatus('error: ' + e.message);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', color: 'var(--text-primary)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Cloud /> Google Drive Sync
            </h2>

            {!tokens ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        To sync, you need your own Google Cloud Client ID/Secret.
                        Enable the <b>Google Drive API</b> in your console.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Client ID</label>
                        <input
                            value={clientId} onChange={e => setClientId(e.target.value)}
                            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white' }}
                            placeholder="xxx.apps.googleusercontent.com"
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Client Secret</label>
                        <input
                            value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password"
                            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Redirect URI <span style={{ fontSize: '0.8em', opacity: 0.7 }}>(Must match Google Console EXACTLY)</span></label>
                        <input
                            value={redirectUri} onChange={e => setRedirectUri(e.target.value)}
                            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white font-mono' }}
                        />
                    </div>

                    {status === 'waiting_for_code' ? (
                        <div style={{ animation: 'fadeIn 0.5s' }}>
                            <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                A browser window opened. Login. If you see a "redirect_uri_mismatch" error, verify the URI above matches your console.<br />
                                If you see "Connection Refused", copy the <code>code=...</code> from the address bar and paste it below.
                            </p>
                            <input
                                value={authCode} onChange={e => setAuthCode(e.target.value)}
                                placeholder="Paste your code here"
                                style={{ width: '100%', padding: '0.8rem', background: '#333', color: 'white', border: '1px solid #555' }}
                            />
                            <button onClick={handleVerifyCode} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                Verify & Connect
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={saveCredentials} style={{ padding: '0.5rem 1rem', background: '#4b5563', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                Save Keys
                            </button>
                            <button onClick={handleLogin} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                Log In
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(0,255,0,0.1)', border: '1px solid rgba(0,255,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Check color="#22c55e" />
                        <div>
                            <strong>Connected to Google Drive</strong>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Last Sync: {lastSync || 'Never'}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: isSyncEnabled ? 1 : 0.5, pointerEvents: isSyncEnabled ? 'auto' : 'none', filter: isSyncEnabled ? 'none' : 'grayscale(100%)' }}>
                        <button
                            onClick={handleSmartSync}
                            disabled={status.includes('backing') || status.includes('restoring')}
                            style={{
                                width: '100%', padding: '1rem', background: 'var(--accent-primary)',
                                border: 'none', borderRadius: '12px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '0.75rem', color: 'white', fontWeight: 700,
                                boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)'
                            }}
                        >
                            {status === 'backing_up' || status === 'restoring' ? <Loader2 className="animate-spin" size={20} /> : <Cloud size={20} />}
                            Full Smart Sync
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                onClick={handleManualUpload}
                                disabled={status.includes('backing') || status.includes('restoring')}
                                style={{
                                    padding: '0.8rem', background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem'
                                }}
                            >
                                <Cloud size={16} /> Force Upload
                            </button>
                            <button
                                onClick={handleManualDownload}
                                disabled={status.includes('backing') || status.includes('restoring')}
                                style={{
                                    padding: '0.8rem', background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem'
                                }}
                            >
                                <Cloud size={16} style={{ transform: 'rotate(180deg)' }} /> Force Download
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1, marginRight: '1rem' }}>
                            <strong style={{ fontSize: '1rem' }}>Enable Cloud Sync</strong>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>Turn off to stop all cloud communications. Data remains locally.</p>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isSyncEnabled}
                                onChange={(e) => {
                                    const val = e.target.checked;
                                    setIsSyncEnabled(val);
                                    localStorage.setItem('trunotes_sync_enabled', val.toString());
                                    if ((window as any).notifySyncPrefsChanged) {
                                        (window as any).notifySyncPrefsChanged();
                                    }
                                }}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isSyncEnabled ? 1 : 0.5, pointerEvents: isSyncEnabled ? 'auto' : 'none' }}>
                        <div style={{ flex: 1, marginRight: '1rem' }}>
                            <strong style={{ fontSize: '1rem' }}>Real-time Background Sync</strong>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>
                                Automatically uploads changes after 3s. Performs full merged sync every 15s when online.
                            </p>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isRealTime}
                                onChange={(e) => {
                                    const val = e.target.checked;
                                    setIsRealTime(val);
                                    localStorage.setItem('trunotes_realtime_sync', val.toString());
                                    // Trigger manager to reload prefs
                                    if ((window as any).notifySyncPrefsChanged) {
                                        (window as any).notifySyncPrefsChanged();
                                    }
                                }}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>
            )
            }

            {
                status.startsWith('error') && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(255,0,0,0.1)', color: '#ef4444', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} /> {status}
                    </div>
                )
            }
            {
                status === 'backup_success' && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(0,255,0,0.1)', color: '#22c55e', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} /> Operation successful!
                    </div>
                )
            }
            {
                status === 'restore_success' && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(0,255,0,0.1)', color: '#22c55e', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} /> Cloud data merged!
                    </div>
                )
            }
        </div >
    );
};
