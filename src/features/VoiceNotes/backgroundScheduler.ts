import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackgroundVoiceAIPlugin {
    scheduleProcessing(): Promise<{ scheduled: boolean }>;
    cancelProcessing(): Promise<{ cancelled: boolean }>;
}

const BackgroundVoiceAI = registerPlugin<BackgroundVoiceAIPlugin>('BackgroundVoiceAI', {
    web: () => ({
        scheduleProcessing: async () => ({ scheduled: false }),
        cancelProcessing: async () => ({ cancelled: false }),
    }),
});

export async function syncBackgroundVoiceWorker(enabled: boolean): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
        if (enabled) {
            await BackgroundVoiceAI.scheduleProcessing();
        } else {
            await BackgroundVoiceAI.cancelProcessing();
        }
    } catch (error) {
        console.error('Failed to sync background worker', error);
    }
}

export { BackgroundVoiceAI };
