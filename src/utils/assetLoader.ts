
declare global {
    interface Window {
        electron?: {
            getAssetPath: (relativePath: string) => Promise<string>;
        };
    }
}

// Map of imported assets for Dev mode (fallback)
import { wallpapers } from '../assets/wallpapers';
import { calendarBackgrounds } from '../assets/calendar_backgrounds';
import journalBg from '../assets/journal-bg-dark.png';

// Helper to get wallpaper path
export const getWallpaperPath = async (index: number): Promise<string> => {
    if (window.electron) {
        // Production / Electron with Preload
        // Index 0 -> wallpaper-1.jpg
        // The files in external_assets/wallpapers are named wallpaper-1.jpg, etc.
        // Wait, original names? Yes, I copied them.
        // Wallpapers array in imported version has them differently?
        // Let's assume standard naming: wallpaper-{index+1}.jpg or png
        // I need to check extensions. Some are png.
        // To be safe, I might need to check file existence OR just rely on naming convention if consistent.
        // In the verify step, I saw wallpaper-14.png, wallpaper-16.png, wallpaper-17.png. Others .jpg.

        // Strategy: Try JPG, if error, try PNG? properties?
        // Simpler: Just hardcode the extension map if possible, OR fallback to Dev imports if we can't determine.
        // ACTUALLY: The user wants to replace them. The user will name them whatever?
        // Ideally user keeps same name.
        // Let's use a known map of extensions for the default set.
        const extensions: Record<number, string> = {
            13: 'png', 15: 'png', 16: 'png' // 0-indexed: 13=wallpaper-14, 15=wallpaper-16, 16=wallpaper-17
        };
        // Wait, 0-indexed?
        // wallpaper-1 is index 0.
        // wallpaper-14 is index 13.
        // wallpaper-16 is index 15.
        // wallpaper-17 is index 16.
        // All others jpg.
        const ext = extensions[index] || 'jpg';
        const filename = `wallpapers/wallpaper-${index + 1}.${ext}`;
        return await window.electron.getAssetPath(filename);
    } else {
        // Browser Dev Mode (imports)
        return wallpapers[index];
    }
};

export const getCalendarBackgroundPath = async (month: number): Promise<string> => {
    // month is 1-12
    if (window.electron) {
        return await window.electron.getAssetPath(`calendar_backgrounds/month-${month}.png`);
    }
    return calendarBackgrounds[month];
};

export const getJournalBackgroundPath = async (): Promise<string> => {
    if (window.electron) {
        return await window.electron.getAssetPath('journal-bg-dark.png');
    }
    return journalBg;
};
