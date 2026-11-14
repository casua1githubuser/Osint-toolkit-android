"""Build the OFL-licensed OSINT Wide derivative: pip install fonttools==4.60.1."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

FONTS = Path(__file__).resolve().parents[1] / 'app/src/main/assets/fonts'
WIDTH = 1.32

def scale_positioning(value, visited):
    if id(value) in visited:
        return
    visited.add(id(value))
    if isinstance(value, (list, tuple)):
        for child in value:
            scale_positioning(child, visited)
    elif hasattr(value, '__dict__'):
        for key, child in vars(value).items():
            if key in ('XPlacement', 'XAdvance', 'XCoordinate') and isinstance(child, (int, float)):
                setattr(value, key, round(child * WIDTH))
            else:
                scale_positioning(child, visited)

for weight, style in [(400, 'Regular'), (700, 'Bold')]:
    font = instantiateVariableFont(TTFont(FONTS / 'Jura.ttf'), {'wght': weight})
    glyph_set = font.getGlyphSet()
    outlines = {}
    for name in font.getGlyphOrder():
        recording = DecomposingRecordingPen(glyph_set)
        glyph_set[name].draw(recording)
        pen = TTGlyphPen(None)
        recording.replay(TransformPen(pen, (WIDTH, 0, 0, 1, 0, 0)))
        outlines[name] = pen.glyph()
    font['glyf'].glyphs = outlines
    font['hmtx'].metrics = {name: (round(advance * WIDTH), round(lsb * WIDTH))
                            for name, (advance, lsb) in font['hmtx'].metrics.items()}
    for tag in ('GPOS', 'GDEF'):
        if tag in font:
            scale_positioning(font[tag].table, set())
    if 'kern' in font:
        for table in font['kern'].kernTables:
            table.kernTable = {pair: round(value * WIDTH) for pair, value in table.kernTable.items()}
    for tag in ('cvt ', 'fpgm', 'prep', 'gasp', 'DSIG'):
        if tag in font:
            del font[tag]
    font['OS/2'].xAvgCharWidth = round(font['OS/2'].xAvgCharWidth * WIDTH)
    font['OS/2'].usWidthClass = 7
    font['OS/2'].usWeightClass = weight
    font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~0x61) | (0x20 if weight == 700 else 0x40)
    font['head'].macStyle = 1 if weight == 700 else 0
    replacements = {1: 'OSINT Wide', 2: style, 3: f'OSINTWide-{style}-1.0',
                    4: f'OSINT Wide {style}', 6: f'OSINTWide-{style}', 16: 'OSINT Wide', 17: style}
    font['name'].names = [n for n in font['name'].names if n.nameID not in replacements]
    for name_id, text in replacements.items():
        font['name'].setName(text, name_id, 3, 1, 0x409)
    destination = FONTS / f'OSINTWide-{style}.ttf'
    font.save(destination)
    # Verify a real glyph advance increase, Cyrillic coverage and static weights.
    reopened = TTFont(destination)
    assert 'fvar' not in reopened and reopened['OS/2'].usWeightClass == weight
    assert all(ord(c) in reopened.getBestCmap() for c in 'ПОИСКБАЗЫНАСТРОЙКИ')
    print(destination.name, destination.stat().st_size)
