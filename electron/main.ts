const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

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

    // Activity Tracker (PC)
    let lastApp = "";
    let startTime = Date.now();

    const trackActivity = () => {
        if (process.platform !== 'win32') return;

        const psScript = `
            $code = @'
                using System;
                using System.Runtime.InteropServices;
                using System.Text;
                public class Utils {
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetForegroundWindow();
                    [DllImport("user32.dll")]
                    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
                    [DllImport("user32.dll")]
                    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
                }
'@
            Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
            $hwnd = [Utils]::GetForegroundWindow()
            $sb = New-Object System.Text.StringBuilder 256
            [Utils]::GetWindowText($hwnd, $sb, 256) | Out-Null
            $pid = 0
            [Utils]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
            $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($p) { write-host "$($p.ProcessName)|$($sb.ToString())" }
        `;

        exec(`powershell -command "${psScript.replace(/"/g, '\\"')}"`, (error: any, stdout: any) => {
            if (error || !stdout) return;
            const out = stdout.trim();
            if (!out.includes('|')) return;

            const [procName, title] = out.split('|');
            const currentApp = procName.toLowerCase();

            if (currentApp !== lastApp) {
                const now = Date.now();
                if (lastApp && lastApp !== "idle") {
                    mainWindow.webContents.send('activity-event', {
                        appName: lastApp,
                        pkgName: lastApp,
                        startTime,
                        endTime: now,
                        deviceType: 'pc',
                        deviceName: 'Windows PC'
                    });
                }
                lastApp = currentApp;
                startTime = now;
            }
        });
    };

    setInterval(trackActivity, 5000); // Check every 5 seconds

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
