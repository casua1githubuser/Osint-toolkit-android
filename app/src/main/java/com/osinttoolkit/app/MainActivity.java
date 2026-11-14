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
 private final ExecutorService sourceWorkers=Executors.newFixedThreadPool(8);
 private final Object searchLock=new Object();
 private volatile ProfileChecker.Session activeSearch;
 private SourceCatalog catalog;
 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  try(InputStream input=getAssets().open("source-catalog.json")){catalog=new SourceCatalog(input);}
  catch(Exception error){throw new IllegalStateException("Invalid bundled source catalog",error);}
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
   // Insets are already represented by the viewport margins; do not let the
   // WebView apply the same safe-area values to its HTML document a second time.
   if(android.os.Build.VERSION.SDK_INT>=30)return android.view.WindowInsets.CONSUMED;
   android.view.WindowInsets handled=insets.consumeSystemWindowInsets();
   if(android.os.Build.VERSION.SDK_INT>=28)handled=handled.consumeDisplayCutout();
   return handled;
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
     case "source-catalog.js":mime="application/javascript";break;
     case "images/editorial-atlas.png":mime="image/png";break;
     case "images/module-scenes.png":mime="image/png";break;
     case "images/page-scenes.png":mime="image/png";break;
     case "fonts/IBMPlexSans.ttf":mime="font/ttf";break;
     case "fonts/Unbounded.ttf":mime="font/ttf";break;
     case "fonts/Jura.ttf":mime="font/ttf";break;
     case "fonts/OSINTWide-Regular.ttf":mime="font/ttf";break;
     case "fonts/OSINTWide-Bold.ttf":mime="font/ttf";break;
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
 private void runSearch(String username,java.util.List<SourceCatalog.Source> selected,ProfileChecker.Session session){
  java.util.Map<String,JSONObject> found=new java.util.HashMap<>();
  java.util.concurrent.CompletionService<JSONObject> completed=new java.util.concurrent.ExecutorCompletionService<>(sourceWorkers);
  try{
   ProfileChecker checker=new ProfileChecker();
   for(SourceCatalog.Source source:selected){if(session.cancelled.get())break;session.futures.add(completed.submit(()->checker.check(source,username,session)));}
   long lastUpdate=0;
   while(found.size()<session.futures.size()&&!session.cancelled.get()){
    java.util.concurrent.Future<JSONObject> next=completed.poll(200,java.util.concurrent.TimeUnit.MILLISECONDS);if(next==null)continue;
    if(session.cancelled.get())break; JSONObject item;try{item=next.get();}catch(java.util.concurrent.CancellationException cancelled){if(session.cancelled.get())break;else continue;}if(session.cancelled.get())break;found.put(item.getString("site"),item);
    long now=System.nanoTime();
    if(found.size()%8==0||now-lastUpdate>250_000_000L){send("searchProgress",new JSONObject().put("completed",found.size()).put("total",selected.size()));lastUpdate=now;}
   }
   JSONArray items=new JSONArray();for(SourceCatalog.Source source:selected)if(found.containsKey(source.name))items.put(found.get(source.name));
   JSONObject result=new JSONObject().put("query",username).put("items",items).put("total",selected.size()).put("completed",items.length()).put("cancelled",session.cancelled.get());
   save("username",username,result.toString());send("search",result);
  }catch(Exception error){if(!destroyed)send("search",err(error));}
  finally{session.cancel();synchronized(searchLock){if(activeSearch==session)activeSearch=null;}}
 }
 public final class Bridge {
  @JavascriptInterface public void openUrl(String address){
   final String url;
   try{url=SourceCatalog.browserUrl(address);}catch(Exception error){return;}
   runOnUiThread(()->{if(destroyed)return;try{
    android.content.Intent probe=new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("https://example.org"));probe.addCategory(android.content.Intent.CATEGORY_BROWSABLE);
    android.content.pm.PackageManager packages=getPackageManager();
    java.util.List<android.content.Intent> targets=new java.util.ArrayList<>();java.util.Set<String> seen=new java.util.HashSet<>();
    android.content.pm.ResolveInfo preferred=packages.resolveActivity(probe,android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
    for(android.content.pm.ResolveInfo info:packages.queryIntentActivities(probe,android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)){
     String pkg=info.activityInfo.packageName;if(!seen.add(pkg))continue;
     android.content.Intent target=new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(url));target.addCategory(android.content.Intent.CATEGORY_BROWSABLE);target.setPackage(pkg);
     if(preferred!=null&&pkg.equals(preferred.activityInfo.packageName)){startActivity(target);return;}targets.add(target);
    }
    if(targets.isEmpty())throw new android.content.ActivityNotFoundException();
    if(targets.size()==1){startActivity(targets.get(0));return;}
    android.content.Intent chooser=android.content.Intent.createChooser(targets.remove(0),"Открыть в браузере");chooser.putExtra(android.content.Intent.EXTRA_INITIAL_INTENTS,targets.toArray(new android.content.Intent[0]));startActivity(chooser);
   }catch(android.content.ActivityNotFoundException error){android.widget.Toast.makeText(MainActivity.this,"Браузер не найден",android.widget.Toast.LENGTH_SHORT).show();}});
  }
  @JavascriptInterface public void search(String name){
   JSONArray names=new JSONArray();for(SourceCatalog.Source site:catalog.sites)names.put(site.name);searchSelected(name,names.toString());
  }
  @JavascriptInterface public void searchSelected(String name,String selectedJson){
   if(destroyed)return;
   if(name==null||(!name.matches("[A-Za-z0-9_.-]{1,40}")||name.equals(".")||name.equals(".."))){send("search",err(new IllegalArgumentException("Ник: 1–40 символов A-Z, 0-9, _ . -")));return;}
   final java.util.List<SourceCatalog.Source> selected;
   try{selected=catalog.select(new JSONArray(selectedJson));}catch(Exception error){send("search",err(error));return;}
   ProfileChecker.Session session=new ProfileChecker.Session();
   synchronized(searchLock){if(activeSearch!=null)return;activeSearch=session;}
   try{workers.execute(()->runSearch(name,selected,session));}
   catch(java.util.concurrent.RejectedExecutionException error){synchronized(searchLock){if(activeSearch==session)activeSearch=null;}}
  }
  @JavascriptInterface public void cancelSearch(){ProfileChecker.Session session=activeSearch;if(session!=null)session.cancel();}
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
    JSONArray entries=new JSONArray();
    synchronized(db){
     if(!db.isOpen())return;
     try(Cursor cursor=db.rawQuery("SELECT id,kind,query,results,created FROM history ORDER BY id DESC LIMIT 30",null)){
      while(cursor.moveToNext())try{
       JSONObject result=new JSONObject(cursor.getString(3));JSONArray items=result.optJSONArray("items");
       entries.put(new JSONObject().put("id",cursor.getInt(0)).put("kind",cursor.getString(1)).put("query",cursor.getString(2)).put("created",cursor.getLong(4)).put("count",items==null?0:items.length()).put("cancelled",result.optBoolean("cancelled",false)));
      }catch(Exception ignored){}
     }
    }
    try{send("history",new JSONObject().put("items",entries));}catch(Exception error){send("history",err(error));}
   });
  }
  @JavascriptInterface public void historyEntry(int id){
   if(destroyed)return;
   workers.execute(()->{
    synchronized(db){
     if(!db.isOpen())return;
     try(Cursor cursor=db.rawQuery("SELECT kind,results FROM history WHERE id=?",new String[]{String.valueOf(id)})){
      if(!cursor.moveToFirst())throw new IllegalArgumentException("Запись истории не найдена");
      send("historyEntry",new JSONObject().put("id",id).put("kind",cursor.getString(0)).put("result",new JSONObject(cursor.getString(1))));
     }catch(Exception error){send("historyEntry",err(error));}
    }
   });
  }

 }
 @Override protected void onDestroy(){destroyed=true;if(activeSearch!=null)activeSearch.cancel();sourceWorkers.shutdownNow();workers.shutdownNow();if(db!=null){synchronized(db){db.close();}}if(web!=null)web.destroy();super.onDestroy();}
}
