package com.kenyasme.platform;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

/**
 * Draws the app edge to edge on every Android version, so full-screen photos
 * (home, login) run up behind the status bar like the opening splash.
 *
 * Older Android WebViews report env(safe-area-inset-*) as 0, so the real bar
 * heights are also handed to the page as --safe-area-inset-top/bottom; the
 * CSS reads both (see --sat / --sab in index.css). Capacitor's own inset
 * handling is off (SystemBars.insetsHandling = "disable" in capacitor.config).
 */
public class MainActivity extends BridgeActivity {

    private int topDp = 0;
    private int bottomDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // Android 15+ keeps the bars transparent itself
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }

        View decor = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());

            // Only the on-screen keyboard pushes the page up; the bars are drawn over
            view.setPadding(0, 0, 0, keyboard ? ime.bottom : 0);

            float density = getResources().getDisplayMetrics().density;
            topDp = Math.round(bars.top / density);
            bottomDp = keyboard ? 0 : Math.round(bars.bottom / density);
            sendInsetsToPage();
            return insets;
        });

        // A new page (first load, reload) starts without the values: send them again
        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView webView, String url) {
                    sendInsetsToPage();
                }
            }
        );
    }

    private void sendInsetsToPage() {
        if (bridge == null || bridge.getWebView() == null) return;
        String script = String.format(
            Locale.US,
            "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');",
            topDp,
            bottomDp
        );
        WebView webView = bridge.getWebView();
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
