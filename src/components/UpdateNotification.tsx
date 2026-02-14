import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAppUpdate, type ReleaseInfo } from '../hooks/useAppUpdate';
import { Browser } from '@capacitor/browser';
import { showToast } from '../App';

export const UpdateNotification: React.FC = () => {
    const { updateAvailable } = useAppUpdate();
    const [downloading, setDownloading] = React.useState(false);

    const handleUpdate = async (releaseInfo: ReleaseInfo) => {
        setDownloading(true);
        showToast("Download started... Check notifications", "success");

        // If we have an APK URL, trigger download
        if (releaseInfo.apkUrl) {
            await Browser.open({ url: releaseInfo.apkUrl });
        } else {
            // Fallback to release page
            await Browser.open({ url: releaseInfo.url });
        }

        // We leave downloading as true to keep the button in a 'loading' state if they come back
        setTimeout(() => setDownloading(false), 5000);
    };

    return (
        <AnimatePresence>
            {updateAvailable && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    style={{
                        position: 'fixed',
                        top: '1rem',
                        left: '1rem',
                        right: '1rem',
                        zIndex: 10000,
                        display: 'flex',
                        justifyContent: 'center'
                    }}
                >
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.95)',
                        backdropFilter: 'blur(16px)',
                        padding: '1rem 1.5rem',
                        borderRadius: '24px',
                        boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        maxWidth: '500px',
                        width: '100%',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white'
                    }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.2)',
                            padding: '0.75rem',
                            borderRadius: '16px',
                        }}>
                            <Sparkles size={24} color="white" />
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Update Available! v{updateAvailable.version}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.1rem' }}>Enhance your TruNotes experience today.</div>
                        </div>

                        <button
                            onClick={() => handleUpdate(updateAvailable)}
                            disabled={downloading}
                            style={{
                                background: downloading ? 'rgba(255,255,255,0.5)' : 'white',
                                color: 'var(--accent-primary)',
                                padding: '0.6rem 1.2rem',
                                borderRadius: '12px',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: downloading ? 'default' : 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            {downloading ? 'Downloading...' : 'Update'} <ArrowRight size={16} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
