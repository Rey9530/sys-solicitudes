#!/usr/bin/env python3
"""
Genera la plantilla de carga inicial (PLANIFICACION/18-carga-inicial-excel.md)
con 3 filas de EJEMPLO, a partir de la propia plantilla publicada.

    python3 scripts/generar-plantilla-carga-inicial.py [ruta.xlsx]

Por defecto reescribe `frontend/public/plantillas/plantilla-carga-inicial.xlsx`.
Es idempotente: quita las filas >= 4 y la nota de la fila 1, y vuelve a
escribir los ejemplos. Solo usa la biblioteca estándar (el .xlsx es un ZIP de
XML), igual que el formato original del cliente: mismos estilos por columna
(moneda, fechas dd/mm/aaaa, bordes).

Las filas de ejemplo llevan en COMENTARIOS un texto que empieza con «EJEMPLO»:
el importador las ignora (`CARGA_INICIAL_MARCA_EJEMPLO` en @app/contracts).
"""
import datetime
import os
import re
import sys
import zipfile
from xml.sax.saxutils import escape

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = os.path.join(RAIZ, 'frontend', 'public', 'plantillas', 'plantilla-carga-inicial.xlsx')

NOTA = (
    'Las filas 4 a 6 (en amarillo) son EJEMPLOS y se ignoran al importar. '
    'Escribe tus datos debajo o sobre ellas; si reutilizas una fila de ejemplo, '
    'borra la palabra «EJEMPLO» de COMENTARIOS. Fechas en formato dd/mm/aaaa.'
)


def fecha(iso):
    """Serial de Excel (sistema 1900) para una fecha ISO."""
    d = datetime.date.fromisoformat(iso)
    return (d - datetime.date(1899, 12, 30)).days


# Valores: str → texto, int/float → número, ('fecha', iso), ('formula', expr, valor).
EJEMPLOS = [
    {  # 1. Local con inquilino y contrato completo (con fecha de fin)
        'B': 'A', 'C': 1, 'D': 101, 'E': 85.5, 'F': 1234567, 'G': '18-123456-1',
        'J': 'Café del Paseo', 'K': 'CAFÉ DEL PASEO, S.A. DE C.V.',
        'L': 'Ana María López', 'M': '0614-150385-102-3',
        'N': 'facturacion@cafedelpaseo.com.sv', 'O': '2222-3333', 'P': '123456-7',
        'Q': 'Carlos Pérez', 'R': 'Gerente de tienda',
        'S': 'carlos.perez@cafedelpaseo.com.sv', 'T': '7777-8888',
        'U': 'Lucía Martínez', 'V': 'Contadora',
        'W': 'lucia.martinez@cafedelpaseo.com.sv', 'X': '7666-5555',
        'Y': 'MEDIANO', 'Z': 'Venta de café y repostería',
        'AA': 'ALIMENTOS Y BEBIDAS', 'AB': 'CAFETERÍA',
        'AC': 3, 'AD': 85.5, 'AE': 18, 'AF': 3, 'AG': 1539, 'AH': 256.5,
        'AI': ('formula', 'AG4+AH4', 1795.5), 'AJ': 3591,
        'AK': ('fecha', '2025-12-15'), 'AL': ('fecha', '2026-01-01'),
        'AM': ('fecha', '2028-12-31'), 'AN': ('fecha', '2025-12-01'), 'AO': 30,
        'AP': ('fecha', '2026-01-15'), 'AQ': ('fecha', '2028-12-31'),
        'AR': ('fecha', '2028-09-30'),
        'AS': 'Incremento anual del 3 % a partir del segundo año.',
        'AT': 'EJEMPLO (se ignora al importar): local con inquilino y contrato completo.',
    },
    {  # 2. Mismo inquilino en otro local; sin FECHA FIN = contrato indefinido
        'B': 'A', 'C': 1, 'D': 102, 'E': 40, 'F': 1234568,
        'J': 'Café del Paseo Express', 'K': 'CAFÉ DEL PASEO, S.A. DE C.V.',
        'AC': 1, 'AD': 40, 'AE': 20, 'AF': 3, 'AG': 800, 'AH': 120,
        'AI': ('formula', 'AG5+AH5', 920), 'AJ': 1840,
        'AK': ('fecha', '2026-02-20'), 'AL': ('fecha', '2026-03-01'),
        'AN': ('fecha', '2026-02-15'), 'AP': ('fecha', '2026-03-01'),
        'AS': 'Sin incremento durante el primer año.',
        'AT': (
            'EJEMPLO (se ignora al importar): mismo inquilino en un segundo local; '
            'sin FECHA FIN el contrato queda indefinido.'
        ),
    },
    {  # 3. Local disponible (sin inquilino ni contrato)
        'B': 'B', 'C': 2, 'D': 201, 'E': 60, 'F': 1234569, 'G': '18-123457-2',
        'AT': 'EJEMPLO (se ignora al importar): local disponible, sin inquilino ni contrato.',
    },
]

# Estilo base por columna (índices de cellXfs del formato del cliente, fila 4 original).
ESTILO_BASE = {}
for c in ['B', 'C', 'D', 'E', 'J', 'AC', 'AD']:
    ESTILO_BASE[c] = 6  # centrado, borde
for c in ['F', 'G']:
    ESTILO_BASE[c] = 7
for i in range(ord('K'), ord('Z') + 1):
    ESTILO_BASE[chr(i)] = 8  # texto a la izquierda, borde
for c in ['AA', 'AB']:
    ESTILO_BASE[c] = 8
for c in ['AE', 'AF', 'AG']:
    ESTILO_BASE[c] = 9  # moneda
for c in ['AH', 'AI', 'AJ']:
    ESTILO_BASE[c] = 10  # moneda
for c in ['AK', 'AL', 'AM', 'AN', 'AP', 'AQ', 'AR']:
    ESTILO_BASE[c] = 16  # fecha dd/mm/aaaa centrada
ESTILO_BASE['AO'] = 14
ESTILO_BASE['AS'] = 13
ESTILO_BASE['AT'] = 13

COLUMNAS = (
    [chr(i) for i in range(ord('B'), ord('G') + 1)]
    + [chr(i) for i in range(ord('J'), ord('Z') + 1)]
    + ['A' + chr(i) for i in range(ord('A'), ord('T') + 1)]
)

COLOR_EJEMPLO = 'FFFFF2CC'
COLOR_NOTA = 'FF9C5700'


def asegurar_estilos(styles):
    """Añade (si faltan) el relleno amarillo, la fuente de la nota y los xf clonados."""
    fills = re.search(r'<fills count="(\d+)">(.*?)</fills>', styles, flags=re.S)
    lista_fills = re.findall(r'<fill>.*?</fill>', fills.group(2), flags=re.S)
    fill_xml = (
        f'<fill><patternFill patternType="solid"><fgColor rgb="{COLOR_EJEMPLO}"/>'
        '<bgColor indexed="64"/></patternFill></fill>'
    )
    if fill_xml not in lista_fills:
        lista_fills.append(fill_xml)
        styles = styles.replace(
            fills.group(0), f'<fills count="{len(lista_fills)}">{"".join(lista_fills)}</fills>'
        )
    fill_id = lista_fills.index(fill_xml)

    fonts = re.search(r'<fonts count="(\d+)"([^>]*)>(.*?)</fonts>', styles, flags=re.S)
    lista_fonts = re.findall(r'<font>.*?</font>', fonts.group(3), flags=re.S)
    font_xml = (
        f'<font><b/><sz val="11"/><color rgb="{COLOR_NOTA}"/><name val="Calibri"/>'
        '<family val="2"/></font>'
    )
    if font_xml not in lista_fonts:
        lista_fonts.append(font_xml)
        styles = styles.replace(
            fonts.group(0),
            f'<fonts count="{len(lista_fonts)}"{fonts.group(2)}>{"".join(lista_fonts)}</fonts>',
        )
    font_id = lista_fonts.index(font_xml)

    xfs = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles, flags=re.S)
    lista_xfs = re.findall(r'<xf [^>]*?(?:/>|>.*?</xf>)', xfs.group(2), flags=re.S)

    def xf_id(xml):
        if xml not in lista_xfs:
            lista_xfs.append(xml)
        return lista_xfs.index(xml)

    def con_relleno(base, wrap=False):
        xml = lista_xfs[base]
        xml = re.sub(r'fillId="\d+"', f'fillId="{fill_id}"', xml)
        if 'applyFill=' not in xml:
            xml = xml.replace(' xfId=', ' applyFill="1" xfId=', 1)
        if wrap:
            xml = re.sub(r'<alignment[^>]*/>', '', xml).replace('</xf>', '').rstrip('/>')
            if 'applyAlignment=' not in xml:
                xml += ' applyAlignment="1"'
            xml += '><alignment vertical="center" wrapText="1"/></xf>'
        return xml

    mapa = {}
    for col, base in ESTILO_BASE.items():
        mapa[col] = xf_id(con_relleno(base, wrap=col in ('AS', 'AT')))
    nota_id = xf_id(
        f'<xf numFmtId="0" fontId="{font_id}" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    )
    styles = styles.replace(
        xfs.group(0), f'<cellXfs count="{len(lista_xfs)}">{"".join(lista_xfs)}</cellXfs>'
    )
    return styles, mapa, nota_id


def celda(ref, estilo, valor):
    if isinstance(valor, tuple) and valor[0] == 'fecha':
        return f'<c r="{ref}" s="{estilo}"><v>{fecha(valor[1])}</v></c>'
    if isinstance(valor, tuple) and valor[0] == 'formula':
        return f'<c r="{ref}" s="{estilo}"><f>{valor[1]}</f><v>{valor[2]}</v></c>'
    if isinstance(valor, (int, float)):
        return f'<c r="{ref}" s="{estilo}"><v>{valor}</v></c>'
    return f'<c r="{ref}" s="{estilo}" t="inlineStr"><is><t>{escape(valor)}</t></is></c>'


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    with zipfile.ZipFile(ruta) as z:
        partes = {i.filename: (i, z.read(i.filename)) for i in z.infolist()}

    styles, mapa, nota_id = asegurar_estilos(partes['xl/styles.xml'][1].decode('utf-8'))

    hoja = partes['xl/worksheets/sheet1.xml'][1].decode('utf-8')
    # Idempotente: fuera fila 1 (nota) y filas de datos (>= 4).
    hoja = re.sub(
        r'<row r="(\d+)"[^>]*?(?:/>|>.*?</row>)',
        lambda m: m.group(0) if 2 <= int(m.group(1)) <= 3 else '',
        hoja,
        flags=re.S,
    )
    nota = (
        f'<row r="1" spans="1:46" ht="21" customHeight="1">'
        f'<c r="B1" s="{nota_id}" t="inlineStr"><is><t>{escape(NOTA)}</t></is></c></row>'
    )
    filas = ''
    for n, ejemplo in enumerate(EJEMPLOS, start=4):
        celdas = ''.join(
            celda(f'{col}{n}', mapa[col], ejemplo[col]) if col in ejemplo
            else f'<c r="{col}{n}" s="{mapa[col]}"/>'
            for col in COLUMNAS
        )
        filas += f'<row r="{n}" spans="1:46" ht="48" customHeight="1">{celdas}</row>'
    hoja = hoja.replace('<sheetData>', '<sheetData>' + nota, 1)
    hoja = hoja.replace('</sheetData>', filas + '</sheetData>', 1)
    hoja = re.sub(r'<dimension ref="[^"]*"/>', '<dimension ref="A1:AT6"/>', hoja)
    # Encabezados fijos al desplazarse y cursor en el primer ejemplo.
    hoja = re.sub(
        r'<sheetView ([^>]*?)(?:/>|>.*?</sheetView>)',
        lambda m: (
            f'<sheetView {m.group(1)}><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" '
            'state="frozen"/><selection pane="bottomLeft" activeCell="B4" sqref="B4"/></sheetView>'
        ),
        hoja,
        count=1,
        flags=re.S,
    )
    # Columnas de texto largo más anchas (CONDICIONES y COMENTARIOS).
    hoja = re.sub(r'<col min="45" max="45" width="[\d.]+"', '<col min="45" max="45" width="40"', hoja)
    hoja = re.sub(r'<col min="46" max="46" width="[\d.]+"', '<col min="46" max="46" width="55"', hoja)
    hoja = re.sub(r'<ignoredErrors>.*?</ignoredErrors>', '', hoja, flags=re.S)

    partes['xl/styles.xml'] = (partes['xl/styles.xml'][0], styles.encode('utf-8'))
    partes['xl/worksheets/sheet1.xml'] = (partes['xl/worksheets/sheet1.xml'][0], hoja.encode('utf-8'))

    tmp = ruta + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for info, data in partes.values():
            out.writestr(info, data)
    os.replace(tmp, ruta)
    print(f'Plantilla generada: {ruta}')


if __name__ == '__main__':
    main()
