
export interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

// DISCOVERY_DOCS removed

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const googleDriveService = {
    // 1. Generate Auth URL (User opens this)
    getAuthUrl(clientId: string, redirectUri: string = 'http://localhost') {
        const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: SCOPES,
            access_type: 'offline',
            prompt: 'consent'
        });
        return `${rootUrl}?${params.toString()}`;
    },

    // 2. Exchange Code for Tokens
    async getToken(clientId: string, clientSecret: string, code: string, redirectUri: string = 'http://localhost'): Promise<GoogleTokens> {
        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error_description || 'Failed to get token');
        }

        return response.json();
    },

    // 3. Refresh Token
    async refreshToken(clientId: string, clientSecret: string, refreshToken: string): Promise<GoogleTokens> {
        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error_description || 'Failed to refresh token');
        }

        const data = await response.json();
        // Google doesn't always return a new refresh token on refresh
        return { ...data, refresh_token: refreshToken };
    },

    // 3. Find Backup File
    async findBackupFile(accessToken: string) {
        const query = "name = 'trunotes_backup.json' and trashed = false";
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, modifiedTime)`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Drive List Files Error:", response.status, errorText);
            if (response.status === 401) throw new Error('Cloud session expired. Please reconnect in Settings.');
            if (response.status === 403) throw new Error('Cloud access denied. Check your Google Client ID permissions.');
            throw new Error(`Cloud Sync Error: ${response.status} - Failed to list files`);
        }

        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    },

    // 4. Upload (Create or Update)
    async uploadBackup(accessToken: string, data: any, existingFileId?: string) {
        const fileContent = JSON.stringify(data);
        const metadata = {
            name: 'trunotes_backup.json',
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (existingFileId) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        const response = await fetch(url, {
            method: method,
            headers: { Authorization: `Bearer ${accessToken}` }, // FormData sets its own Content-Type boundary
            body: form
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error('Upload failed: ' + err);
        }

        return response.json();
    },

    // 5. Download
    async downloadBackup(accessToken: string, fileId: string) {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Drive Download Error:", response.status, errorText);
            throw new Error(`Cloud Download Failed: ${response.status}`);
        }
        return response.json();
    }
};
