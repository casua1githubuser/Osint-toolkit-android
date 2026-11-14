package com.osinttoolkit.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import android.content.ContentValues;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
 private WebView web;
 private SQLiteDatabase db;
 private volatile boolean destroyed;
 private final ExecutorService workers=Executors.newFixedThreadPool(3);
 private static final String[] SITES={"https://github.com/","https://gitlab.com/","https://www.reddit.com/user/","https://www.pinterest.com/","https://www.tiktok.com/@"};
 private static final String[] NAMES={"GitHub","GitLab","Reddit","Pinterest","TikTok"};
 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  db=openOrCreateDatabase("osint.db",MODE_PRIVATE,null);
  db.execSQL("CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,query TEXT,results TEXT,created INTEGER)");
  web=new WebView(this);
  web.setBackgroundColor(0xfff0f2f3);
  WebSettings s=web.getSettings(); s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);s.setAllowContentAccess(false);
  web.addJavascriptInterface(new Bridge(),"NativeOSINT");
  android.widget.FrameLayout root=new android.widget.FrameLayout(this);
  root.setBackgroundColor(0xfff0f2f3);
  root.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));
  setContentView(root);
  // Resize the actual WebView viewport, not its scrolling document padding.
  // Fixed HTML navigation and scrolling content both stay inside system bars.
  if(android.os.Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
  root.setOnApplyWindowInsetsListener((view,insets)->{
   int left,top,right,bottom;
   if(android.os.Build.VERSION.SDK_INT>=30){
    android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars()
     |android.view.WindowInsets.Type.displayCutout());
    android.graphics.Insets keyboard=insets.getInsets(android.view.WindowInsets.Type.ime());
    left=bars.left;top=bars.top;right=bars.right;bottom=Math.max(bars.bottom,keyboard.bottom);
   }else{
    left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();
    right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();
   }
   android.widget.FrameLayout.LayoutParams layout=(android.widget.FrameLayout.LayoutParams)web.getLayoutParams();
   if(layout.leftMargin!=left||layout.topMargin!=top||layout.rightMargin!=right||layout.bottomMargin!=bottom){
    layout.setMargins(left,top,right,bottom);web.setLayoutParams(layout);
   }
   return insets;
  });
  root.requestApplyInsets();
  getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
   |android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR|android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
   |android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
  getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
  getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
  s.setTextZoom(Math.round(getResources().getConfiguration().fontScale*100));
  if(android.os.Build.VERSION.SDK_INT>=33){
   getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
  }
  // Local asset loading without opening an HTTP port.
  web.setWebViewClient(new android.webkit.WebViewClient(){
   @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    String u=r.getUrl().toString();
    if(!u.startsWith("https://appassets.androidplatform.net/assets/"))return blocked();
    String file=u.substring("https://appassets.androidplatform.net/assets/".length());
    String mime;
    switch(file){
     case "index.html":mime="text/html";break;
     case "style.css":mime="text/css";break;
     case "app.js":mime="application/javascript";break;
     case "images/editorial-atlas.png":mime="image/png";break;
     case "images/module-scenes.png":mime="image/png";break;
     case "fonts/IBMPlexSans.ttf":mime="font/ttf";break;
     default:return blocked();
    }
    try{return new android.webkit.WebResourceResponse(mime,"UTF-8",getAssets().open(file));}
    catch(Exception e){return blocked();}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    return !r.getUrl().toString().startsWith("https://appassets.androidplatform.net/assets/index.html#");
   }
  });
  web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
 }
 private void handleBack(){
  if(!destroyed)web.evaluateJavascript("window.appBack && window.appBack()",result->{
   if(!"true".equals(result)&&!destroyed)finish();
  });
 }
 @Override public void onBackPressed(){handleBack();}
 private android.webkit.WebResourceResponse blocked(){
  return new android.webkit.WebResourceResponse("text/plain","UTF-8",404,"Not Found",
   java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
 }
 private void send(String event,JSONObject payload){
  runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window.receiveNative("+JSONObject.quote(event)+","+payload.toString()+")",null);});
 }
 private JSONObject err(Exception e){JSONObject j=new JSONObject();try{j.put("error",e.getClass().getSimpleName()+": "+e.getMessage());}catch(Exception ignored){}return j;}
 private void save(String kind,String query,String result){
  ContentValues v=new ContentValues();v.put("kind",kind);v.put("query",query);v.put("results",result);v.put("created",System.currentTimeMillis());
  synchronized(db){if(db.isOpen())db.insert("history",null,v);}
 }
 private int status(String url) throws Exception {
  HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
  c.setInstanceFollowRedirects(false);c.setConnectTimeout(6500);c.setReadTimeout(6500);
  c.setRequestProperty("User-Agent","Mozilla/5.0 (compatible; OSINTToolkit/0.2)");
  try{return c.getResponseCode();}finally{c.disconnect();}
 }
 public final class Bridge {
  @JavascriptInterface public void search(String name){
   searchSelected(name,new JSONArray(java.util.Arrays.asList(NAMES)).toString());
  }
  @JavascriptInterface public void searchSelected(String name,String selectedJson){
   if(destroyed)return;
   if(name==null||!name.matches("[A-Za-z0-9_.-]{1,40}")){send("search",err(new IllegalArgumentException("Ник: 1–40 символов A-Z, 0-9, _ . -")));return;}
   final java.util.Set<String> selected=new java.util.HashSet<>();
   try{
    JSONArray a=new JSONArray(selectedJson);
    for(int i=0;i<a.length();i++){
     String site=a.getString(i);
     if(!java.util.Arrays.asList(NAMES).contains(site))throw new IllegalArgumentException("Неизвестный источник");
     selected.add(site);
    }
    if(selected.isEmpty())throw new IllegalArgumentException("Выберите источник");
   }catch(Exception e){send("search",err(e));return;}
   workers.execute(()->{
    try{
     JSONArray a=new JSONArray();
     for(int i=0;i<SITES.length;i++){
      if(!selected.contains(NAMES[i]))continue;
      JSONObject o=new JSONObject();o.put("site",NAMES[i]);o.put("url",SITES[i]+name);
      try{
       int code=status(SITES[i]+name);
       o.put("status",code);
       // HTTP 200 is only a candidate: many sites return soft-404 or anti-bot pages.
       o.put("state",code==404?"not_found":(code==200?"candidate":"unknown"));
      }catch(Exception e){o.put("state","unknown");o.put("detail",e.getClass().getSimpleName());}
      a.put(o);
     }
     JSONObject result=new JSONObject();result.put("query",name);result.put("items",a);
     save("username",name,result.toString());send("search",result);
    }catch(Exception e){send("search",err(e));}
   });
  }
  @JavascriptInterface public void dns(String domain){
   if(destroyed)return;
   if(domain==null||!domain.matches("(?i)(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")){send("dns",err(new IllegalArgumentException("Неверный домен")));return;}
   workers.execute(()->{
    try{
     JSONArray addresses=new JSONArray();
     for(InetAddress ip:InetAddress.getAllByName(domain))addresses.put(ip.getHostAddress());
     JSONObject o=new JSONObject();o.put("domain",domain);o.put("addresses",addresses);
     save("dns",domain,o.toString());send("dns",o);
    }catch(Exception e){send("dns",err(e));}
   });
  }
  @JavascriptInterface public void history(){
   if(destroyed)return;
   workers.execute(()->{
    JSONArray a=new JSONArray();
    synchronized(db){
     if(!db.isOpen())return;
     try(Cursor c=db.rawQuery("SELECT kind,query,results,created FROM history ORDER BY id DESC LIMIT 30",null)){
      while(c.moveToNext()){JSONObject o=new JSONObject();try{
       o.put("kind",c.getString(0));o.put("query",c.getString(1));o.put("result",new JSONObject(c.getString(2)));o.put("created",c.getLong(3));
      }catch(Exception ignored){}a.put(o);}
     }
    }
    JSONObject o=new JSONObject();try{o.put("items",a);}catch(Exception ignored){}send("history",o);
   });
  }
 }
 @Override protected void onDestroy(){destroyed=true;workers.shutdownNow();if(db!=null){synchronized(db){db.close();}}if(web!=null)web.destroy();super.onDestroy();}
}
