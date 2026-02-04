package com.trunotes.v2;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.os.Build;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class ActivityTracker {

    public static String getUsageStats(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return "[]";

        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return "[]";

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        long startTime = cal.getTimeInMillis();
        long endTime = System.currentTimeMillis();

        UsageEvents events = usm.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();
        
        JSONArray result = new JSONArray();
        String currentPkg = null;
        long sessionStart = 0;

        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            String pkg = event.getPackageName();
            int type = event.getEventType();

            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (currentPkg != null && sessionStart > 0) {
                    // Close previous session if it was open (shouldn't really happen with MOVE_TO_FOREGROUND but being safe)
                    addSession(result, currentPkg, sessionStart, event.getTimeStamp());
                }
                currentPkg = pkg;
                sessionStart = event.getTimeStamp();
            } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                if (pkg.equals(currentPkg) && sessionStart > 0) {
                    addSession(result, pkg, sessionStart, event.getTimeStamp());
                    currentPkg = null;
                    sessionStart = 0;
                }
            }
        }
        
        // If still in foreground
        if (currentPkg != null && sessionStart > 0) {
            addSession(result, currentPkg, sessionStart, endTime);
        }

        return result.toString();
    }

    private static void addSession(JSONArray arr, String pkg, long start, long end) {
        try {
            if (end - start < 5000) return; // Ignore sessions less than 5 seconds
            
            JSONObject obj = new JSONObject();
            obj.put("id", pkg + "_" + start);
            obj.put("appName", getAppName(pkg));
            obj.put("pkgName", pkg);
            obj.put("startTime", start);
            obj.put("endTime", end);
            obj.put("duration", end - start);
            obj.put("deviceType", "android");
            obj.put("deviceName", Build.MODEL);
            arr.put(obj);
        } catch (Exception e) {}
    }

    private static String getAppName(String pkg) {
        // Simple heuristic for common apps, usually we'd use PackageManager but that's slow on the main thread
        // We'll return the last part of package name as fallback
        if (pkg.contains(".")) {
            String[] parts = pkg.split("\\.");
            String name = parts[parts.length - 1];
            return name.substring(0, 1).toUpperCase() + name.substring(1);
        }
        return pkg;
    }
}
