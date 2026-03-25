package com.trunotes.v2.workers;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

public class VoiceNotesWorker extends Worker {
    private static final String TAG = "VoiceNotesWorker";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String NOTES_KEY = "voice_notes_ai_items";
    private static final String AI_PREFS_NAME = "AI_PREFS";
    private static final String KEY_LAST_MODEL = "last_model_path";

    static {
        try {
            System.loadLibrary("llama-android");
        } catch (UnsatisfiedLinkError error) {
            Log.e(TAG, "Failed to load llama-android", error);
        }
    }

    public VoiceNotesWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        boolean modelLoaded = false;

        try {
            SharedPreferences preferences = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences aiPreferences = getApplicationContext().getSharedPreferences(AI_PREFS_NAME, Context.MODE_PRIVATE);
            String raw = preferences.getString(NOTES_KEY, "[]");
            JSONArray notes = new JSONArray(raw);
            boolean changed = false;

            String modelPath = aiPreferences.getString(KEY_LAST_MODEL, null);
            if (!TextUtils.isEmpty(modelPath)) {
                File file = new File(modelPath);
                if (file.exists()) {
                    try {
                        modelLoaded = nativeLoadModel(modelPath, true, 4, 0, 1280);
                    } catch (Throwable error) {
                        Log.e(TAG, "Failed to load local model for worker", error);
                        modelLoaded = false;
                    }
                }
            }

            for (int index = 0; index < notes.length(); index++) {
                JSONObject note = notes.getJSONObject(index);
                String status = note.optString("status", "queued");
                if ("completed".equals(status)) {
                    continue;
                }

                String transcript = normalizeTranscript(note.optString("transcript", ""));
                if (TextUtils.isEmpty(transcript)) {
                    continue;
                }

                Summary summary = modelLoaded ? summarizeWithQwen(transcript, modelPath) : null;
                if (summary == null) {
                    summary = summarizeFallback(transcript);
                }

                note.put("title", summary.title);
                note.put("summary", summary.summary);
                note.put("excerpt", summary.excerpt);
                note.put("summaryProvider", summary.provider);
                note.put("status", "completed");
                note.put("updatedAt", System.currentTimeMillis());
                changed = true;
            }

            if (changed) {
                preferences.edit().putString(NOTES_KEY, notes.toString()).apply();
            }

            return Result.success();
        } catch (Exception error) {
            Log.e(TAG, "Voice notes worker failed", error);
            return Result.retry();
        } finally {
            if (modelLoaded) {
                try {
                    nativeUnloadModel();
                } catch (Throwable error) {
                    Log.e(TAG, "Failed to unload local model in worker", error);
                }
            }
        }
    }

    private String normalizeTranscript(String transcript) {
        if (transcript == null) return "";
        return transcript.replaceAll("\\s+", " ").trim();
    }

    private Summary summarizeWithQwen(String transcript, String modelPath) {
        try {
            String prompt = wrapPrompt(buildVoiceSummaryPrompt(transcript), modelPath);
            int nPredict = Math.max(220, Math.min(420, (int) Math.ceil(transcript.length() * 0.55)));
            String response = nativeGenerate(prompt, nPredict, 0.25f, 32, 0.88f, 1.12f, 4);

            if (response == null || response.contains("Error:")) {
                return null;
            }

            String json = extractJsonObject(response);
            if (json == null) {
                return null;
            }

            JSONObject parsed = new JSONObject(json);
            String fallbackTitle = buildTitle(transcript);
            String fallbackSummary = shorten(transcript, 180);
            String fallbackExcerpt = shorten(transcript, 120);

            return new Summary(
                normalizeField(parsed.optString("title", ""), fallbackTitle, 80),
                normalizeField(parsed.optString("summary", ""), fallbackSummary, 260),
                normalizeField(parsed.optString("excerpt", ""), fallbackExcerpt, 120),
                "qwen"
            );
        } catch (Exception error) {
            Log.e(TAG, "Qwen summarization failed in worker", error);
            return null;
        }
    }

    private Summary summarizeFallback(String transcript) {
        String[] sentences = transcript.split("(?<=[.!?])\\s+");
        String first = sentences.length > 0 ? sentences[0].trim() : transcript;
        String second = sentences.length > 1 ? sentences[1].trim() : "";
        String combined = (first + " " + second).trim();
        String summary = shorten(combined.isEmpty() ? transcript : combined, 180);
        String excerpt = shorten(combined.isEmpty() ? transcript : combined, 120);
        String title = buildTitle(first.isEmpty() ? transcript : first);
        return new Summary(title, summary, excerpt, "fallback");
    }

    private String buildVoiceSummaryPrompt(String transcript) {
        return "You are summarizing a voice note transcribed from speech to text.\n"
            + "The transcript may contain filler words, repetition, or rough phrasing.\n"
            + "Keep the meaning accurate, remove noise, and make it useful to review later.\n"
            + "Do not invent facts or actions that are not present in the transcript.\n"
            + "Return strict JSON only with this exact schema:\n"
            + "{\"title\":\"string\",\"summary\":\"string\",\"excerpt\":\"string\"}\n"
            + "Rules:\n"
            + "- title: 4 to 8 words, specific and natural.\n"
            + "- summary: 2 to 4 sentences, clean and useful, preserving decisions, plans, reminders, and intent.\n"
            + "- excerpt: one short preview line under 120 characters.\n"
            + "- no markdown, no code fences, no extra keys, no commentary.\n\n"
            + "Transcript:\n"
            + transcript;
    }

    private String wrapPrompt(String prompt, String modelPath) {
        String lowerPath = modelPath == null ? "" : modelPath.toLowerCase();

        if (lowerPath.contains("llama-3")) {
            return "<|start_header_id|>user<|end_header_id|>\n\n" + prompt + "<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>\n\n";
        }

        if (lowerPath.contains("gemma")) {
            return "<start_of_turn>user\n" + prompt + "<end_of_turn>\n<start_of_turn>model\n";
        }

        return "<|im_start|>user\n" + prompt + "<|im_end|>\n<|im_start|>assistant\n";
    }

    private String extractJsonObject(String response) {
        String cleaned = response.replace("```json", "```").replace("```", "").trim();
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start == -1 || end == -1 || end <= start) {
            return null;
        }
        return cleaned.substring(start, end + 1);
    }

    private String normalizeField(String input, String fallback, int maxLength) {
        String picked = TextUtils.isEmpty(input) ? fallback : input.replaceAll("\\s+", " ").trim();
        return shorten(picked, maxLength);
    }

    private String buildTitle(String source) {
        String cleaned = source.replaceAll("[^a-zA-Z0-9\\s]", " ").trim();
        if (cleaned.isEmpty()) {
            return "Voice Note";
        }

        String[] words = cleaned.split("\\s+");
        StringBuilder builder = new StringBuilder();
        int count = Math.min(words.length, 6);
        for (int i = 0; i < count; i++) {
            String word = words[i].toLowerCase();
            if (i == 0 && !word.isEmpty()) {
                word = Character.toUpperCase(word.charAt(0)) + word.substring(1);
            }
            if (builder.length() > 0) builder.append(' ');
            builder.append(word);
        }
        return builder.toString();
    }

    private String shorten(String input, int maxLength) {
        if (input == null) return "";
        if (input.length() <= maxLength) {
            return input;
        }
        return input.substring(0, Math.max(0, maxLength - 1)).trim() + "…";
    }

    private static class Summary {
        final String title;
        final String summary;
        final String excerpt;
        final String provider;

        Summary(String title, String summary, String excerpt, String provider) {
            this.title = title;
            this.summary = summary;
            this.excerpt = excerpt;
            this.provider = provider;
        }
    }

    private native boolean nativeLoadModel(String filename, boolean useMmap, int nThreads, int nGpuLayers, int nCtx);
    private native String nativeGenerate(String prompt, int nPredict, float temperature, int topK, float topP, float penalty, int nThreads);
    private native void nativeUnloadModel();
}
