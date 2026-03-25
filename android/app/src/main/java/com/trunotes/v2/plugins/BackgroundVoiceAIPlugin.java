package com.trunotes.v2.plugins;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.trunotes.v2.workers.VoiceNotesWorker;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackgroundVoiceAI")
public class BackgroundVoiceAIPlugin extends Plugin {
    private static final String UNIQUE_ONE_TIME = "voice_ai_extract_once";
    private static final String UNIQUE_PERIODIC = "voice_ai_extract_periodic";

    @PluginMethod
    public void scheduleProcessing(PluginCall call) {
        enqueueProcessing();

        JSObject result = new JSObject();
        result.put("scheduled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void cancelProcessing(PluginCall call) {
        WorkManager workManager = WorkManager.getInstance(getContext());
        workManager.cancelUniqueWork(UNIQUE_ONE_TIME);
        workManager.cancelUniqueWork(UNIQUE_PERIODIC);

        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    private void enqueueProcessing() {
        Constraints constraints = new Constraints.Builder()
            .setRequiresCharging(true)
            .setRequiresBatteryNotLow(true)
            .build();

        WorkManager workManager = WorkManager.getInstance(getContext());

        OneTimeWorkRequest immediate = new OneTimeWorkRequest.Builder(VoiceNotesWorker.class)
            .setConstraints(constraints)
            .build();

        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(VoiceNotesWorker.class, 1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build();

        workManager.enqueueUniqueWork(UNIQUE_ONE_TIME, ExistingWorkPolicy.REPLACE, immediate);
        workManager.enqueueUniquePeriodicWork(UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, periodic);
    }
}
