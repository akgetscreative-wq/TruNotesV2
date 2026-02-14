package com.trunotes.v2;

import com.getcapacitor.BridgeActivity;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.trunotes.v2.plugins.AIBridge;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the AIBridge plugin
        registerPlugin(AIBridge.class);
        
        super.onCreate(savedInstanceState);
        
        // Enable Edge-to-Edge
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }

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
    }
}
