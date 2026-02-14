import { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

const GITHUB_OWNER = 'akgetscreative-wq';
const GITHUB_REPO = 'TruNotesV2';
const CURRENT_VERSION = '1.0.8';

export interface ReleaseInfo {
    version: string;
    url: string;
    notes: string;
    apkUrl?: string;
}

export function useAppUpdate() {
    const [updateAvailable, setUpdateAvailable] = useState<ReleaseInfo | null>(null);
    const [checking, setChecking] = useState(false);

    const checkForUpdates = async () => {
        if (checking) return;
        setChecking(true);
        try {
            console.log("UpdateCheck: Checking GitHub for new releases...");
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
            if (!response.ok) throw new Error('Failed to fetch releases');

            const data = await response.json();
            const latestVersion = data.tag_name.replace('v', '');

            if (isNewer(latestVersion, CURRENT_VERSION)) {
                console.log(`UpdateCheck: New version found: ${latestVersion}`);

                // Find APK in assets
                const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));

                setUpdateAvailable({
                    version: latestVersion,
                    url: data.html_url,
                    notes: data.body,
                    apkUrl: apkAsset?.browser_download_url
                });
            } else {
                console.log("UpdateCheck: App is up to date.");
                setUpdateAvailable(null);
            }
        } catch (err) {
            console.error('UpdateCheck: Failed to check for updates', err);
        } finally {
            setChecking(false);
        }
    };

    const isNewer = (latest: string, current: string) => {
        const l = latest.split('.').map(Number);
        const c = current.split('.').map(Number);
        for (let i = 0; i < Math.max(l.length, c.length); i++) {
            const lv = l[i] || 0;
            const cv = c[i] || 0;
            if (lv > cv) return true;
            if (lv < cv) return false;
        }
        return false;
    };

    useEffect(() => {
        // Initial check
        checkForUpdates();

        // Check again when app resumes
        const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                checkForUpdates();
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, []);

    return { updateAvailable, checking, checkForUpdates, currentVersion: CURRENT_VERSION };
}
