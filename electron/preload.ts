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
    },
    aiCommand: (command: string, text: string) => {
        return ipcRenderer.invoke('ai-command', { command, text });
    },
    // ── Desktop Widget IPC ──
    updateWidgetTodos: (todos: any[]) => {
        ipcRenderer.send('update-widget-todos', todos);
    },
    toggleWidget: () => {
        ipcRenderer.send('toggle-widget');
    },
    // ── Autostart IPC ──
    getAutostart: () => {
        return ipcRenderer.invoke('get-autostart');
    },
    setAutostart: (enabled: boolean) => {
        ipcRenderer.send('set-autostart', enabled);
    },
    // ── Widget action listeners (widget → main process → main app) ──
    onWidgetToggleTodo: (callback: (todoId: string) => void) => {
        ipcRenderer.on('widget-action-toggle-todo', (_event, todoId) => callback(todoId));
    },
    onWidgetAddTodo: (callback: (text: string) => void) => {
        ipcRenderer.on('widget-action-add-todo', (_event, text) => callback(text));
    },
});
