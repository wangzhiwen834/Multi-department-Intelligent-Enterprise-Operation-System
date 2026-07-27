# 按《中国商论》模板生成 DOCX - 分步构建
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
import os

doc = Document()
style = doc.styles['Normal']
style.font.name = '宋体'
style.font.size = Pt(12)
style._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
style.paragraph_format.line_spacing = Pt(20)

for name, size in [('Heading 1', Pt(16)), ('Heading 2', Pt(14)), ('Heading 3', Pt(12))]:
    h = doc.styles[name]
    h.font.size = size; h.font.bold = True; h.font.color.rgb = RGBColor(0,0,0)
    h._element.rPr.rFonts.set(qn('w:eastAsia'), '黑体')
    h.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
    h.paragraph_format.line_spacing = Pt(20)

out = 'docs/论文-中国商论版.docx'
doc.save(out)
print('ok:', out)
