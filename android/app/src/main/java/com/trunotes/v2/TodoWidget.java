package com.trunotes.v2;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;

public class TodoWidget extends AppWidgetProvider {

    public static final String ACTION_TOGGLE = "com.trunotes.v2.ACTION_TOGGLE";
    public static final String ACTION_ADD = "com.trunotes.v2.ACTION_ADD";

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todo);

        // Set up list view
        Intent serviceIntent = new Intent(context, TodoRemoteViewsService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.todo_list, serviceIntent);
        views.setEmptyView(R.id.todo_list, R.id.empty_view);

        // Template intent for list item clicks
        Intent clickIntent = new Intent(context, TodoWidget.class);
        clickIntent.setAction(ACTION_TOGGLE);
        PendingIntent clickPI = PendingIntent.getBroadcast(context, 0, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        views.setPendingIntentTemplate(R.id.todo_list, clickPI);

        // Add button intent
        Intent addIntent = new Intent(context, QuickEditActivity.class);
        addIntent.putExtra("type", "todo");
        addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent addPI = PendingIntent.getActivity(context, 1, addIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        views.setOnClickPendingIntent(R.id.btn_add_todo, addPI);

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
        if (ACTION_TOGGLE.equals(intent.getAction())) {
            String id = intent.getStringExtra("todo_id");
            boolean target = intent.getBooleanExtra("target_val", false);
            
            toggleTodo(context, id, target);
            
            // Notify managers to refresh
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, TodoWidget.class);
            mgr.notifyAppWidgetViewDataChanged(mgr.getAppWidgetIds(cn), R.id.todo_list);
        }
    }

    private void toggleTodo(Context context, String id, boolean target) {
        try {
            List<JSONObject> todos = WidgetUtils.getTodos(context);
            for (JSONObject todo : todos) {
                if (todo.getString("id").equals(id)) {
                    todo.put("completed", target);
                    todo.put("updatedAt", System.currentTimeMillis());
                    break;
                }
            }
            // Save back
            JSONArray arr = new JSONArray();
            for (JSONObject t : todos) arr.put(t);
            WidgetUtils.setString(context, "widget_todos", arr.toString());
            
            // OPTIONAL: Mark that a sync is needed when app opens
            WidgetUtils.setString(context, "needs_native_sync", "true");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
