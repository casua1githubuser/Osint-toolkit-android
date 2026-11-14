from pathlib import Path
import base64
import re
import shutil
import mimetypes
import json
import sys

root=Path(__file__).resolve().parent.parent
assets=root/'app/src/main/assets'
output=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'build/preview'
output.mkdir(parents=True,exist_ok=True)
html=(assets/'index.html').read_text(encoding='utf-8')
for filename in ['TABLER-LICENSE.txt','MAIGRET-LICENSE.txt']:
    license_file=assets/filename
    if license_file.exists():
        notice=license_file.read_text(encoding='utf-8').replace('--','- -')
        html=html.replace('<head>', '<head>\n<!-- '+filename+'\n'+notice+'\n-->')
css=(assets/'style.css').read_text(encoding='utf-8')
images={}

def collect_image_variable(match):
    name,file=match.groups()
    asset=(assets/file).resolve()
    if not asset.is_relative_to(assets.resolve()):
        raise ValueError('Image is outside the bundle')
    mime=mimetypes.guess_type(file)[0] or 'application/octet-stream'
    images[name]={'mime':mime,'data':base64.b64encode(asset.read_bytes()).decode()}
    return ''

css=re.sub(r'(--[a-z-]*photo):\s*url\([\"\']?([^\"\')]+)[\"\']?\)\s*;',collect_image_variable,css)
groups={name:[] for name in images}
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
def collect_background(match):
    selector,body=match.groups()
    photo=re.search(r'background-image:\s*var\((--[a-z-]*photo)\)\s*;',body)
    if photo:
        groups[photo.group(1)].append(selector.strip())
        body=body[:photo.start()]+body[photo.end():]
    return selector+'{'+body+'}'
css=re.sub(r'([^{}]+)\{([^{}]*)\}',collect_background,css)
for name in ['--photo','--module-photo','--page-photo']:
    image=images[name]
    selectors=','.join(dict.fromkeys(groups[name]))
    css+='\n'+selectors+'{background-image:url("data:'+image['mime']+';base64,'+image['data']+'")}\n'
def embed_asset(match):
    file=match.group(1).strip('"\'')
    if file.startswith('data:'):
        return match.group(0)
    asset=(assets/file).resolve()
    if not asset.is_relative_to(assets.resolve()):
        raise ValueError('Asset is outside the bundle')
    mime=mimetypes.guess_type(file)[0] or 'application/octet-stream'
    data=base64.b64encode(asset.read_bytes()).decode()
    return f'url(data:{mime};base64,{data})'
css=re.sub(r'url\(([^)]+)\)',embed_asset,css)
html=re.sub(r'<link\s+rel="stylesheet"\s+href="style.css"\s*/?>',lambda _: '<style>'+css+'</style>',html)
js=(assets/'app.js').read_text(encoding='utf-8')
catalog_js=(assets/'source-catalog.js').read_text(encoding='utf-8')
html=html.replace('<script src="source-catalog.js"></script>','<script>'+catalog_js+'</script>')
html=html.replace('<script src="app.js"></script>','<script>'+js+'</script>')
assert set(images)=={'--photo','--module-photo','--page-photo'},'All photographic assets must be embedded'
assert 'src="app.js"' not in html and 'href="style.css"' not in html
assert 'URL.createObjectURL' not in html and not re.search(r'var\(--[a-z-]*photo\)',css)
(output/'OSINT-2002-preview.html').write_text(html,encoding='utf-8')
shutil.copyfile(root/'DESIGN_ASSETS.md',output/'DESIGN_ASSETS.md')
