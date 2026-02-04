package com.trunotes.v2;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class WidgetUtils {
    // Capacitor Preferences storage name
    private static final String PREFS_NAME = "CapacitorStorage";

    public static String getString(Context context, String key) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        // Try prefixed first (Capacitor default)
        String value = prefs.getString("_cap_" + key, null);
        if (value == null) {
            // Fallback to raw key
            value = prefs.getString(key, null);
        }
        return value;
    }

    public static void setString(Context context, String key, String value) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        // We set both to be safe, but primarily the prefixed one
        prefs.edit()
            .putString("_cap_" + key, value)
            .putString(key, value)
            .apply();
    }

    public static List<JSONObject> getTodos(Context context) {
        List<JSONObject> list = new ArrayList<>();
        try {
            String json = getString(context, "widget_todos");
            if (json != null) {
                JSONArray array = new JSONArray(json);
                for (int i = 0; i < array.length(); i++) {
                    list.add(array.getJSONObject(i));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static JSONObject getHourlyLogs(Context context) {
        try {
            String json = getString(context, "widget_hourly");
            if (json != null) {
                return new JSONObject(json);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new JSONObject();
    }
}
