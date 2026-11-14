package com.osinttoolkit.app;

import org.junit.Test;
import org.json.*;
import java.io.*;
import java.net.URI;
import java.util.*;
import java.util.concurrent.FutureTask;
import static org.junit.Assert.*;

public class SourceSearchTest {
 private SourceCatalog.Source source(String type,String presence,String absence) throws Exception {
  return new SourceCatalog.Source(new JSONObject().put("name","Fixture").put("url","https://example.org/{username}").put("checkType",type).put("regex","").put("presence",new JSONArray(presence)).put("absence",new JSONArray(absence)));
 }
 @Test public void catalogHas1000UniquePublicHttpsSources() throws Exception {
  try(InputStream input=new FileInputStream(System.getProperty("catalog.path"))){
   SourceCatalog catalog=new SourceCatalog(input);assertEquals(1000,catalog.sites.size());Set<String> hosts=new HashSet<>(),names=new HashSet<>();
   for(SourceCatalog.Source site:catalog.sites){URI uri=new URI(site.url("fixtureuser"));assertEquals("https",uri.getScheme());assertNotNull(site.name,uri.getHost());assertNull(uri.getFragment());assertNull(uri.getUserInfo());assertTrue(names.add(site.name));assertTrue(site.name,hosts.add(uri.getHost().replaceFirst("^www\\.","")));assertTrue(site.checkType.equals("message")||site.checkType.equals("status_code"));}
  }
 }
 @Test public void onlyRegisteredSelectionsAreAccepted() throws Exception {
  try(InputStream input=new FileInputStream(System.getProperty("catalog.path"))){SourceCatalog c=new SourceCatalog(input);assertEquals(2,c.select(new JSONArray("[\"GitHub\",\"GitHub\",\"GitLab\"]")).size());
   try{c.select(new JSONArray("[\"https://localhost\"]"));fail();}catch(IllegalArgumentException expected){}
   try{c.select(new JSONArray());fail();}catch(IllegalArgumentException expected){}
  }
 }
 @Test public void urlInjectionAndDotSegmentsAreRejected() throws Exception {
  SourceCatalog.Source s=source("status_code","[]","[]");
  for(String name:new String[]{"../admin","..",".","a?b","a#b","a b","a@b"})try{s.url(name);fail(name);}catch(IllegalArgumentException expected){}
  assertEquals("https://example.org/test_user-1",s.url("test_user-1"));
 }
 @Test public void redirectsAndBlocksAreUnknownRatherThanMissing() throws Exception {
  SourceCatalog.Source s=source("status_code","[]","[]");
  for(int code:new int[]{301,302,307,401,403,429,500,503})assertEquals("unknown",ProfileChecker.classify(s,code,"",false,"x"));
  assertEquals("not_found",ProfileChecker.classify(s,404,"",false,"x"));assertEquals("candidate",ProfileChecker.classify(s,200,"profile",false,"x"));
 }
 @Test public void softMissingMarkerWinsOverPresence() throws Exception {
  SourceCatalog.Source s=source("message","[\"profile-name\",\"display-name\"]","[\"no such account\"]");
  assertEquals("not_found",ProfileChecker.classify(s,200,"profile-name no such account",false,"x"));
  assertEquals("candidate",ProfileChecker.classify(s,200,"display-name",false,"x"));
  assertEquals("unknown",ProfileChecker.classify(s,200,"generic landing page",false,"x"));
 }
 @Test public void challengePagesAndTruncatedAbsenceOnlyPagesStayUnknown() throws Exception {
  SourceCatalog.Source status=source("status_code","[]","[]");assertEquals("unknown",ProfileChecker.classify(status,200,"<title>Just a moment...</title>",false,"x"));
  SourceCatalog.Source absence=source("message","[]","[\"not found\"]");assertEquals("unknown",ProfileChecker.classify(absence,200,"short page",true,"x"));assertEquals("candidate",ProfileChecker.classify(absence,200,"full profile page",false,"x"));
 }
 @Test public void cancellationStopsQueuedChecksAndMakesNoRequest() throws Exception {
  ProfileChecker.Session session=new ProfileChecker.Session();FutureTask<JSONObject> task=new FutureTask<>(()->new JSONObject());session.futures.add(task);session.cancel();assertTrue(task.isCancelled());
  JSONObject result=new ProfileChecker().check(source("status_code","[]","[]"),"fixture",session);assertEquals("unknown",result.getString("state"));assertFalse(result.has("status"));
 }
 @Test public void sourceSpecificUsernamePatternSkipsInvalidFormat() throws Exception {
  JSONObject config=new JSONObject().put("name","Fixture").put("url","https://example.org/{username}").put("checkType","status_code").put("regex","^[0-9]+$");
  JSONObject result=new ProfileChecker().check(new SourceCatalog.Source(config),"letters",new ProfileChecker.Session());assertEquals("unknown",result.getString("state"));assertFalse(result.has("status"));
 }
 @Test public void externalBrowserLinksRejectOtherSchemesAndCredentials() {
  assertEquals("https://github.com/test_user",SourceCatalog.browserUrl("https://github.com/test_user"));
  for(String bad:new String[]{"javascript:alert(1)","file:///etc/passwd","http://example.org/","https://user:pass@example.org/","https://127.0.0.1/","https://a.LOCAL/"})try{SourceCatalog.browserUrl(bad);fail(bad);}catch(IllegalArgumentException expected){}
 }
}
