package com.trunotes.v2.plugins;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.provider.OpenableColumns;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "AIBridge")
public class AIBridge extends Plugin {
    private static final String TAG = "AIBridge";
    private static final String PREFS_NAME = "AI_PREFS";
    private static final String KEY_LAST_MODEL = "last_model_path";

    static {
        try {
            System.loadLibrary("llama-android");
            Log.d(TAG, "Native library 'llama-android' loaded successfully");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load native library 'llama-android': " + e.getMessage());
        }
    }

    private boolean isModelLoaded = false;
    private String loadedPath = null;

    @PluginMethod
    public void loadModel(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Model path is required");
            return;
        }

        // REDUNDANT LOAD PREVENTION
        if (isModelLoaded && path.equals(loadedPath)) {
            Log.d(TAG, "Model already loaded, skipping: " + path);
            JSObject ret = new JSObject();
            ret.put("status", "loaded");
            ret.put("path", path);
            ret.put("cached", true);
            call.resolve(ret);
            return;
        }

        Log.d(TAG, "loadModel called with path: " + path);
        
        boolean useMmap = call.getBoolean("use_mmap", true);
        int threads = call.getInt("threads", 6);
        int nGpuLayers = call.getInt("n_gpu_layers", 0);
        int nCtx = call.getInt("n_ctx", 1280);

        // INSTANT RESOLVE: Tell UI we are starting
        JSObject initialRet = new JSObject();
        initialRet.put("status", "loading");
        initialRet.put("path", path);
        call.resolve(initialRet);

        // THREADED LOADING: Don't block Capacitor
        new Thread(() -> {
            try {
                File modelFile = new File(path);
                if (!modelFile.exists()) {
                    Log.e(TAG, "Model file NOT found at: " + path);
                    return;
                }

                boolean success = nativeLoadModel(path, useMmap, threads, nGpuLayers, nCtx);
                if (success) {
                    isModelLoaded = true;
                    loadedPath = path;
                    saveLastModelPath(path);
                    
                    JSObject response = new JSObject();
                    response.put("status", "loaded");
                    response.put("path", path);
                    notifyListeners("modelStatus", response);
                } else {
                    JSObject error = new JSObject();
                    error.put("status", "error");
                    error.put("message", "Native load failed");
                    notifyListeners("modelStatus", error);
                }
            } catch (Exception e) {
                Log.e(TAG, "Background load failed", e);
            }
        }).start();
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename");

        Log.d(TAG, "downloadModel called with url: " + url + ", filename: " + filename);

        if (url == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }

        try {
            File downloadDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            File existingFile = new File(downloadDir, filename);
            Log.d(TAG, "Checking for existing file at: " + existingFile.getAbsolutePath());

            // CRITICAL: Check if already exists and is healthy
            if (existingFile.exists() && existingFile.length() > 10000000) {
                Log.d(TAG, "File already exists and is valid. size: " + existingFile.length());
                JSObject ret = new JSObject();
                ret.put("downloadId", -1); // Use -1 to indicate skipped download
                ret.put("path", existingFile.getAbsolutePath());
                ret.put("alreadyExists", true);
                call.resolve(ret);
                return;
            } else {
                Log.d(TAG, "File not found or too small. exists: " + existingFile.exists() + ", size: " + existingFile.length());
            }

            if (existingFile.exists()) {
                existingFile.delete();
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Downloading AI Model: " + filename);
            request.setDescription("TruNotes Akitsu");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.addRequestHeader("User-Agent", "TruNotes/1.0");
            
            // Save to app-specific external files directory
            if (downloadDir != null && !downloadDir.exists()) {
                boolean created = downloadDir.mkdirs();
                Log.d(TAG, "Download directory created: " + created);
            }
            
            Log.d(TAG, "Setting destination to: " + downloadDir);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            long downloadId = downloadManager.enqueue(request);
            
            Log.d(TAG, "Download enqueued with ID: " + downloadId);

            // Get absolute path
            File file = new File(downloadDir, filename);
            String absolutePath = file.getAbsolutePath();
            Log.d(TAG, "Expected file path: " + absolutePath);

            JSObject ret = new JSObject();
            ret.put("downloadId", downloadId);
            ret.put("path", absolutePath);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Download failed", e);
            call.reject("Download failed: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getModelPath(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null) {
            call.reject("Filename is required");
            return;
        }
        
        File downloadDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File file = new File(downloadDir, filename);
        boolean exists = file.exists();
        long size = exists ? file.length() : 0;
        String finalPath = file.getAbsolutePath();

        // FALLBACK: If direct check fails, scan the directory for a matching file
        if (!exists && downloadDir != null && downloadDir.exists()) {
            File[] files = downloadDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().equalsIgnoreCase(filename)) {
                        exists = true;
                        size = f.length();
                        finalPath = f.getAbsolutePath();
                        Log.d(TAG, "Fallback found file: " + finalPath);
                        break;
                    }
                }
            }
        }

        Log.d(TAG, "getModelPath check: " + finalPath + " exists: " + exists + " size: " + size);

        // Ensure we don't accidentally detect partial files from failed downloads
        boolean isValid = exists && size > 10000000; // 10MB floor
        
        JSObject ret = new JSObject();
        ret.put("path", finalPath);
        ret.put("exists", isValid);
        ret.put("size", size);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        Long downloadId = call.getLong("downloadId");
        if (downloadId == null) {
            call.reject("downloadId is required");
            return;
        }
        DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        
        android.database.Cursor cursor = downloadManager.query(query);
        if (cursor.moveToFirst()) {
                int bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                int bytesTotalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);

                long bytesDownloaded = 0;
                long bytesTotal = 0;
                int status = 0;
                int reason = 0;
                String localUri = null;

                if (bytesDownloadedIdx != -1) bytesDownloaded = cursor.getLong(bytesDownloadedIdx);
                if (bytesTotalIdx != -1) bytesTotal = cursor.getLong(bytesTotalIdx);
                if (statusIdx != -1) status = cursor.getInt(statusIdx);
                if (reasonIdx != -1) reason = cursor.getInt(reasonIdx);
                
                int localUriIdx = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                if (localUriIdx != -1) localUri = cursor.getString(localUriIdx);

                double progress = 0;
                if (bytesTotal > 0) {
                    progress = ((double) bytesDownloaded / bytesTotal);
                } else if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    progress = 1.0;
                }
                
                // If total size is unknown, but we are running, check disk to see if it's growing
                String filename = call.getString("filename");
                File fileOnDisk = null;
                if (filename != null) {
                    fileOnDisk = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
                    if (fileOnDisk.exists() && bytesTotal <= 0 && status == DownloadManager.STATUS_RUNNING) {
                        // Fallback: if we don't know total size, at least show it's progressing if > 0
                        progress = Math.max(0.01, progress);
                    }
                }

                if (status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED) {
                    progress = 0;
                }

                Log.d(TAG, "Download Progress: " + (progress * 100) + "% | Status: " + status + " | Bytes: " + bytesDownloaded + "/" + bytesTotal);

                String cleanPath = localUri;
                // Important: Convert content:// or file:// URI to absolute path for llama.cpp
                if (localUri != null && localUri.startsWith("content://")) {
                   cleanPath = fileOnDisk != null ? fileOnDisk.getAbsolutePath() : localUri;
                } else if (localUri != null && localUri.startsWith("file://")) {
                   cleanPath = localUri.substring(7);
                }

                if (status == DownloadManager.STATUS_SUCCESSFUL && fileOnDisk != null && fileOnDisk.exists()) {
                    cleanPath = fileOnDisk.getAbsolutePath();
                }

                JSObject ret = new JSObject();
                ret.put("progress", progress);
                ret.put("status", status);
                ret.put("reason", reason);
                ret.put("bytesDownloaded", bytesDownloaded);
                ret.put("bytesTotal", bytesTotal);
                ret.put("path", cleanPath);
                call.resolve(ret);
        } else {
            call.reject("Download not found");
        }
        cursor.close();
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String filename = call.getString("filename");
        Long downloadId = null;
        if (call.hasOption("downloadId")) {
            try {
                downloadId = Long.valueOf(call.getString("downloadId")); // Capacitor passes numbers as strings sometimes? verify
                // Actually JS sends number, but safe to check type. 
                // However, let's just use call.getLong fails if standard json.
                // Let's rely on call.getData().optLong("downloadId") or check manually
            } catch (Exception e) {}
        }
        // safer way for Long
        if (call.getData().has("downloadId")) {
             try {
                 downloadId = call.getData().getLong("downloadId");
             } catch (Exception e) {}
        }

        boolean deleted = false;
        
        // If we have a download ID, use DownloadManager to remove it (cancels and deletes file)
        if (downloadId != null && downloadId > 0) {
            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            int removed = downloadManager.remove(downloadId);
            if (removed > 0) {
                deleted = true;
                Log.d(TAG, "Cancelled and deleted download ID: " + downloadId);
            }
        }
        
        // Fallback or explicit file deletion
        if (!deleted && filename != null) {
            File file = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
            if (file.exists()) {
                deleted = file.delete();
                Log.d(TAG, "Deleted file directly: " + filename);
            }
        }

        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void unloadModel(PluginCall call) {
        try {
            nativeUnloadModel();
            isModelLoaded = false;
            loadedPath = null;
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove(KEY_LAST_MODEL).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Unload failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void generate(PluginCall call) {
        String prompt = call.getString("prompt");
        if (prompt == null) {
            call.reject("Prompt is required");
            return;
        }

        int nPredict = call.getInt("n_predict", 256);
        float temperature = call.getFloat("temperature", 0.5f);
        int topK = call.getInt("top_k", 20);
        float topP = call.getFloat("top_p", 0.85f);
        float penalty = call.getFloat("penalty", 1.2f);
        int threads = call.getInt("threads", 6); // Read BEFORE resolve

        // INSTANT RESOLVE: UI can show bot bubble/loading immediately
        JSObject initialRet = new JSObject();
        initialRet.put("started", true);
        call.resolve(initialRet);

        // Call native code for actual AI generation in background
        Thread genThread = new Thread(() -> {
            try {
                String fullResponse = nativeGenerate(prompt, nPredict, temperature, topK, topP, penalty, threads);

                // Final completion event
                JSObject done = new JSObject();
                done.put("fullResponse", fullResponse);
                notifyListeners("done", done);
            } catch (Exception e) {
                Log.e(TAG, "Generation failed", e);
            }
        });
        genThread.setPriority(Thread.MAX_PRIORITY);
        genThread.start();
    }

    @PluginMethod
    public void embed(PluginCall call) {
        String text = call.getString("text");
        if (text == null) {
            call.reject("Text is required for embedding");
            return;
        }

        // Run directly or in thread? Llama embeddings are relatively fast but can take 50-100ms.
        // Let's use a thread to be safe with Capacitor lifecycle.
        new Thread(() -> {
            try {
                float[] vector = nativeEmbed(text);
                if (vector != null) {
                    JSObject ret = new JSObject();
                    ret.put("vector", vector);
                    call.resolve(ret);
                } else {
                    call.reject("Embedding generation failed (is embedding model loaded?)");
                }
            } catch (Exception e) {
                Log.e(TAG, "Embed failed", e);
                call.reject("Embed failed: " + e.getMessage());
            }
        }).start();
    }

    // Called from C++ JNI
    public void onNativeToken(String token) {
        JSObject data = new JSObject();
        data.put("token", token);
        notifyListeners("token", data);
    }

    @PluginMethod
    public void getLastModelPath(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String path = prefs.getString(KEY_LAST_MODEL, null);
        
        JSObject ret = new JSObject();
        ret.put("path", path);
        call.resolve(ret);
    }

    @PluginMethod
    public void pickModel(PluginCall call) {
        // We will implement this by launching a file picker
        // For simplicity in this turn, we'll add the method signature
        // and logic to handle the result.
        // Actually, let's use a simpler approach: importModel(uri)
        saveCall(call);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "handlePickModelResult");
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        // This is handled by @ActivityCallback in newer Capacitor or manual logic
    }

    @ActivityCallback
    private void handlePickModelResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null && data.getData() != null) {
                Uri uri = data.getData();
                String filename = getFileName(uri);
                if (filename == null || !filename.endsWith(".gguf")) {
                    call.reject("Please select a .gguf file");
                    return;
                }

                try {
                    File destFile = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
                    copyUriToFile(uri, destFile);
                    
                    JSObject ret = new JSObject();
                    ret.put("name", filename.replace(".gguf", ""));
                    ret.put("path", destFile.getAbsolutePath());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to import model: " + e.getMessage());
                }
            } else {
                call.reject("No file selected");
            }
        } else {
            call.reject("Pick cancelled");
        }
    }

    private String getFileName(Uri uri) {
        String result = null;
        if (uri.getScheme().equals("content")) {
            android.database.Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null);
            try {
                if (cursor != null && cursor.moveToFirst()) {
                    result = cursor.getString(cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME));
                }
            } finally {
                cursor.close();
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result;
    }

    private void copyUriToFile(Uri uri, File destFile) throws Exception {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(destFile)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
        }
    }

    private void saveLastModelPath(String path) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LAST_MODEL, path).apply();
    }

    // Native methods
    @PluginMethod
    public void stopGenerate(PluginCall call) {
        nativeStopGenerate();
        call.resolve();
    }

    private native boolean nativeLoadModel(String filename, boolean useMmap, int nThreads, int nGpuLayers, int nCtx);
    private native String nativeGenerate(String prompt, int nPredict, float temperature, int topK, float topP, float penalty, int nThreads);
    private native void nativeStopGenerate();
    private native void nativeUnloadModel();
    private native float[] nativeEmbed(String text);
}
