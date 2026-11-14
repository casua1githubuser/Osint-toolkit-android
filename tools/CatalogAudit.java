import com.osinttoolkit.app.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Live integration audit. Stores classifications, never response bodies or credentials. */
class CatalogAudit {
 public static void main(String[] args) throws Exception {
  SourceCatalog catalog;
  try(InputStream in=new FileInputStream(args[0])){catalog=new SourceCatalog(in);}
  JSONObject fixtures=new JSONObject(Files.readString(Path.of(args[1]),StandardCharsets.UTF_8)).getJSONObject("sites");
  ExecutorService pool=Executors.newFixedThreadPool(24);
  CompletionService<JSONObject> done=new ExecutorCompletionService<>(pool);
  String run=UUID.randomUUID().toString().replace("-","");
  boolean runtime=args.length>3&&args[3].equals("--runtime");
  for(SourceCatalog.Source source:catalog.sites)done.submit(()->{
   JSONArray checks=new JSONArray();
   for(int i=0;i<2;i++){
    String random="qz"+UUID.randomUUID().toString().replace("-","").substring(0,13);
    if(source.usernamePattern!=null&&!source.usernamePattern.matcher(random).find()){
     random=Long.toString(ThreadLocalRandom.current().nextLong(100000000000000L,999999999999999L));
    }
    ProfileChecker checker=new ProfileChecker();ProfileChecker.Session session=new ProfileChecker.Session();
    checks.put((runtime?checker.check(source,random,session):checker.probe(source,random,session)).put("control","random_absent").put("username",random));
   }
   JSONObject fixture=fixtures.optJSONObject(source.name);
   String claimed=source.name.equals("Twitch")?"twitch":fixture==null?"":fixture.optString("usernameClaimed","");
   if(!claimed.isEmpty()&&claimed.matches("[A-Za-z0-9_.-]{1,40}")&&!claimed.equals(".")&&!claimed.equals("..")){
    ProfileChecker checker=new ProfileChecker();ProfileChecker.Session session=new ProfileChecker.Session();
    checks.put((runtime?checker.check(source,claimed,session):checker.probe(source,claimed,session)).put("control","upstream_claimed").put("username",claimed));
   }
   JSONObject rule=new JSONObject().put("url",source.template).put("checkType",source.checkType).put("presence",source.presence).put("absence",source.absence).put("regex",source.usernamePattern==null?"":source.usernamePattern.pattern());
   return new JSONObject().put("site",source.name).put("checks",checks).put("time",Instant.now().toString()).put("run",run).put("rule",rule).put("mode",runtime?"runtime":"probe");
  });
  int suspicious=0;
  try(BufferedWriter out=Files.newBufferedWriter(Path.of(args[2]),StandardCharsets.UTF_8)){
   for(int i=1;i<=catalog.sites.size();i++){
    JSONObject row=done.take().get();out.write(row.toString());out.newLine();out.flush();
    JSONArray checks=row.getJSONArray("checks");
    for(int j=0;j<checks.length();j++){JSONObject c=checks.getJSONObject(j);if(c.getString("control").equals("random_absent")&&c.optString("state").equals("candidate")){suspicious++;break;}}
    if(i%25==0)System.out.println(i+"/"+catalog.sites.size()+" sources; random-name candidates: "+suspicious);
   }
  }finally{pool.shutdownNow();}
  System.out.println("Completed "+Instant.now());
 }
}
