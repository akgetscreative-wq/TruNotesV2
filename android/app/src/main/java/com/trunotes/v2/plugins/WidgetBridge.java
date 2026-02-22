package com.trunotes.v2.plugins;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.trunotes.v2.TodoWidget;
import com.trunotes.v2.HourlyWidget;
import com.trunotes.v2.R;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    private static final String TAG = "WidgetBridge";

    @PluginMethod
    public void refreshWidgets(PluginCall call) {
        try {
            Context context = getContext();
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);

            // 1. Refresh TodoWidget
            ComponentName todoComponent = new ComponentName(context, TodoWidget.class);
            int[] todoIds = mgr.getAppWidgetIds(todoComponent);
            if (todoIds.length > 0) {
                // Notify the ListView adapter to reload data from SharedPreferences
                mgr.notifyAppWidgetViewDataChanged(todoIds, R.id.todo_list);
                
                // Also send a full update broadcast
                Intent todoIntent = new Intent(context, TodoWidget.class);
                todoIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                todoIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, todoIds);
                context.sendBroadcast(todoIntent);
                
                Log.d(TAG, "Refreshed " + todoIds.length + " TodoWidget(s)");
            }

            // 2. Refresh HourlyWidget
            ComponentName hourlyComponent = new ComponentName(context, HourlyWidget.class);
            int[] hourlyIds = mgr.getAppWidgetIds(hourlyComponent);
            if (hourlyIds.length > 0) {
                Intent hourlyIntent = new Intent(context, HourlyWidget.class);
                hourlyIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                hourlyIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, hourlyIds);
                context.sendBroadcast(hourlyIntent);
                
                Log.d(TAG, "Refreshed " + hourlyIds.length + " HourlyWidget(s)");
            }

            JSObject ret = new JSObject();
            ret.put("refreshed", true);
            ret.put("todoWidgets", todoIds.length);
            ret.put("hourlyWidgets", hourlyIds.length);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to refresh widgets", e);
            call.reject("Widget refresh failed: " + e.getMessage());
        }
    }
}
