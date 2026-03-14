import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('widgetAPI', {
    onTodosUpdate: (callback: (todos: any[]) => void) => {
        ipcRenderer.on('widget-todos-update', (_event, todos) => callback(todos));
    },
    requestTodos: () => ipcRenderer.send('widget-request-todos'),
    hideWidget: () => ipcRenderer.send('widget-hide'),
    startDrag: () => ipcRenderer.send('widget-start-drag'),
    toggleTodo: (id: string) => ipcRenderer.send('widget-toggle-todo', id),
    addTodo: (text: string) => ipcRenderer.send('widget-add-todo', text),
    platform: process.platform,
});
