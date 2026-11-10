package com.magodosjogos.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** A app corre em HTML (assets/index.html). Esta classe só guarda e instala os APK que a página cria. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF1A0F3D);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "-");
        if (!n.endsWith(".apk")) n = n + ".apk";
        if (n.length() > 60) n = n.substring(n.length() - 60);
        return n.startsWith(".") ? "jogo" + n : n;
    }

    class Bridge {
        /** Guarda o APK em Transferências e numa cópia interna para o instalador. Devolve onde ficou ("" se falhou). */
        @JavascriptInterface
        public String saveApk(String b64, String name) {
            String file = safeName(name);
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                try (FileOutputStream o = new FileOutputStream(new File(ApkProvider.dir(MainActivity.this), file))) {
                    o.write(data);
                }
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, file);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive");
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Mago dos Jogos");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u != null) {
                        try (OutputStream o = getContentResolver().openOutputStream(u)) {
                            o.write(data);
                        }
                        return "Transferências/Mago dos Jogos/" + file;
                    }
                }
                File d = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (d != null) {
                    d.mkdirs();
                    try (FileOutputStream o = new FileOutputStream(new File(d, file))) {
                        o.write(data);
                    }
                    return "Android/data/" + getPackageName() + "/files/Download/" + file;
                }
                return "app";
            } catch (Exception e) {
                return "";
            }
        }

        /** Abre o instalador do Android para um APK guardado com saveApk. */
        @JavascriptInterface
        public String installApk(String name) {
            final String file = safeName(name);
            if (!new File(ApkProvider.dir(MainActivity.this), file).isFile()) return "missing";
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
                        } catch (Exception ignored) {
                        }
                    }
                });
                return "permission";
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(Uri.parse("content://" + ApkProvider.AUTHORITY + "/" + file), "application/vnd.android.package-archive");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        startActivity(i);
                    } catch (Exception ignored) {
                    }
                }
            });
            return "ok";
        }

        @JavascriptInterface
        public boolean isApp() {
            return true;
        }
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.mdjPause&&window.mdjPause()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.mdjResume&&window.mdjResume()", null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.mdjBack?window.mdjBack():false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) finish();
            }
        });
    }
}
