const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, screen: electronScreen } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow: any = null;
let widgetWindow: any = null;
let tray: any = null;
let currentPendingTodos: any[] = [];

// ─── Main Window ─────────────────────────────────────────────────────────────
const createWindow = () => {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.trunotes.v2');
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        backgroundColor: '#0f172a'
    });

    mainWindow.setMenuBarVisibility(false);

    mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// ─── Widget Window (Desktop-embedded, behind all apps) ────────────────────────
const createWidgetWindow = () => {
    const { width: screenWidth, height: screenHeight } = (electronScreen as any).getPrimaryDisplay().workAreaSize;

    // Tight fit: exactly the widget card size, no extra padding
    const WIDGET_W = 240;
    const WIDGET_H = 320;

    widgetWindow = new BrowserWindow({
        width: WIDGET_W,
        height: WIDGET_H,
        x: screenWidth - WIDGET_W - 16,
        y: screenHeight - WIDGET_H - 16,
        frame: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        hasShadow: false,
        focusable: false,         // Never steal focus from active apps
        alwaysOnTop: false,       // Stay BEHIND other windows (desktop level)
        backgroundColor: '#00000000', // Fully transparent — no grey padding
        webPreferences: {
            preload: path.join(__dirname, 'widget-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
        },
        show: false, // Don't show immediately to prevent popping up
    });

    widgetWindow.setMenuBarVisibility(false);

    // Ensure it stays in the background and doesn't steal focus
    widgetWindow.on('ready-to-show', () => {
        widgetWindow.showInactive();
    });

    // Load widget page
    if (process.env.NODE_ENV === 'development') {
        widgetWindow.loadURL('http://localhost:5173/widget.html');
    } else {
        widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'));
    }

    widgetWindow.on('closed', () => {
        widgetWindow = null;
    });

    // Push current todos once widget is ready
    widgetWindow.webContents.once('did-finish-load', () => {
        if (widgetWindow && currentPendingTodos.length >= 0) {
            widgetWindow.webContents.send('widget-todos-update', currentPendingTodos);
        }
    });

    // Whenever another window gains focus, send widget to back (desktop behaviour)
    widgetWindow.on('focus', () => {
        // Widget should never hold focus — immediately send to bottom
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
            mainWindow.focus();
        }
    });
};

// ─── System Tray ─────────────────────────────────────────────────────────────
const createTray = () => {
    // Better path discovery for packaged apps
    const isDev = process.env.NODE_ENV === 'development';
    const appDir = app.getAppPath();

    const iconPaths = [
        path.join(__dirname, '../public/logo.png'),
        path.join(__dirname, '../dist/logo.png'),
        path.join(appDir, 'dist/logo.png'),
        path.join(process.resourcesPath, 'logo.png'),
        path.join(process.resourcesPath, 'app/dist/logo.png')
    ];

    const iconPath = iconPaths.find(p => fs.existsSync(p)) || iconPaths[0];

    let trayIcon: any;
    try {
        // Use createFromPath and ensure it exists
        if (fs.existsSync(iconPath)) {
            trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        } else {
            console.error('Tray icon not found at any path:', iconPaths);
            trayIcon = nativeImage.createEmpty();
        }
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('TruNotes');

    const updateTrayMenu = () => {
        const widgetVisible = widgetWindow && widgetWindow.isVisible();
        const isAutoStart = app.getLoginItemSettings().openAtLogin;
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'TruNotes',
                enabled: false,
                icon: trayIcon,
            },
            { type: 'separator' },
            {
                label: '📋 Open TruNotes',
                click: () => {
                    if (!mainWindow) createWindow();
                    else {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: widgetVisible ? '🪟 Hide Task Widget' : '🪟 Show Task Widget',
                click: () => {
                    toggleWidget();
                    updateTrayMenu();
                }
            },
            { type: 'separator' },
            {
                label: isAutoStart ? '✅ Start with Windows' : '🔲 Start with Windows',
                click: () => {
                    app.setLoginItemSettings({ openAtLogin: !isAutoStart });
                    updateTrayMenu();
                }
            },
            { type: 'separator' },
            {
                label: '❌ Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);
        tray.setContextMenu(contextMenu);
    };

    updateTrayMenu();

    tray.on('double-click', () => {
        if (!mainWindow) createWindow();
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
};

// ─── Widget Toggle ────────────────────────────────────────────────────────────
const toggleWidget = () => {
    if (!widgetWindow) {
        createWidgetWindow();
    } else if (widgetWindow.isVisible()) {
        widgetWindow.hide();
    } else {
        widgetWindow.showInactive();
    }
};

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Main app sends updated pending todos → store and push to widget
ipcMain.on('update-widget-todos', (_event: any, todos: any[]) => {
    currentPendingTodos = todos || [];
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('widget-todos-update', currentPendingTodos);
    }
});

// Widget requests current todos (e.g. on first load)
ipcMain.on('widget-request-todos', (_event: any) => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('widget-todos-update', currentPendingTodos);
    }
});

// Widget asks to hide itself
ipcMain.on('widget-hide', () => {
    if (widgetWindow) widgetWindow.hide();
});

// Widget toggles a todo's completed state → forward to main app
ipcMain.on('widget-toggle-todo', (_event: any, todoId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('widget-action-toggle-todo', todoId);
    }
});

// Widget adds a new todo → forward to main app
ipcMain.on('widget-add-todo', (_event: any, text: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('widget-action-add-todo', text);
    }
});

// Main app requests to toggle the widget
ipcMain.on('toggle-widget', () => {
    toggleWidget();
});

// ─── Autostart IPC ────────────────────────────────────────────────────────────
ipcMain.handle('get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-autostart', (_event: any, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
});

// Asset path IPC
ipcMain.handle('get-asset-path', (_event: any, relativePath: any) => {
    const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    const fullPath = path.join(appPath, 'external_assets', relativePath);
    return `file://${fullPath.replace(/\\/g, '/')}`;
});

// ─── AI Handling ──────────────────────────────────────────────────────────────
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
                throw new Error('Model file not found.');
            }

            llamaModel = new LlamaModel({ modelPath });
        }

        if (!llamaContext) {
            llamaContext = new LlamaContext({ model: llamaModel });
        }

        const session = new LlamaChatSession({ context: llamaContext });

        let prompt = '';
        if (command === 'summarize') {
            prompt = `Please provide a concise summary of the following note:\n\n${text}`;
        } else if (command === 'improve') {
            prompt = `Please improve the grammar and flow of the following note:\n\n${text}`;
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

// ─── External Links ───────────────────────────────────────────────────────────
ipcMain.on('open-external', (_event: any, url: string) => {
    shell.openExternal(url);
});

// ─── Auto-Sync ────────────────────────────────────────────────────────────────
let isAutoSyncEnabled = false;
let isSyncing = false;
let isQuitting = false;

ipcMain.on('set-auto-sync', (_event: any, enabled: boolean) => {
    isAutoSyncEnabled = enabled;
});

ipcMain.on('sync-complete', () => {
    isSyncing = false;
    if (isQuitting) app.quit();
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.on('ready', () => {
    createTray();

    // Only launch widget if the user has autostart or it was last active
    // For now, respect the "Start with Windows" setting as the primary anchor
    const settings = app.getLoginItemSettings();
    if (settings.openAtLogin) {
        createWidgetWindow();
    }
});

app.on('window-all-closed', () => {
    // Don't quit when all windows closed — live in tray with widget
    if (process.platform === 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});
