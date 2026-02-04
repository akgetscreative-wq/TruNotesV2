package com.trunotes.v2;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.Calendar;

public class HourlyWidget extends AppWidgetProvider {

    private static int currentBrowsedHour = -1; // -1 means actual current hour

    public static final String ACTION_PREV = "com.trunotes.v2.ACTION_PREV";
    public static final String ACTION_NEXT = "com.trunotes.v2.ACTION_NEXT";

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hourly);

        int hourToShow = currentBrowsedHour;
        if (hourToShow == -1) {
            hourToShow = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        }

        String hourLabel = String.format("%02d:00 - %02d:00", hourToShow, (hourToShow + 1) % 24);
        views.setTextViewText(R.id.log_hour, hourLabel);

        try {
            JSONObject logs = WidgetUtils.getHourlyLogs(context);
            String content = logs.optString(String.valueOf(hourToShow), "No log for this hour yet...");
            views.setTextViewText(R.id.log_content, content);
        } catch (Exception e) {
            views.setTextViewText(R.id.log_content, "Error loading logs");
        }

        // Intents for navigation
        Intent prev = new Intent(context, HourlyWidget.class).setAction(ACTION_PREV);
        views.setOnClickPendingIntent(R.id.btn_prev_hour, PendingIntent.getBroadcast(context, 10, prev, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));

        Intent next = new Intent(context, HourlyWidget.class).setAction(ACTION_NEXT);
        views.setOnClickPendingIntent(R.id.btn_next_hour, PendingIntent.getBroadcast(context, 11, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));

        // Edit button
        Intent editIntent = new Intent(context, QuickEditActivity.class);
        editIntent.putExtra("type", "hourly");
        editIntent.putExtra("hour", hourToShow);
        editIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        views.setOnClickPendingIntent(R.id.btn_edit_log, PendingIntent.getActivity(context, 12, editIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));

        // Redirect to app on header click
        Intent openAppIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openAppIntent != null) {
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openAppIntent.putExtra("view", "dashboard"); // Hourly is on dashboard in app
            PendingIntent openAppPI = PendingIntent.getActivity(context, 13, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            views.setOnClickPendingIntent(R.id.nav_header, openAppPI);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        int hour = currentBrowsedHour;
        if (hour == -1) hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);

        if (ACTION_PREV.equals(intent.getAction())) {
            currentBrowsedHour = (hour - 1 + 24) % 24;
        } else if (ACTION_NEXT.equals(intent.getAction())) {
            currentBrowsedHour = (hour + 1) % 24;
        } else {
            return;
        }

        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, HourlyWidget.class);
        onUpdate(context, mgr, mgr.getAppWidgetIds(cn));
    }
}
