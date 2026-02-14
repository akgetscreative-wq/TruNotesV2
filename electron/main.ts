const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    // Set App ID for Windows taskbar icon consistency
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.trunotes.v2');
    }

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
    });

    mainWindow.setMenuBarVisibility(false);


    // IPC for Asset Path
    ipcMain.handle('get-asset-path', (event: any, relativePath: any) => {
        const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const fullPath = path.join(appPath, 'external_assets', relativePath);
        return `file://${fullPath.replace(/\\/g, '/')}`;
    });

    // AI Handling (node-llama-cpp)
    let llamaModel: any = null;
    let llamaContext: any = null;

    ipcMain.handle('ai-command', async (_event: any, { command, text }: { command: string, text: string }) => {
        try {
            const { LlamaModel, LlamaContext, LlamaChatSession } = require('node-llama-cpp');

            if (!llamaModel) {
                let modelPath = 'D:/AI/Store/llama-3.2-1b-instruct-q4_k_m.gguf';

                if (!fs.existsSync(modelPath)) {
                    const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
                    modelPath = path.join(appPath, 'external_assets', 'models', 'llama-3.2-1b-instruct-q4_k_m.gguf');
                }

                if (!fs.existsSync(modelPath)) {
                    throw new Error('Model file not found. Please place "llama-3.2-1b-instruct-q4_k_m.gguf" in "D:/AI/Store/" or "external_assets/models/"');
                }

                llamaModel = new LlamaModel({
                    modelPath: modelPath
                });
            }

            if (!llamaContext) {
                llamaContext = new LlamaContext({ model: llamaModel });
            }

            const session = new LlamaChatSession({ context: llamaContext });

            let prompt = '';
            if (command === 'summarize') {
                prompt = `Please provide a concise summary of the following note. Focus on the main points and keep it brief:\n\n${text}`;
            } else if (command === 'improve') {
                prompt = `Please improve the grammar and flow of the following note while keeping the original meaning and tone:\n\n${text}`;
            } else if (command === 'fix-grammar') {
                prompt = `Please fix any grammar and spelling mistakes in the following text:\n\n${text}`;
            } else {
                prompt = `${command}:\n\n${text}`;
            }

            const result = await session.prompt(prompt);
            return { success: true, result };
        } catch (error: any) {
            console.error('AI Error:', error);
            return { success: false, error: error?.message || 'Unknown AI error' };
        }
    });

    // Handle External Links
    ipcMain.on('open-external', (event: any, url: string) => {
        shell.openExternal(url);
    });

    // Auto-Sync Handling
    let isAutoSyncEnabled = false;
    let isSyncing = false;
    let isQuitting = false;

    ipcMain.on('set-auto-sync', (event: any, enabled: boolean) => {
        isAutoSyncEnabled = enabled;
    });

    ipcMain.on('sync-complete', () => {
        isSyncing = false;
        if (isQuitting) {
            app.quit();
        }
    });

    mainWindow.on('close', (e: any) => {
        if (isAutoSyncEnabled && !isSyncing && !isQuitting) {
            e.preventDefault();
            isSyncing = true;
            isQuitting = true;
            mainWindow.webContents.send('trigger-auto-backup');

            // Safety timeout: quit anyway after 10 seconds if sync hangs
            setTimeout(() => {
                if (isQuitting) app.quit();
            }, 10000);
        }
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
