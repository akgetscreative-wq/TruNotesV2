
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    getAssetPath: (relativePath: string) => {
        return ipcRenderer.invoke('get-asset-path', relativePath);
    },
    openExternal: (url: string) => {
        ipcRenderer.send('open-external', url);
    },
    setAutoSync: (enabled: boolean) => {
        ipcRenderer.send('set-auto-sync', enabled);
    },
    onTriggerAutoBackup: (callback: () => void) => {
        ipcRenderer.on('trigger-auto-backup', () => callback());
    },
    sendSyncComplete: () => {
        ipcRenderer.send('sync-complete');
    }
});
