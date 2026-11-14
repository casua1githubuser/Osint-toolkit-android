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
css=(assets/'style.css').read_text(encoding='utf-8')
images={}

def collect_image_variable(match):
    name,file=match.groups()
    asset=(assets/file).resolve()
    if not asset.is_relative_to(assets.resolve()):
        raise ValueError('Image is outside the bundle')
    mime=mimetypes.guess_type(file)[0] or 'application/octet-stream'
    images[name]={'mime':mime,'data':base64.b64encode(asset.read_bytes()).decode()}
    # Large data URLs exceed Chromium's custom-property token limit. The loader
    # installs short Blob URLs before the app renders its first screen.
    return f'{name}: none;'

css=re.sub(r'(--[a-z-]*photo):\s*url\([\"\']?([^\"\')]+)[\"\']?\)\s*;',collect_image_variable,css)
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
loader='''(() => {
 const images = '''+json.dumps(images)+''';
 for (const [name, image] of Object.entries(images)) {
  const bytes = Uint8Array.from(atob(image.data), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type:image.mime}));
  document.documentElement.style.setProperty(name, 'url("' + url + '")');
 }
})();
'''
html=html.replace('<script src="app.js"></script>','<script>'+loader+js+'</script>')
assert set(images)=={'--photo','--module-photo','--page-photo'},'All photographic assets must be embedded'
assert 'src="app.js"' not in html and 'href="style.css"' not in html
(output/'OSINT-2002-preview.html').write_text(html,encoding='utf-8')
shutil.copyfile(root/'DESIGN_ASSETS.md',output/'DESIGN_ASSETS.md')
