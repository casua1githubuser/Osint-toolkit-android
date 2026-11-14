package com.osinttoolkit.app;

import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

public final class SourceCatalog {
 public static final class Source {
  public final String name,template,checkType;
  public final List<String> presence,absence;
  public final Pattern usernamePattern;
  public Source(JSONObject data) throws JSONException {
   name=data.getString("name");template=data.getString("url");checkType=data.getString("checkType");
   if(!template.startsWith("https://")||!template.contains("{username}"))throw new IllegalArgumentException("Invalid source URL");
   presence=strings(data.optJSONArray("presence"));absence=strings(data.optJSONArray("absence"));
   String regex=data.optString("regex","");usernamePattern=regex.isEmpty()?null:Pattern.compile(regex);
  }
  public String url(String username) {
   if(username==null||!username.matches("[A-Za-z0-9_.-]{1,40}")||username.equals(".")||username.equals(".."))throw new IllegalArgumentException("Invalid username");
   return template.replace("{username}",username);
  }
 }
 public final List<Source> sites;
 private final Map<String,Source> byName=new LinkedHashMap<>();
 public SourceCatalog(InputStream input) throws IOException,JSONException {
  ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
  while((n=input.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>2_000_000)throw new IOException("Catalog too large");}
  JSONObject root=new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));JSONArray entries=root.getJSONArray("sites");
  for(int i=0;i<entries.length();i++){Source source=new Source(entries.getJSONObject(i));if(byName.put(source.name,source)!=null)throw new IllegalArgumentException("Duplicate source");}
  if(byName.size()!=root.getInt("count"))throw new IllegalArgumentException("Catalog count mismatch");
  sites=Collections.unmodifiableList(new ArrayList<>(byName.values()));
 }
 public List<Source> select(JSONArray names) throws JSONException {
  if(names.length()==0||names.length()>sites.size())throw new IllegalArgumentException("Выберите от 1 до "+sites.size()+" источников");
  Set<String> chosen=new HashSet<>();
  for(int i=0;i<names.length();i++){String name=names.getString(i);if(!byName.containsKey(name))throw new IllegalArgumentException("Неизвестный источник: "+name);chosen.add(name);}
  List<Source> result=new ArrayList<>();for(Source site:sites)if(chosen.contains(site.name))result.add(site);return result;
 }
 public static String browserUrl(String address) {
  try {
   java.net.URI uri=new java.net.URI(address);java.net.URL parsed=new java.net.URL(address);String host=parsed.getHost().toLowerCase(Locale.ROOT);
   if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||parsed.getUserInfo()!=null||!host.contains(".")||host.matches("[0-9.]+")||host.endsWith(".local")||host.endsWith(".localhost")||host.endsWith(".internal"))throw new IllegalArgumentException("Invalid browser URL");
   return uri.toASCIIString();
  }catch(Exception error){throw new IllegalArgumentException("Invalid browser URL",error);}
 }
 private static List<String> strings(JSONArray array) throws JSONException {
  List<String> result=new ArrayList<>();if(array!=null)for(int i=0;i<array.length();i++)result.add(array.getString(i));return Collections.unmodifiableList(result);
 }
}
