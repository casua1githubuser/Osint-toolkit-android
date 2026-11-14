package com.osinttoolkit.app;

import java.io.*;
import java.net.*;
import java.nio.charset.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.GZIPInputStream;
import org.json.*;

public final class ProfileChecker {
 public static final int BODY_LIMIT=131072;
 public static final class Session {
  public final AtomicBoolean cancelled=new AtomicBoolean();
  final Set<HttpURLConnection> connections=ConcurrentHashMap.newKeySet();
  final List<Future<JSONObject>> futures=new CopyOnWriteArrayList<>();
  public void cancel(){cancelled.set(true);for(HttpURLConnection c:connections)c.disconnect();for(Future<?> f:futures)f.cancel(true);}
 }
 public static String classify(SourceCatalog.Source source,int code,String body,boolean truncated,String username) {
  if(code==404||code==410)return "not_found";
  if(code<200||code>=300)return "unknown";
  String lower=body.toLowerCase(Locale.ROOT);
  for(String marker:new String[]{"<title>just a moment","cf-chl-","attention required! | cloudflare","<title>sign in","<title>log in","<title>login","please verify you are a human"})if(lower.contains(marker))return "unknown";
  if("status_code".equals(source.checkType))return "candidate";
  for(String marker:source.absence)if(body.contains(marker.replace("{username}",username)))return "not_found";
  if(!source.presence.isEmpty()){
   for(String marker:source.presence)if(body.contains(marker.replace("{username}",username)))return "candidate";
   return "unknown";
  }
  return !truncated&&!source.absence.isEmpty()?"candidate":"unknown";
 }
 public JSONObject check(SourceCatalog.Source source,String username,Session session) throws JSONException {
  JSONObject result=new JSONObject().put("site",source.name).put("url",source.url(username));
  if(session.cancelled.get())return result.put("state","unknown").put("detail","Проверка остановлена");
  if(source.usernamePattern!=null&&!source.usernamePattern.matcher(username).find())return result.put("state","unknown").put("detail","Формат никнейма не подходит этому источнику");
  HttpURLConnection connection=null;
  try {
   URL url=new URL(source.url(username));
   for(InetAddress address:InetAddress.getAllByName(url.getHost())){
    byte[] bytes=address.getAddress();
    if(address.isAnyLocalAddress()||address.isLoopbackAddress()||address.isLinkLocalAddress()||address.isSiteLocalAddress()||address.isMulticastAddress()||(bytes.length==16&&(bytes[0]&0xfe)==0xfc))throw new IOException("Non-public host");
   }
   connection=(HttpURLConnection)url.openConnection();session.connections.add(connection);
   connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(4000);connection.setReadTimeout(4000);
   connection.setRequestProperty("User-Agent","OSINTToolkit/0.11 (public profile checks)");
   connection.setRequestProperty("Accept","text/html,application/json;q=0.9,*/*;q=0.8");connection.setRequestProperty("Accept-Encoding","identity");
   if(session.cancelled.get())throw new InterruptedIOException("Cancelled");
   int code=connection.getResponseCode();result.put("status",code);
   String body="";boolean truncated=false;
   if(code>=200&&code<300){
    Charset charset=StandardCharsets.UTF_8;String type=connection.getContentType();
    if(type!=null){java.util.regex.Matcher match=java.util.regex.Pattern.compile("charset=[\\\"']?([^;\\s\\\"']+)",java.util.regex.Pattern.CASE_INSENSITIVE).matcher(type);if(match.find())try{charset=Charset.forName(match.group(1));}catch(Exception ignored){}}
    try(InputStream raw=connection.getInputStream();InputStream input="gzip".equalsIgnoreCase(connection.getContentEncoding())?new GZIPInputStream(raw):raw;ByteArrayOutputStream output=new ByteArrayOutputStream()){
     byte[] buffer=new byte[4096];int size;int limit=source.checkType.equals("status_code")?16384:BODY_LIMIT;long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
     while(output.size()<=limit&&(size=input.read(buffer,0,Math.min(buffer.length,limit+1-output.size())))!=-1){
      if(session.cancelled.get()||System.nanoTime()>deadline)throw new InterruptedIOException("Cancelled or body deadline");output.write(buffer,0,size);
     }
     byte[] bytes=output.toByteArray();truncated=bytes.length>limit;body=new String(bytes,0,Math.min(bytes.length,limit),charset);
    }
   }
   String state=classify(source,code,body,truncated,username);result.put("state",state);
   result.put("evidence",state.equals("candidate")?(source.checkType.equals("message")&&!source.presence.isEmpty()?"presence_marker":source.checkType.equals("message")?"absence_only":"status_only"):"none");
   result.put("detail",state.equals("candidate")?(source.checkType.equals("message")?"Совпали признаки страницы; требуется ручная проверка":"HTTP 2xx; требуется ручная проверка"):state.equals("not_found")?"Страница отсутствует или найден маркер отсутствия":"Редирект, ограничение доступа или недостаточно признаков");
   result.put("checkType",source.checkType);if(truncated)result.put("truncated",true);
  }catch(Exception error){result.put("state","unknown").put("detail",session.cancelled.get()?"Проверка остановлена":error.getClass().getSimpleName());}
  finally{if(connection!=null){session.connections.remove(connection);connection.disconnect();}}
  return result;
 }
}
