"""Normalize a pinned Maigret database into 1000 direct HTTPS username checks."""
import argparse, json, re, hashlib, ipaddress
from pathlib import Path
from urllib.parse import urlsplit

p=argparse.ArgumentParser()
p.add_argument('database',type=Path)
p.add_argument('--commit',required=True)
p.add_argument('--audit',type=Path,help='JSONL output from CatalogAudit; untested rules remain manual review')
p.add_argument('--holdout',type=Path,help='Independent runtime audit with fresh random controls')
args=p.parse_args()
raw=args.database.read_bytes()
upstream=json.loads(raw)
assets=Path(__file__).resolve().parents[1]/'app/src/main/assets'
legacy=[('GitHub','https://github.com/{username}','Разработка'),('GitLab','https://gitlab.com/{username}','Разработка'),('Reddit','https://www.reddit.com/user/{username}/','Соцсети'),('Pinterest','https://www.pinterest.com/{username}/','Творчество'),('TikTok','https://www.tiktok.com/@{username}','Медиа')]
sites=[dict(name=n,url=u,category=c,tags=[],checkType='status_code',presence=[],absence=[],regex='') for n,u,c in legacy]
popular=[('Twitch','https://www.twitch.tv/{username}','Медиа'),('Instagram','https://www.instagram.com/{username}/','Соцсети'),('X','https://x.com/{username}','Соцсети'),('VK','https://vk.com/{username}','Соцсети'),('Kick','https://kick.com/{username}','Медиа')]
sites += [dict(name=n,url=u,category=c,tags=[],checkType='status_code',presence=[],absence=[],regex='',manualOnly=n!='Kick') for n,u,c in popular]
hosts={urlsplit(s['url']).hostname.removeprefix('www.') for s in sites}
names={s['name'].casefold() for s in sites}
def category(tags):
    for keys,label in [({'coding','tech'},'Разработка'),({'forum','discussion'},'Форумы'),({'social','dating'},'Соцсети'),({'gaming'},'Игры'),({'video','streaming','music'},'Медиа'),({'art','photo','design'},'Творчество'),({'blog','writing'},'Блоги'),({'education','science','wiki'},'Образование')]:
        if set(tags)&keys:return label
    return 'Другое'
skipped={}
for name,v in sorted(upstream['sites'].items(),key=lambda item:(item[1].get('alexaRank',10**12),item[0].casefold())):
    if len(sites)==1000:break
    if v.get('disabled') or v.get('engine') or v.get('activation') or v.get('urlProbe') or v.get('requestPayload') or v.get('urlSubpath') or v.get('similarSearch') or v.get('ignore403') or v.get('requestHeadOnly'):continue
    if v.get('type','username')!='username' or v.get('requestMethod','GET')!='GET':continue
    if v.get('checkType') not in ('status_code','message'):continue
    if v.get('encoding','utf-8').lower() not in ('utf-8','utf8'):continue
    headers=v.get('headers',{})
    if any(k.lower() not in ('user-agent','accept','accept-language') for k in headers):continue
    url=v.get('url','').replace('{urlMain}',v.get('urlMain','').rstrip('/'))
    if not url.startswith('https://') or '{username}' not in url:continue
    if re.search(r'[{}]',url.replace('{username}','')):continue
    parts=urlsplit(url.replace('{username}','osintusername'))
    host=(parts.hostname or '').removeprefix('www.')
    if parts.fragment or host in ('bit.ly','tinyurl.com','is.gd','t.co','goo.gl','cutt.ly'):continue
    try:ipaddress.ip_address(host);continue
    except ValueError:pass
    if host.endswith(('.local','.localhost','.internal')):continue
    if not host or '.' not in host or parts.username or parts.password or parts.port not in (None,443):continue
    if host in hosts or name.casefold() in names:continue
    if name.strip()!=name or len(name)>100:continue
    presence=v.get('presenseStrs',[])
    absence=v.get('absenceStrs',[])
    if v['checkType']=='message' and not (presence or absence):continue
    regex=v.get('regexCheck','')
    if '(?P' in regex or '\\U' in regex or len(regex)>500:continue
    tags=v.get('tags',[])
    sites.append(dict(name=name,url=url,category=category(tags),tags=tags,checkType=v['checkType'],presence=presence,absence=absence,regex=regex))
    hosts.add(host);names.add(name.casefold())
assert len(sites)==1000
audit={}
holdout={}
if args.audit:
    audit={r['site']:r for line in args.audit.read_text(encoding='utf-8').splitlines() if (r:=json.loads(line))}
if args.holdout:
    holdout={r['site']:r for line in args.holdout.read_text(encoding='utf-8').splitlines() if (r:=json.loads(line))}
for site in sites:
    row=audit.get(site['name'],{})
    checks=row.get('checks',[])
    # Never transfer a successful audit to another URL or untested rule.
    same_url=all(c.get('url')==site['url'].replace('{username}',c.get('username','')) for c in checks)
    same_rule=row.get('rule')=={k:site[k] for k in ('url','checkType','presence','absence','regex')}
    negatives=[c for c in checks if c.get('control')=='random_absent']
    positives=[c for c in checks if c.get('control')=='upstream_claimed']
    false_positive=any(c.get('state')=='candidate' for c in negatives)
    verified=(same_url and same_rule and len(negatives)==2 and all(c.get('state')=='not_found' for c in negatives)
              and len(positives)==1 and positives[0].get('state')=='candidate' and positives[0].get('status')==200)
    if args.holdout:
        second=holdout.get(site['name'],{})
        second_neg=[c for c in second.get('checks',[]) if c.get('control')=='random_absent']
        second_pos=[c for c in second.get('checks',[]) if c.get('control')=='upstream_claimed']
        verified=verified and second.get('rule')==row.get('rule') and len(second_neg)==2 and all(c.get('state')=='not_found' for c in second_neg) and len(second_pos)==1 and second_pos[0].get('evidence')=='differential_profile'
    site['verified']=bool(verified and not site.get('manualOnly'))
    if false_positive:site['manualOnly']=True
    site['audit']=('verified' if site['verified'] else 'false_positive' if false_positive else 'manual' if site.get('manualOnly') else 'inconclusive')
    site['manualOnly']=not site['verified']
    if row:site['auditedAt']=row['time']
catalog=dict(version=1,count=len(sites),upstream='https://github.com/soxoj/maigret',commit=args.commit,sha256=hashlib.sha256(raw).hexdigest(),sites=sites)
(assets/'source-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
public=dict(count=1000,commit=args.commit,sites=[{k:s[k] for k in ('name','category','tags','verified','audit')} for s in sites])
(assets/'source-catalog.js').write_text('window.OSINT_SOURCE_CATALOG = '+json.dumps(public,ensure_ascii=True,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')+';\n',encoding='utf-8')
print('Imported',len(sites),'sources;',len(hosts),'distinct hosts')
print('Categories:',{c:sum(s['category']==c for s in sites) for c in sorted({s['category'] for s in sites})})
