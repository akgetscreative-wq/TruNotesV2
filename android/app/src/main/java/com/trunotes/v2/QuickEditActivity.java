package com.trunotes.v2;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;
import java.util.UUID;

public class QuickEditActivity extends Activity {

    private String type;
    private int hour;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Transparent window settings
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        setContentView(R.layout.activity_quick_edit);

        type = getIntent().getStringExtra("type");
        hour = getIntent().getIntExtra("hour", -1);

        TextView titleView = findViewById(R.id.edit_title);
        EditText input = findViewById(R.id.edit_input);
        Button btnSave = findViewById(R.id.btn_save);
        Button btnCancel = findViewById(R.id.btn_cancel);

        if ("todo".equals(type)) {
            titleView.setText("Add Daily Task");
            input.setHint("What needs to be done?");
        } else {
            String hourRange = String.format("%02d:00 - %02d:00", hour, (hour + 1) % 24);
            titleView.setText("Log for " + hourRange);
            
            // Pre-load existing log
            JSONObject logs = WidgetUtils.getHourlyLogs(this);
            input.setText(logs.optString(String.valueOf(hour), ""));
        }

        btnCancel.setOnClickListener(v -> finish());
        btnSave.setOnClickListener(v -> {
            String text = input.getText().toString().trim();
            if (!text.isEmpty()) {
                saveData(text);
                updateWidgets();
            }
            finish();
        });

        // Focus and show keyboard
        input.requestFocus();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
    }

    private void saveData(String text) {
        try {
            if ("todo".equals(type)) {
                List<JSONObject> todos = WidgetUtils.getTodos(this);
                JSONObject newTodo = new JSONObject();
                newTodo.put("id", UUID.randomUUID().toString());
                newTodo.put("text", text);
                newTodo.put("completed", false);
                newTodo.put("createdAt", System.currentTimeMillis());
                newTodo.put("updatedAt", System.currentTimeMillis());
                newTodo.put("targetDate", ""); // Important: Empty string puts it in Backlog/Pending Tasks
                
                // Get today string from JS if possible, or calculate here
                // For simplicity, we assume the app will fix the date on sync
                
                JSONArray arr = new JSONArray();
                arr.put(newTodo); // Prepend new task
                for (JSONObject t : todos) arr.put(t);
                WidgetUtils.setString(this, "widget_todos", arr.toString());
            } else {
                JSONObject logs = WidgetUtils.getHourlyLogs(this);
                logs.put(String.valueOf(hour), text);
                WidgetUtils.setString(this, "widget_hourly", logs.toString());
            }
            WidgetUtils.setString(this, "needs_native_sync", "true");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void updateWidgets() {
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        if ("todo".equals(type)) {
            mgr.notifyAppWidgetViewDataChanged(mgr.getAppWidgetIds(new ComponentName(this, TodoWidget.class)), R.id.todo_list);
        } else {
            ComponentName cn = new ComponentName(this, HourlyWidget.class);
            Intent intent = new Intent(this, HourlyWidget.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, mgr.getAppWidgetIds(cn));
            sendBroadcast(intent);
        }
    }
}
