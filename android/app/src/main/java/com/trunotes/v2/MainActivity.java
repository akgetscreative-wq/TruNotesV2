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
import com.trunotes.v2.plugins.BackgroundVoiceAIPlugin;
import com.trunotes.v2.plugins.WidgetBridge;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the AIBridge plugin
        registerPlugin(AIBridge.class);
        registerPlugin(BackgroundVoiceAIPlugin.class);
        registerPlugin(WidgetBridge.class);
        
        super.onCreate(savedInstanceState);
        
        // Enable Edge-to-Edge
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }

        // Fix white flash when keyboard opens:
        // Set the root view and window background to dark navy so no white
        // gap is visible while Android animates the keyboard into position.
        int darkBg = Color.parseColor("#0f172a");
        window.getDecorView().setBackgroundColor(darkBg);
        window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(darkBg));
        
        // Also set the WebView background once it's ready
        getBridge().getWebView().setBackgroundColor(darkBg);

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
