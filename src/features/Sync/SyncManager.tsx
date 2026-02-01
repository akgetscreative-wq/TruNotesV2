import React, { useEffect } from 'react';
import { googleDriveService } from './googleDrive';
import { storage } from '../../lib/storage';

// Capacitor Plugins
import { App } from '@capacitor/app';

export const SyncManager: React.FC = () => {
    const [config, setConfig] = React.useState({
        isAutoSync: localStorage.getItem('trunotes_sync_enabled') === 'true',
        isRealTime: localStorage.getItem('trunotes_realtime_sync') === 'true'
    });

    useEffect(() => {
        const refreshConfig = () => {
            setConfig({
                isAutoSync: localStorage.getItem('trunotes_sync_enabled') === 'true',
                isRealTime: localStorage.getItem('trunotes_realtime_sync') === 'true'
            });
        };

        (window as any).notifySyncPrefsChanged = refreshConfig;
    }, []);

    useEffect(() => {
        const { isAutoSync, isRealTime } = config;

        // Helper to check creds dynamically

        // Helper to check creds dynamically
        const hasCredentials = () => {
            const tokens = localStorage.getItem('google_tokens');
            const cid = localStorage.getItem('google_client_id');
            const sec = localStorage.getItem('google_client_secret');
            return !!(tokens && cid && sec);
        };


        // Shared Logic for getting fresh tokens
        const getFreshTokens = async () => {
            if (!hasCredentials()) throw new Error("Missing Google Credentials. Please login in Settings.");

            // MASTER SWITCH Check
            if (localStorage.getItem('trunotes_sync_enabled') !== 'true') {
                throw new Error("Cloud Sync is disabled in Settings.");
            }

            const clientId = localStorage.getItem('google_client_id')!;
            const clientSecret = localStorage.getItem('google_client_secret')!;
            const currentTokens = JSON.parse(localStorage.getItem('google_tokens') || '{}');

            try {
                const newTokens = await googleDriveService.refreshToken(clientId, clientSecret, currentTokens.refresh_token);
                localStorage.setItem('google_tokens', JSON.stringify(newTokens));
                return newTokens;
            } catch (err) {
                console.error("SyncManager: Token refresh failed", err);
                throw err;
            }
        };


        // 1. SMART SYNC (Download & Merge)
        const performSmartSync = async (isManual: boolean = false) => {
            if (!navigator.onLine) {
                if (isManual) (window as any).showToast("You are offline", "error");
                return;
            }
            // Check Master Switch
            if (localStorage.getItem('trunotes_sync_enabled') !== 'true') {
                if (isManual) (window as any).showToast("Sync is disabled in Settings", "info");
                return;
            }
            try {
                console.log("SyncManager: Starting sync" + (isManual ? " (manual)" : " (auto)"));
                if (isManual) (window as any).showToast("Starting cloud sync...", "info");
                const syncTokens = await getFreshTokens();
                const existing = await googleDriveService.findBackupFile(syncTokens.access_token);
                let didDownload = false;

                if (existing) {
                    console.log("SyncManager: Found backup file", existing.id);
                    const cloudData = await googleDriveService.downloadBackup(syncTokens.access_token, existing.id);

                    if (!cloudData || (!cloudData.notes && !cloudData.todos)) {
                        console.warn("SyncManager: Cloud data is empty or invalid structure", cloudData);
                        if (isManual) (window as any).showToast("Cloud backup is empty", "info");
                    } else {
                        const noteCount = cloudData.notes?.length || 0;
                        const todoCount = cloudData.todos?.length || 0;
                        console.log(`SyncManager: Downloading ${noteCount} notes and ${todoCount} todos`);

                        await storage.importDatabase(cloudData);
                        console.log("SyncManager: Merge Complete.");
                        if (isManual) (window as any).showToast(`Synced ${noteCount} notes and ${todoCount} tasks!`, "success");
                        didDownload = true;
                    }
                } else {
                    console.log("SyncManager: No backup found on cloud yet.");
                    if (isManual) (window as any).showToast("No cloud backup found.", "info");
                }

                // After merge, ensure cloud has latest merged state (Upload)
                // If we downloaded, we MUST upload the merged state specifically to stamp the new time
                if (didDownload || isManual) {
                    await performInstantBackup(syncTokens.access_token); // True to force immediate
                }

                if (isManual && !existing) (window as any).showToast("Created fresh cloud backup", "success");
            } catch (e: any) {
                console.error("SyncManager: Sync Failed", e);
                const msg = e.message || "Cloud connectivity issues";
                // CRITICAL: We only show error toasts if this was a MANUAL user action.
                // Background auto-syncs and polling MUST be silent to avoid annoying the user.
                if (isManual) {
                    (window as any).showToast(`Sync Failed: ${msg}`, "error");
                }
                throw e; // Re-throw so callers know it failed
            }
        };

        const performManualDownload = async () => {
            if (!navigator.onLine) {
                (window as any).showToast("You are offline", "error");
                return;
            }
            try {
                (window as any).showToast("Fetching from cloud...", "info");
                const syncTokens = await getFreshTokens();
                const existing = await googleDriveService.findBackupFile(syncTokens.access_token);
                if (existing) {
                    const cloudData = await googleDriveService.downloadBackup(syncTokens.access_token, existing.id);
                    if (cloudData) {
                        const noteCount = cloudData.notes?.length || 0;
                        const todoCount = cloudData.todos?.length || 0;
                        await storage.importDatabase(cloudData);
                        (window as any).showToast(`Pulled ${noteCount} notes and ${todoCount} tasks from cloud!`, "success");
                    } else {
                        (window as any).showToast("Cloud file was empty", "info");
                    }
                } else {
                    (window as any).showToast("No backup found on cloud", "error");
                }
            } catch (e) {
                console.error("Manual Download Failed", e);
                (window as any).showToast("Download failed", "error");
                throw e;
            }
        };

        const performManualUpload = async () => {
            if (!navigator.onLine) {
                (window as any).showToast("You are offline", "error");
                return;
            }
            try {
                (window as any).showToast("Preparing upload...", "info");
                const syncTokens = await getFreshTokens();
                (window as any).showToast("Uploading to Google Drive...", "info");
                await performInstantBackup(syncTokens.access_token);
                (window as any).showToast("Backup uploaded successfully!", "success");
            } catch (e) {
                console.error("Manual Upload Failed", e);
                (window as any).showToast("Upload failed", "error");
                throw e;
            }
        };

        // 2. INSTANT BACKUP (Upload only)
        let debounceTimer: any;
        const performInstantBackup = async (explicitToken?: string) => {
            if (!navigator.onLine) return;
            // Master Switch Check for Background Sync
            if (localStorage.getItem('trunotes_sync_enabled') !== 'true') {
                console.log("SyncManager: Background sync disabled. Skipping instant backup.");
                return;
            }

            if (!explicitToken) {
                const delay = isRealTime ? 3000 : 2000;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    try {
                        const tokens = await getFreshTokens();
                        const data = await storage.exportDatabase();
                        await uploadInternal(tokens.access_token, data);
                    } catch (e) {
                        console.error("SyncManager: Auto-Upload Failed", e);
                    }
                }, delay);
                return;
            }

            // Explicit/Immediate
            try {
                const data = await storage.exportDatabase();
                await uploadInternal(explicitToken, data);
            } catch (e) {
                console.error("SyncManager: Backup Failed", e);
                throw e;
            }
        };

        const uploadInternal = async (token: string, data: any) => {
            const existing = await googleDriveService.findBackupFile(token);
            await googleDriveService.uploadBackup(token, data, existing?.id);
            // Update last sync time to match Cloud's timestamp if possible, or Now
            // Ideally we use the response modifiedTime if available, else local
            const now = new Date();
            localStorage.setItem('last_sync_time', now.toLocaleString());
            localStorage.setItem('last_sync_iso', now.toISOString());
            console.log("SyncManager: Upload Success.");
        };

        // --- EXPOSE FOR UI ---
        (window as any).triggerSync = (isManual: boolean = true) => performSmartSync(isManual);
        (window as any).triggerUpload = () => performManualUpload();
        (window as any).triggerDownload = () => performManualDownload();


        // --- AUTOMATIC SYNC TRIGGERS ---
        let resumeListener: any = null;
        let dataUnsubscribe: any = null;
        let pollingInterval: any = null;

        if (isAutoSync) {
            // Initial sync on mount (Silent)
            performSmartSync(false).catch(() => { });

            // Listen for local changes
            dataUnsubscribe = storage.onDataChange(() => {
                console.log("SyncManager: Local Change -> Queueing Upload");
                performInstantBackup().catch(() => { });
            });

            // 15-Second Active Smart Sync (Real-time)
            pollingInterval = setInterval(async () => {
                if (!isRealTime || !navigator.onLine) return;
                try {
                    console.log("SyncManager: Real-time interval -> Triggering Smart Sync");
                    await performSmartSync(false);
                } catch (e) { /* ignore polling errors */ }
            }, 15000);

            // Mobile focus trigger
            const isNative = (window as any).Capacitor?.isNativePlatform();
            if (isNative) {
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        console.log("SyncManager: App focused -> Triggering Auto Sync");
                        performSmartSync(false).catch(() => { });
                    }
                }).then(l => resumeListener = l);
            } else {
                // Desktop / Web Focus
                const onFocus = () => {
                    console.log("SyncManager: Window focused -> Triggering Auto Sync");
                    performSmartSync(false).catch(() => { });
                };
                window.addEventListener('focus', onFocus);
                // Cleanup specific to this listener
                resumeListener = { remove: () => window.removeEventListener('focus', onFocus) };
            }
        }

        return () => {
            if (resumeListener) resumeListener.remove();
            if (dataUnsubscribe) dataUnsubscribe();
            if (pollingInterval) clearInterval(pollingInterval);
        };

    }, [config]);

    return null;
};
