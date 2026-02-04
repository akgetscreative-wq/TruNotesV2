import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Home, Monitor, Book, User, Shield, Moon, Sun, Database, AlertTriangle, CheckSquare, Coffee, Fingerprint, Info, Heart } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useThemeContext } from '../../context/ThemeContext';

export const SettingsView: React.FC = () => {
    const {
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
        isAutoBiometricOn,
        setAutoBiometricOn,
        skipLoginPage,
        setSkipLoginPage
    } = useSettings();

    const { username, resetCredentials, logout } = useAuth();
    const { theme, toggleTheme } = useThemeContext();

    const isDesktop = (window as any).electron || navigator.userAgent.includes('Electron');

    const dashboardInputRef = useRef<HTMLInputElement>(null);
    const journalInputRef = useRef<HTMLInputElement>(null);
    const tasksInputRef = useRef<HTMLInputElement>(null);
    const tomorrowInputRef = useRef<HTMLInputElement>(null);
    const wallpaperInputRef = useRef<HTMLInputElement>(null);

    // Password Change State
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    const [biometricAvailable, setBiometricAvailable] = useState(false);

    React.useEffect(() => {
        const checkBiometric = async () => {
            try {
                const result = await NativeBiometric.isAvailable();
                setBiometricAvailable(result.isAvailable);
            } catch (e) {
                setBiometricAvailable(false);
            }
        };
        checkBiometric();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'dashboard' | 'journal' | 'tasks' | 'tomorrow' | 'wallpaper') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const url = event.target?.result as string;
            if (type === 'dashboard') {
                setDashboardBg(url);
            } else if (type === 'journal') {
                setJournalBg(url);
            } else if (type === 'tasks') {
                setTasksBg(url);
            } else if (type === 'tomorrow') {
                setTomorrowBg(url);
            } else {
                addCustomWallpaper(url);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleChangePassword = () => {
        setPasswordError('');
        setPasswordSuccess('');

        // 1. Verify Old Password
        const stored = localStorage.getItem('trunotes_creds');
        if (!stored) {
            setPasswordError('System error: No credentials found.');
            return;
        }

        const { password: validPassword } = JSON.parse(stored);
        if (oldPassword !== validPassword) {
            setPasswordError('Incorrect current password.');
            return;
        }

        // 2. Validate New Password
        if (newPassword.length < 4) {
            setPasswordError('New password must be at least 4 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }

        // 3. Update Credentials
        if (username) {
            resetCredentials(username, newPassword);
            setPasswordSuccess('Password updated successfully!');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setIsChangingPassword(false);
                setPasswordSuccess('');
            }, 1500);
        }
    };

    const handleClearAllData = () => {
        if (confirm('ARE YOU SURE? This will delete ALL notes, tasks, and settings. This cannot be undone.')) {
            // Keep auth, clear rest
            const creds = localStorage.getItem('trunotes_creds');
            localStorage.clear();
            if (creds) localStorage.setItem('trunotes_creds', creds);
            window.location.reload();
        }
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const sectionStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        padding: isMobile ? '1.5rem' : '2rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '2rem'
    };

    const titleStyle: React.CSSProperties = {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.8rem 1rem',
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        marginBottom: '1rem',
        outline: 'none'
    };

    return (
        <div className="fade-in dashboard-scrollbar" style={{
            padding: isMobile ? '4rem 1rem 2rem 1rem' : '4rem 2rem',
            height: '100%',
            overflowY: 'auto'
        }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--text-primary)' }}>Settings</h1>

            {/* Account Settings */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><User size={24} color="var(--accent-primary)" /> Account</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Signed in as <strong>@{username}</strong>
                </p>

                {!isChangingPassword ? (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setIsChangingPassword(true)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                        >
                            <Shield size={18} /> Change Password
                        </button>
                        <button
                            onClick={logout}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-subtle)',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Log Out
                        </button>
                        <button
                            onClick={() => (window as any).electron ? (window as any).electron.openExternal('https://github.com/akgetscreative-wq/TruNotesV2/releases') : window.open('https://github.com/akgetscreative-wq/TruNotesV2/releases', '_blank')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                        >
                            <Cloud size={18} /> Update
                        </button>
                    </div>
                ) : (
                    <div style={{ maxWidth: '400px', background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: '16px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Change Password</h3>

                        <input
                            type="password"
                            placeholder="Current Password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            style={inputStyle}
                        />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={inputStyle}
                        />
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={inputStyle}
                        />

                        {passwordError && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>{passwordError}</p>}
                        {passwordSuccess && <p style={{ color: '#22c55e', fontSize: '0.9rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>{passwordSuccess}</p>}

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleChangePassword}
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                                    background: 'var(--accent-primary)', color: 'white', border: 'none',
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Update
                            </button>
                            <button
                                onClick={() => { setIsChangingPassword(false); setPasswordError(''); setPasswordSuccess(''); }}
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-subtle)', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Settings - Hidden on Desktop */}
            {!isDesktop && (
                <div style={sectionStyle}>
                    <h2 style={titleStyle}><Shield size={24} color="var(--accent-primary)" /> Security</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: 'rgba(99, 102, 241, 0.1)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Fingerprint size={20} color="var(--accent-primary)" />
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Auto-Biometrics</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    Launch directly into biometrics on app start.
                                </div>
                            </div>
                        </div>

                        {biometricAvailable ? (
                            <button
                                onClick={() => setAutoBiometricOn(!isAutoBiometricOn)}
                                style={{
                                    width: '50px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    background: isAutoBiometricOn ? 'var(--accent-primary)' : 'rgba(0,0,0,0.3)',
                                    position: 'relative',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: isAutoBiometricOn ? '27px' : '3px',
                                    transition: 'left 0.2s ease'
                                }} />
                            </button>
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Not Supported</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: 'rgba(99, 102, 241, 0.1)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Shield size={20} color="var(--accent-primary)" />
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Skip Login Page</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    Launch directly to Dashboard (No Password/Bio).
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSkipLoginPage(!skipLoginPage)}
                            style={{
                                width: '50px',
                                height: '26px',
                                borderRadius: '13px',
                                background: skipLoginPage ? 'var(--accent-primary)' : 'rgba(0,0,0,0.3)',
                                position: 'relative',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0
                            }}
                        >
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'white',
                                position: 'absolute',
                                top: '3px',
                                left: skipLoginPage ? '27px' : '3px',
                                transition: 'left 0.2s ease'
                            }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Cloud Sync Settings */}
            <CloudSyncSection isMobile={isMobile} sectionStyle={sectionStyle} titleStyle={titleStyle} inputStyle={inputStyle} />

            {/* Visuals: Theme & Intensity */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Monitor size={24} color="var(--accent-primary)" /> Appearance</h2>

                {/* Theme Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px', marginBottom: '2rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Theme Mode</span>
                    <button
                        onClick={toggleTheme}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </button>
                </div>

                {/* Darkness / Opacity Settings */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Overlay Opacity
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        Controls background darkness on <strong>Dashboard, Journal, Tasks, and Tomorrow</strong>.
                    </p>

                    {/* Light Mode Opacity */}
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>Light Mode Intensity</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{Math.round(bgDarknessLight * 100)}%</span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={bgDarknessLight}
                            onChange={(e) => setBgDarknessLight(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                    </div>

                    {/* Dark Mode Opacity */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>Dark Mode Intensity</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{Math.round(bgDarknessDark * 100)}%</span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={bgDarknessDark}
                            onChange={(e) => setBgDarknessDark(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#6366f1' }}
                        />
                    </div>
                </div>

                {/* Blur Settings */}
                <div>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Background Blur</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        Controls glass blur effect on <strong>Dashboard, Journal, Tasks, and Tomorrow</strong>.
                    </p>

                    {/* Light Mode Blur */}
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>Light Mode Blur</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{bgBlurLight}px</span>
                        </div>
                        <input
                            type="range" min="0" max="30" step="1"
                            value={bgBlurLight}
                            onChange={(e) => setBgBlurLight(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                    </div>

                    {/* Dark Mode Blur */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>Dark Mode Blur</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{bgBlurDark}px</span>
                        </div>
                        <input
                            type="range" min="0" max="40" step="1"
                            value={bgBlurDark}
                            onChange={(e) => setBgBlurDark(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer', accentColor: '#6366f1' }}
                        />
                    </div>
                </div>
            </div>

            {/* Dashboard Image Setting */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Home size={24} color="var(--accent-primary)" /> Home Background</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Choose a custom background image for your dashboard.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div
                        style={{
                            width: '200px',
                            height: '120px',
                            borderRadius: '16px',
                            background: dashboardBg ? `url(${dashboardBg})` : 'var(--bg-secondary)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '2px dashed var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {!dashboardBg && <ImageIcon size={32} color="var(--text-muted)" />}
                        {dashboardBg && (
                            <button
                                onClick={() => setDashboardBg(null)}
                                style={{
                                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                                    background: 'rgba(239, 68, 68, 0.8)', color: 'white',
                                    border: 'none', borderRadius: '50%', padding: '0.4rem',
                                    cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => dashboardInputRef.current?.click()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} /> {dashboardBg ? 'Change Image' : 'Add Image'}
                    </button>
                    <input
                        type="file"
                        ref={dashboardInputRef}
                        onChange={(e) => handleFileChange(e, 'dashboard')}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>
            </div>

            {/* Journal Image Setting */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Book size={24} color="var(--accent-primary)" /> Journal Background</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Choose a custom background image for your Journal tab.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div
                        style={{
                            width: '200px',
                            height: '120px',
                            borderRadius: '16px',
                            background: journalBg ? `url(${journalBg})` : 'var(--bg-secondary)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '2px dashed var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {!journalBg && <ImageIcon size={32} color="var(--text-muted)" />}
                        {journalBg && (
                            <button
                                onClick={() => setJournalBg(null)}
                                style={{
                                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                                    background: 'rgba(239, 68, 68, 0.8)', color: 'white',
                                    border: 'none', borderRadius: '50%', padding: '0.4rem',
                                    cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => journalInputRef.current?.click()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} /> {journalBg ? 'Change Image' : 'Add Image'}
                    </button>
                    <input
                        type="file"
                        ref={journalInputRef}
                        onChange={(e) => handleFileChange(e, 'journal')}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>
            </div>

            {/* Tasks Image Setting */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><CheckSquare size={24} color="var(--accent-primary)" /> Tasks Background</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Choose a custom background image for your Tasks tab.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div
                        style={{
                            width: '200px',
                            height: '120px',
                            borderRadius: '16px',
                            background: tasksBg ? `url(${tasksBg})` : 'var(--bg-secondary)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '2px dashed var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {!tasksBg && <ImageIcon size={32} color="var(--text-muted)" />}
                        {tasksBg && (
                            <button
                                onClick={() => setTasksBg(null)}
                                style={{
                                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                                    background: 'rgba(239, 68, 68, 0.8)', color: 'white',
                                    border: 'none', borderRadius: '50%', padding: '0.4rem',
                                    cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => tasksInputRef.current?.click()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} /> {tasksBg ? 'Change Image' : 'Add Image'}
                    </button>
                    <input
                        type="file"
                        ref={tasksInputRef}
                        onChange={(e) => handleFileChange(e, 'tasks')}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>
            </div>

            {/* Tomorrow/Soon Image Setting */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Coffee size={24} color="var(--accent-primary)" /> Soon Background</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Choose a custom background image for your Soon tab.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                    <div
                        style={{
                            width: '200px',
                            height: '120px',
                            borderRadius: '16px',
                            background: tomorrowBg ? `url(${tomorrowBg})` : 'var(--bg-secondary)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '2px dashed var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {!tomorrowBg && <ImageIcon size={32} color="var(--text-muted)" />}
                        {tomorrowBg && (
                            <button
                                onClick={() => setTomorrowBg(null)}
                                style={{
                                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                                    background: 'rgba(239, 68, 68, 0.8)', color: 'white',
                                    border: 'none', borderRadius: '50%', padding: '0.4rem',
                                    cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => tomorrowInputRef.current?.click()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} /> {tomorrowBg ? 'Change Image' : 'Add Image'}
                    </button>
                    <input
                        type="file"
                        ref={tomorrowInputRef}
                        onChange={(e) => handleFileChange(e, 'tomorrow')}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>
            </div>

            {/* Slideshow Wallpapers Setting */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Monitor size={24} color="var(--accent-primary)" /> Focus Slideshow</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Add your own images to the focus mode slideshow.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '120px' : '150px'}, 1fr))`, gap: '1rem', marginBottom: '1.5rem' }}>
                    {customWallpapers.map((url, index) => (
                        <div
                            key={index}
                            style={{
                                aspectRatio: '16/9',
                                borderRadius: '12px',
                                backgroundImage: `url(${url})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                position: 'relative',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <button
                                onClick={() => removeCustomWallpaper(index)}
                                style={{
                                    position: 'absolute', top: '0.4rem', right: '0.4rem',
                                    background: 'rgba(239, 68, 68, 0.8)', color: 'white',
                                    border: 'none', borderRadius: '50%', padding: '0.3rem',
                                    cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => wallpaperInputRef.current?.click()}
                        style={{
                            aspectRatio: '16/9',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '2px dashed var(--border-subtle)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}
                    >
                        <Plus size={24} /> Add Wallpaper
                    </button>
                </div>
                <input
                    type="file"
                    ref={wallpaperInputRef}
                    onChange={(e) => handleFileChange(e, 'wallpaper')}
                    style={{ display: 'none' }}
                    accept="image/*"
                />
            </div>

            {/* Danger Zone */}
            <div style={{ ...sectionStyle, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <h2 style={{ ...titleStyle, color: '#ef4444' }}><AlertTriangle size={24} color="#ef4444" /> Danger Zone</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Irreversible actions for data management.
                </p>
                <button
                    onClick={handleClearAllData}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <Database size={18} /> Clear All App Data
                </button>
            </div>

            {/* About Section */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}><Info size={24} color="var(--accent-primary)" /> About</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                            src="logo.png"
                            alt="TruNotes"
                            style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'contain' }}
                        />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>TruNotes v2</h3>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Private, powerful, and truly yours.</p>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                            TruNotes is a cross-platform note-taking application designed for speed, privacy, and simplicity.
                            Your data resides only on your device and your personal Google Drive backup.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '0.5rem' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Version</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1.0.7 (Stable)</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Platform</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{isDesktop ? 'Desktop App' : 'Mobile App'}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Developer</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Aayush3207D</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                        <p style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            fontStyle: 'italic',
                            background: 'linear-gradient(135deg, var(--accent-primary), #ec4899)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            margin: '0.5rem 0'
                        }}>
                            "Be Smart and Genius"
                        </p>
                    </div>

                    <div style={{
                        marginTop: '0.5rem',
                        padding: '1rem',
                        borderRadius: '16px',
                        background: 'rgba(99, 102, 241, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        color: 'var(--accent-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600
                    }}>
                        Made with <Heart size={16} fill="var(--accent-primary)" /> for organized minds.
                    </div>
                </div>
            </div>
        </div>
    );
};

import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Browser } from '@capacitor/browser';
import { googleDriveService } from '../Sync/googleDrive';
import { Cloud, ExternalLink } from 'lucide-react';

const CloudSyncSection: React.FC<{
    isMobile: boolean;
    sectionStyle: React.CSSProperties;
    titleStyle: React.CSSProperties;
    inputStyle: React.CSSProperties;
}> = ({ isMobile, sectionStyle, titleStyle, inputStyle }) => {
    const [clientId, setClientId] = useState(localStorage.getItem('google_client_id') || '');
    const [clientSecret, setClientSecret] = useState(localStorage.getItem('google_client_secret') || '');
    const [authCode, setAuthCode] = useState('');
    const [status, setStatus] = useState('');
    const [isConnected, setIsConnected] = useState(!!localStorage.getItem('google_tokens'));
    const [lastSync, setLastSync] = useState(localStorage.getItem('last_sync_time') || 'Never');

    const handleConnect = async () => {
        if (!clientId) {
            setStatus('Please enter Client ID');
            return;
        }
        setStatus('');
        // Use manual copy/paste flow
        const url = googleDriveService.getAuthUrl(clientId, 'urn:ietf:wg:oauth:2.0:oob');
        await Browser.open({ url });
    };

    const handleVerify = async () => {
        if (!authCode || !clientId || !clientSecret) {
            setStatus('Missing fields');
            return;
        }
        try {
            setStatus('Verifying...');
            const tokens = await googleDriveService.getToken(clientId, clientSecret, authCode, 'urn:ietf:wg:oauth:2.0:oob');

            // Save everything
            localStorage.setItem('google_tokens', JSON.stringify(tokens));
            localStorage.setItem('google_client_id', clientId);
            localStorage.setItem('google_client_secret', clientSecret);
            localStorage.setItem('trunotes_sync_enabled', 'true');

            if ((window as any).notifySyncPrefsChanged) {
                (window as any).notifySyncPrefsChanged();
            }

            setIsConnected(true);
            setStatus('Connected! Sync will happen automatically.');
            setLastSync(new Date().toLocaleString());

            // Trigger first sync (restore/backup check)
            // Ideally we'd call SyncManager here but it listens to events/lifecycle. 
            // A simple reload or app resume will trigger it.
        } catch (e: any) {
            console.error(e);
            setStatus('Error: ' + e.message);
        }
    };

    const handleDisconnect = () => {
        if (confirm('Disconnect Google Drive? This will stop sync.')) {
            localStorage.removeItem('google_tokens');
            localStorage.removeItem('trunotes_sync_enabled');
            if ((window as any).notifySyncPrefsChanged) {
                (window as any).notifySyncPrefsChanged();
            }
            setIsConnected(false);
            setStatus('Disconnected');
        }
    };

    return (
        <div style={sectionStyle}>
            <h2 style={titleStyle}><Cloud size={24} color="var(--accent-primary)" /> Cloud Sync (Google Drive)</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Sync your notes across devices using your Google Drive. User-owned data.
            </p>

            {isConnected ? (
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckSquare size={20} /> Sync Active
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Last Sync: {lastSync}
                    </p>
                    <button
                        onClick={handleDisconnect}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Disconnect
                    </button>
                    {status && <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-primary)' }}>{status}</p>}
                </div>
            ) : (
                <div style={{ maxWidth: '500px' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Google Client ID</label>
                        <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle} placeholder="Enter Client ID" />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Google Client Secret</label>
                        <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} style={inputStyle} placeholder="Enter Client Secret" />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
                        <div style={{ flex: 1 }}>
                            <button
                                onClick={handleConnect}
                                style={{
                                    width: '100%', padding: '0.8rem', borderRadius: '12px',
                                    background: 'var(--bg-card)', color: 'var(--accent-primary)',
                                    border: '1px solid var(--accent-primary)', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}
                            >
                                <ExternalLink size={18} /> Step 1: Get Code
                            </button>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                                Log in with Google and copy the code provided.
                            </p>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={authCode}
                                    onChange={e => setAuthCode(e.target.value)}
                                    placeholder="Paste Code Here"
                                    style={{ ...inputStyle, marginBottom: 0, padding: '0.8rem' }}
                                />
                            </div>
                            <button
                                onClick={handleVerify}
                                style={{
                                    width: '100%', padding: '0.8rem', borderRadius: '12px',
                                    background: 'var(--accent-primary)', color: 'white',
                                    border: 'none', fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Step 2: Connect & Sync
                            </button>
                        </div>
                    </div>
                    {status && <p style={{ marginTop: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{status}</p>}
                </div>
            )}
        </div>
    );
};
