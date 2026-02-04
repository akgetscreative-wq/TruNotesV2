package com.trunotes.v2;

import com.getcapacitor.BridgeActivity;

import android.content.Intent;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.hasExtra("view")) {
            String view = intent.getStringExtra("view");
            WidgetUtils.setString(this, "last_widget_view", view);
        }
        
        // Refresh Activity Stats whenever app is interacted with
        try {
            String stats = ActivityTracker.getUsageStats(this);
            WidgetUtils.setString(this, "android_activity_stats", stats);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            String stats = ActivityTracker.getUsageStats(this);
            WidgetUtils.setString(this, "android_activity_stats", stats);
        } catch (Exception e) {}
    }
}
