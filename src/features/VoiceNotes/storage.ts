import { Preferences } from '@capacitor/preferences';
import type { VoiceNote } from './types';

export const VOICE_NOTES_STORAGE_KEY = 'voice_notes_ai_items';
export const VOICE_NOTES_BACKGROUND_KEY = 'voice_notes_ai_background_enabled';

export async function loadVoiceNotes(): Promise<VoiceNote[]> {
    const { value } = await Preferences.get({ key: VOICE_NOTES_STORAGE_KEY });
    if (!value) return [];

    try {
        const parsed = JSON.parse(value) as VoiceNote[];
        return parsed.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error('Failed to parse voice notes', error);
        return [];
    }
}

export async function saveVoiceNotes(notes: VoiceNote[]): Promise<void> {
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
    await Preferences.set({
        key: VOICE_NOTES_STORAGE_KEY,
        value: JSON.stringify(sorted),
    });
}
