# Korean PDF font

`NotoSansKR-Regular.ttf` is a static weight-400 instance of Google Fonts'
Noto Sans KR variable TrueType font. It was generated using fontTools 4.68.0:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('NotoSansKR-variable.ttf')
instantiateVariableFont(font, {'wght': 400}, inplace=True)
font.save('NotoSansKR-Regular.ttf')
```

Source: https://github.com/google/fonts/tree/main/ofl/notosanskr
License: `NotoSansKR-OFL.txt` (SIL Open Font License).
The server embeds the static font in full to preserve Korean glyph rendering.
An A4 summary PDF is approximately 3.1 MB. Source variable/CJK OTF fonts are
development references and excluded from Vercel uploads.
