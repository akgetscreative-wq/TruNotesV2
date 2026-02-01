const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.

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
            nodeIntegration: false, // Secure
            contextIsolation: true, // Secure
            webSecurity: false // Allow loading local files (for file:// protocol) - strictly needed for local asset loading without custom protocol
        },
    });

    // Remove the menu for a more app-like feel, or keep it.
    mainWindow.setMenuBarVisibility(false);

    // IPC for Asset Path
    ipcMain.handle('get-asset-path', (event: any, relativePath: any) => {
        const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const fullPath = path.join(appPath, 'external_assets', relativePath);
        return `file://${fullPath.replace(/\\/g, '/')}`;
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

    // and load the index.html of the app.
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

// ... app.on events ...
app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
