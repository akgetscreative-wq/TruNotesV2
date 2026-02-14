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

    @PluginMethod
    public void loadModel(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Model path is required");
            return;
        }

        Log.d(TAG, "loadModel called with path: " + path);
        
        // Memory Mapping (The Crash Fix)
        boolean useMmap = call.getBoolean("use_mmap", true);
        int threads = call.getInt("threads", 6); // Optimal for most modern mobile CPUs

        try {
            File modelFile = new File(path);
            if (!modelFile.exists()) {
                Log.e(TAG, "Model file NOT found at: " + path);
                call.reject("Model file not found at: " + path);
                return;
            }
            Log.d(TAG, "Model file confirmed exists at: " + path + " (Size: " + modelFile.length() + ")");

            // Call native implementation
            boolean success = nativeLoadModel(path, useMmap, threads);
            
            if (success) {
                saveLastModelPath(path);
                JSObject ret = new JSObject();
                ret.put("status", "loaded");
                ret.put("path", path);
                call.resolve(ret);
            } else {
                call.reject("Failed to load model - native error");
            }
        } catch (Exception e) {
            call.reject("Failed to load model: " + e.getMessage());
        }
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
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Downloading AI Model: " + filename);
            request.setDescription("TruNotes AI Assist");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.addRequestHeader("User-Agent", "TruNotes/1.0");
            
            // Save to app-specific external files directory
            File downloadDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
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
        
        File file = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
        boolean exists = file.exists();
        long size = exists ? file.length() : 0;
        
        JSObject ret = new JSObject();
        ret.put("path", file.getAbsolutePath());
        ret.put("exists", exists);
        ret.put("size", size);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        long downloadId = call.getInt("downloadId").longValue();
        DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        
        android.database.Cursor cursor = downloadManager.query(query);
        if (cursor.moveToFirst()) {
            int bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            int bytesTotalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
            
            long bytesDownloaded = cursor.getInt(bytesDownloadedIdx);
            long bytesTotal = cursor.getInt(bytesTotalIdx);
            int status = cursor.getInt(statusIdx);
                int reason = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_REASON));
                String localUri = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));

                double progress = 0;
                if (bytesTotal > 0) {
                    progress = ((double) bytesDownloaded / bytesTotal);
                }

                JSObject ret = new JSObject();
                ret.put("progress", progress);
                ret.put("status", status);
                ret.put("reason", reason);
                ret.put("path", localUri);
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

        int nPredict = call.getInt("n_predict", 512);
        float temperature = call.getFloat("temperature", 0.7f);
        int topK = call.getInt("top_k", 40);
        float topP = call.getFloat("top_p", 0.9f);
        float penalty = call.getFloat("penalty", 1.1f);

        // Call native code for actual AI generation
        new Thread(() -> {
            try {
                // nativeGenerate now calls back onNativeToken for real-time streaming
                String fullResponse = nativeGenerate(prompt, nPredict, temperature, topK, topP, penalty);
                
                // We resolve once correct, maybe pass full text
                JSObject ret = new JSObject();
                ret.put("response", fullResponse);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Generation failed: " + e.getMessage());
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

    private native boolean nativeLoadModel(String filename, boolean useMmap, int nThreads);
    private native String nativeGenerate(String prompt, int nPredict, float temperature, int topK, float topP, float penalty);
    private native void nativeStopGenerate();
    private native void nativeUnloadModel();
}
