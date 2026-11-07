"""
Genera los archivos importables de Blue Prism:
  - blueprism/BPA Object - Teleton API.xml   (objeto: ping, enviar reporte, enviar errores)
  - blueprism/BPA Process - Carga BUK Teleton.xml (proceso completo)

Uso:  python blueprism/generador/generar.py
Los IDs son fijos (uuid5), así que volver a generar no cambia nada si el contenido es igual.
"""
import os
import uuid
from xml.sax.saxutils import quoteattr, escape

import vb_codigo as vb

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.dirname(AQUI)
BPVERSION = "6.10.1.12345"
NS = uuid.UUID("0b6c1f5e-6f2a-4c1e-9a55-7e1e7a7e2026")


class Diagrama:
    """Arma la lista de etapas (stages) de un proceso u objeto."""

    def __init__(self, prefijo):
        self.prefijo = prefijo
        self.etapas = []

    def id(self, nombre, pagina=""):
        return str(uuid.uuid5(NS, f"{self.prefijo}|{pagina}|{nombre}"))

    def _cab(self, nombre, tipo, x, y, pagina=None, w=60, h=30, narrativa=""):
        s = f'  <stage stageid="{self.id(nombre, pagina or "")}" name={quoteattr(nombre)} type="{tipo}">\n'
        if pagina:
            s += f'    <subsheetid>{pagina}</subsheetid>\n'
        s += '    <loginhibit onsuccess="true" />\n'
        s += f'    <narrative>{escape(narrativa)}</narrative>\n'
        s += f'    <displayx>{x}</displayx>\n    <displayy>{y}</displayy>\n'
        s += f'    <displaywidth>{w}</displaywidth>\n    <displayheight>{h}</displayheight>\n'
        s += '    <font family="Segoe UI" size="10" style="Regular" color="000000" />\n'
        return s

    def _sig(self, destino, pagina):
        return self.id(destino, pagina or "")

    # ---- etapas ----
    def info(self, nombre, x, y, extra="", pagina=None, tipo="ProcessInfo", narrativa=""):
        self.etapas.append(self._cab(nombre, tipo, x, y, pagina, 150, 90, narrativa) + extra + '  </stage>\n')

    def start(self, x, y, sig, pagina=None, entradas=()):
        s = self._cab("Start", "Start", x, y, pagina)
        if entradas:
            s += '    <inputs>\n' + ''.join(
                f'      <input type="{t}" name={quoteattr(n)} narrative={quoteattr(d)} stage={quoteattr(n)} />\n'
                for t, n, d in entradas) + '    </inputs>\n'
        s += f'    <onsuccess>{self._sig(sig, pagina)}</onsuccess>\n  </stage>\n'
        self.etapas.append(s)

    def end(self, x, y, pagina=None, salidas=()):
        s = self._cab("End", "End", x, y, pagina)
        if salidas:
            s += '    <outputs>\n' + ''.join(
                f'      <output type="{t}" name={quoteattr(n)} narrative={quoteattr(d)} stage={quoteattr(n)} />\n'
                for t, n, d in salidas) + '    </outputs>\n'
        self.etapas.append(s + '  </stage>\n')

    def dato(self, nombre, tipo, x, y, inicial="", pagina=None, narrativa=""):
        s = self._cab(nombre, "Data", x, y, pagina, narrativa=narrativa)
        s += f'    <datatype>{tipo}</datatype>\n'
        if inicial != "":
            s += f'    <initialvalue xml:space="preserve">{escape(str(inicial))}</initialvalue>\n'
        else:
            s += '    <initialvalue />\n'
        s += '    <private />\n    <alwaysinit />\n  </stage>\n'
        self.etapas.append(s)

    def coleccion(self, nombre, x, y, campos=(), pagina=None):
        s = self._cab(nombre, "Collection", x, y, pagina)
        s += '    <datatype>collection</datatype>\n    <private />\n    <alwaysinit />\n'
        if campos:
            s += '    <collectioninfo>\n' + ''.join(
                f'      <field name={quoteattr(c)} type="{t}" />\n' for c, t in campos) + '    </collectioninfo>\n'
        self.etapas.append(s + '  </stage>\n')

    def accion(self, nombre, x, y, objeto, accion, sig, entradas=(), salidas=(), pagina=None):
        s = self._cab(nombre, "Action", x, y, pagina)
        s += '    <inputs>\n' + ''.join(
            f'      <input type="{t}" name={quoteattr(n)} expr={quoteattr(e)} />\n' for t, n, e in entradas) + '    </inputs>\n'
        s += '    <outputs>\n' + ''.join(
            f'      <output type="{t}" name={quoteattr(n)} stage={quoteattr(st)} />\n' for t, n, st in salidas) + '    </outputs>\n'
        s += f'    <onsuccess>{self._sig(sig, pagina)}</onsuccess>\n'
        s += f'    <resource object={quoteattr(objeto)} action={quoteattr(accion)} />\n  </stage>\n'
        self.etapas.append(s)

    def decision(self, nombre, x, y, expr, si, no, pagina=None):
        s = self._cab(nombre, "Decision", x, y, pagina, 60, 60)
        s += f'    <decision expression={quoteattr(expr)} />\n'
        s += f'    <ontrue>{self._sig(si, pagina)}</ontrue>\n    <onfalse>{self._sig(no, pagina)}</onfalse>\n  </stage>\n'
        self.etapas.append(s)

    def calculo(self, nombre, x, y, expr, destino, sig, pagina=None):
        s = self._cab(nombre, "Calculation", x, y, pagina)
        s += f'    <calculation expression={quoteattr(expr)} stage={quoteattr(destino)} />\n'
        s += f'    <onsuccess>{self._sig(sig, pagina)}</onsuccess>\n  </stage>\n'
        self.etapas.append(s)

    def multicalc(self, nombre, x, y, pasos, sig, pagina=None):
        s = self._cab(nombre, "MultipleCalculation", x, y, pagina) + '    <steps>\n'
        s += ''.join(f'      <calculation expression={quoteattr(e)} stage={quoteattr(d)} />\n' for e, d in pasos)
        s += f'    </steps>\n    <onsuccess>{self._sig(sig, pagina)}</onsuccess>\n  </stage>\n'
        self.etapas.append(s)

    def codigo(self, nombre, x, y, codigo, sig, entradas=(), salidas=(), pagina=None):
        s = self._cab(nombre, "Code", x, y, pagina, 90, 45)
        s += '    <inputs>\n' + ''.join(
            f'      <input type="{t}" name={quoteattr(n)} expr={quoteattr(e)} />\n' for t, n, e in entradas) + '    </inputs>\n'
        s += '    <outputs>\n' + ''.join(
            f'      <output type="{t}" name={quoteattr(n)} stage={quoteattr(st)} />\n' for t, n, st in salidas) + '    </outputs>\n'
        s += f'    <onsuccess>{self._sig(sig, pagina)}</onsuccess>\n'
        s += f'    <code><![CDATA[{codigo}]]></code>\n  </stage>\n'
        self.etapas.append(s)

    def loop(self, inicio, fin, xi, yi, xf, yf, coleccion, sig_dentro, sig_fuera, pagina=None):
        grupo = self.id(inicio + "|grupo", pagina or "")
        s = self._cab(inicio, "LoopStart", xi, yi, pagina)
        s += f'    <groupid>{grupo}</groupid>\n    <looptype>ForEach</looptype>\n    <loopdata>{escape(coleccion)}</loopdata>\n'
        s += f'    <onsuccess>{self._sig(sig_dentro, pagina)}</onsuccess>\n  </stage>\n'
        s2 = self._cab(fin, "LoopEnd", xf, yf, pagina)
        s2 += f'    <groupid>{grupo}</groupid>\n    <onsuccess>{self._sig(sig_fuera, pagina)}</onsuccess>\n  </stage>\n'
        self.etapas += [s, s2]


def vista(x=0, y=0):
    return f'  <view>\n    <camerax>{x}</camerax>\n    <cameray>{y}</cameray>\n    <zoom version="2">1.25</zoom>\n  </view>\n'


# =====================================================================
# OBJETO: Teleton API
# =====================================================================
def generar_objeto():
    d = Diagrama("obj-teleton-api")
    paginas = {}

    def pagina(nombre, tipo="Normal"):
        pid = d.id("pagina|" + nombre)
        paginas[nombre] = (pid, tipo)
        return pid

    # --- Initialise (página principal) ---
    globales = (
        '    <references>\n'
        '      <reference>System.dll</reference>\n'
        '      <reference>System.Data.dll</reference>\n'
        '      <reference>System.Xml.dll</reference>\n'
        '      <reference>System.Drawing.dll</reference>\n'
        '    </references>\n'
        '    <imports>\n'
        '      <import>System</import>\n'
        '      <import>System.Drawing</import>\n'
        '      <import>System.Data</import>\n'
        '      <import>System.Net</import>\n'
        '      <import>System.Text</import>\n'
        '    </imports>\n'
        '    <language>visualbasic</language>\n'
        f'    <globalcode><![CDATA[{vb.GLOBAL}]]></globalcode>\n'
        # Blue Prism 7 compila el código global desde <code> (probado en 7.5.1);
        # <globalcode> se deja por compatibilidad con versiones anteriores.
        f'    <code><![CDATA[{vb.GLOBAL}]]></code>\n'
        '    <code-options />\n'
    )
    d.info("Teleton API", -195, -105, globales,
           narrativa="Conecta Blue Prism con el backend de 'Cada hora cuenta' (Botathon 2026). "
                     "Convierte colecciones a JSON y las envía por HTTP con la API key del bot.")
    d.start(15, -105, "End")
    d.end(15, 90)

    # --- Clean Up ---
    cu = pagina("Clean Up", "CleanUp")
    d.info("Clean Up", -195, -105, pagina=cu, tipo="SubSheetInfo")
    d.start(15, -105, "End", pagina=cu)
    d.end(15, 90, pagina=cu)

    comunes = [("text", "URL Base", "Dirección del backend, por ejemplo https://xxxx-4000.app.github.dev"),
               ("text", "API Key", "Valor de BOT_API_KEY del archivo backend/.env")]

    # --- Ping ---
    p = pagina("Ping")
    d.info("Ping", -195, -105, pagina=p, tipo="SubSheetInfo", narrativa="Prueba la conexión con el backend (GET /api/bot/ping).")
    d.start(15, -105, "Llamar ping", pagina=p, entradas=comunes)
    d.codigo("Llamar ping", 15, -15, vb.PING, "End", pagina=p,
             entradas=[("text", "URLBase", "[URL Base]"), ("text", "APIKey", "[API Key]")],
             salidas=[("flag", "Exito", "Exito"), ("number", "CodigoHTTP", "Codigo HTTP"), ("text", "Respuesta", "Respuesta")])
    salidas_ping = [("flag", "Exito", "True si el backend respondió 200"),
                    ("number", "Codigo HTTP", "Código HTTP (0 = sin conexión)"),
                    ("text", "Respuesta", "Texto que respondió el backend")]
    d.end(15, 90, pagina=p, salidas=salidas_ping)
    for i, (n, t) in enumerate([("URL Base", "text"), ("API Key", "text"), ("Exito", "flag"), ("Codigo HTTP", "number"), ("Respuesta", "text")]):
        d.dato(n, t, -195 + 90 * (i % 3), 15 + 60 * (i // 3), pagina=p)

    # --- Enviar Reporte ---
    r = pagina("Enviar Reporte")
    d.info("Enviar Reporte", -195, -105, pagina=r, tipo="SubSheetInfo",
           narrativa="Envía una colección (reporte BUK o SIC) al backend. Tipo = buk o sic.")
    d.start(15, -105, "Convertir y enviar", pagina=r, entradas=comunes + [
        ("text", "Tipo", "buk o sic"),
        ("text", "Archivo", "Nombre del Excel leído (queda en el historial)"),
        ("collection", "Registros", "Colección leída del Excel")])
    d.codigo("Convertir y enviar", 15, -15, vb.ENVIAR_REPORTE, "End", pagina=r,
             entradas=[("text", "URLBase", "[URL Base]"), ("text", "APIKey", "[API Key]"), ("text", "Tipo", "[Tipo]"),
                       ("text", "Archivo", "[Archivo]"), ("collection", "Registros", "[Registros]")],
             salidas=[("flag", "Exito", "Exito"), ("number", "CodigoHTTP", "Codigo HTTP"), ("text", "Respuesta", "Respuesta"),
                      ("number", "CambiosDetectados", "Cambios Detectados"), ("number", "TotalErrores", "Total Errores"),
                      ("number", "RegistrosEnviados", "Registros Enviados")])
    d.end(15, 90, pagina=r, salidas=salidas_ping + [
        ("number", "Cambios Detectados", "Altas, bajas y cambios que detectó el backend"),
        ("number", "Total Errores", "Filas rechazadas por el backend"),
        ("number", "Registros Enviados", "Filas enviadas")])
    datos_r = [("URL Base", "text"), ("API Key", "text"), ("Tipo", "text"), ("Archivo", "text"), ("Exito", "flag"),
               ("Codigo HTTP", "number"), ("Respuesta", "text"), ("Cambios Detectados", "number"),
               ("Total Errores", "number"), ("Registros Enviados", "number")]
    for i, (n, t) in enumerate(datos_r):
        d.dato(n, t, -285 + 90 * (i % 3), 15 + 60 * (i // 3), pagina=r)
    d.coleccion("Registros", 195, 15, pagina=r)

    # --- Enviar Errores ---
    e = pagina("Enviar Errores")
    d.info("Enviar Errores", -195, -105, pagina=e, tipo="SubSheetInfo",
           narrativa="Envía al backend los errores que encontró el bot (colección con PersonaId, Instituto y Motivo).")
    d.start(15, -105, "Enviar lista de errores", pagina=e, entradas=comunes + [
        ("text", "Archivo", "Nombre del Excel leído"),
        ("collection", "Errores", "Colección Errores del proceso")])
    d.codigo("Enviar lista de errores", 15, -15, vb.ENVIAR_ERRORES, "End", pagina=e,
             entradas=[("text", "URLBase", "[URL Base]"), ("text", "APIKey", "[API Key]"),
                       ("text", "Archivo", "[Archivo]"), ("collection", "Errores", "[Errores]")],
             salidas=[("flag", "Exito", "Exito"), ("number", "CodigoHTTP", "Codigo HTTP"), ("text", "Respuesta", "Respuesta"),
                      ("number", "ErroresEnviados", "Errores Enviados")])
    d.end(15, 90, pagina=e, salidas=salidas_ping + [("number", "Errores Enviados", "Cantidad de errores informados")])
    for i, (n, t) in enumerate([("URL Base", "text"), ("API Key", "text"), ("Archivo", "text"), ("Exito", "flag"),
                                ("Codigo HTTP", "number"), ("Respuesta", "text"), ("Errores Enviados", "number")]):
        d.dato(n, t, -285 + 90 * (i % 3), 15 + 60 * (i // 3), pagina=e)
    d.coleccion("Errores", 195, 15, pagina=e)

    subs = ''.join(
        f'  <subsheet subsheetid="{pid}" type="{tipo}" published="True">\n    <name>{escape(n)}</name>\n{vista()}  </subsheet>\n'
        for n, (pid, tipo) in paginas.items())
    xml = (f'<process name="Teleton API" version="1.0" bpversion="{BPVERSION}" '
           'narrative="Conecta Blue Prism con el backend de Cada hora cuenta (Botathon 2026)." '
           'type="object" runmode="Background">\n'
           + vista() + '  <preconditions />\n  <endpoint narrative="" />\n' + subs + ''.join(d.etapas) + '</process>\n')
    return xml


# =====================================================================
# PROCESO: Carga BUK Teleton
# =====================================================================
def generar_proceso():
    d = Diagrama("proc-carga-buk")
    XL = "MS Excel VBO"
    COL = "Collections"
    API = "Teleton API"
    SALIDA_DIR = r"C:\Users\bot05\Documents\Botathon_Salida"

    d.info("Carga BUK Teleton", -420, -165, narrativa=(
        "Lee el reporte BUK, valida cada fila, guarda Errores_BUK.xlsx y envía los datos al backend "
        "(que detecta altas, bajas y cambios y recalcula la planificación). Botathon 2026."))

    # ---- Columna 1: leer ----
    x1 = 15
    d.start(x1, -165, "Crear Excel")
    d.accion("Crear Excel", x1, -105, XL, "Create Instance", "Abrir BUK", salidas=[("number", "handle", "Handle")])
    d.accion("Abrir BUK", x1, -45, XL, "Open Workbook", "Leer Hoja",
             entradas=[("number", "handle", "[Handle]"), ("text", "File name", "[Ruta Archivo]")],
             salidas=[("text", "Workbook name", "Libro")])
    d.accion("Leer Hoja", x1, 15, XL, "Get Worksheet Range As Collection", "Recorrer filas",
             entradas=[("number", "handle", "[Handle]"), ("text", "Workbook Name", "[Libro]"),
                       ("text", "Worksheet Name", '"Dotacion_2026"'), ("flag", "Use Clipboard", "False"),
                       ("text", "StartCell", '"A2"'), ("text", "EndCell", "[Ultima Celda]"), ("flag", "Use Header", "True")],
             salidas=[("collection", "Data", "Dotacion")])

    # ---- Validaciones dentro del loop ----
    reglas = [
        # Va primero: si la fila es un encabezado repetido, ToNumber() de la regla de horas fallaría
        ("¿Encabezado repetido?", '[Dotacion.PersonaId]="PersonaId"', '"Fila de encabezado repetida dentro de los datos"'),
        ("¿Horas vacías?", '[Dotacion.Horas Semanales]=""', '"Horas semanales vacías"'),
        ("¿Horas fuera de rango?",
         'ToNumber([Dotacion.Horas Semanales])<=0 OR ToNumber([Dotacion.Horas Semanales])>45',
         '"Horas fuera de rango: " & [Dotacion.Horas Semanales]'),
        ("¿Instituto vacío?", '[Dotacion.Instituto]=""', '"Instituto vacío"'),
        ("¿Cargo vacío?", '[Dotacion.Cargo]=""', '"Cargo vacío"'),
        ("¿Cod_Esp vacío?", '[Dotacion.Cod_Esp]=""', '"Cod_Esp vacío"'),
    ]
    d.loop("Recorrer filas", "Fin recorrido", x1, 75, 465, 75, "Dotacion", "¿Fila vacía?", "Crear libro errores")
    d.decision("¿Fila vacía?", x1, 165, '[Dotacion.PersonaId]="" AND [Dotacion.Instituto]="" AND [Dotacion.Cargo]=""',
               "Contar vacía", "¿ID vacío?")
    d.calculo("Contar vacía", 135, 165, "[Filas Vacias]+1", "Filas Vacias", "Fin recorrido")
    d.decision("¿ID vacío?", x1, 255, '[Dotacion.PersonaId]=""', "Error ID - Agregar", reglas[0][0])
    d.accion("Error ID - Agregar", 135, 255, COL, "Add Row", "Error ID - Llenar", entradas=[("text", "Collection Name", '"Errores"')])
    d.multicalc("Error ID - Llenar", 255, 255,
                [('""', "Errores.PersonaId"), ("[Dotacion.Instituto]", "Errores.Instituto"), ('"PersonaId vacío"', "Errores.Motivo")],
                "Fin recorrido")
    y = 345
    for i, (nombre, expr, motivo) in enumerate(reglas):
        sig = reglas[i + 1][0] if i + 1 < len(reglas) else "Fin recorrido"
        etiqueta = nombre.strip("¿?")
        d.decision(nombre, x1, y, expr, f"Error {etiqueta} - Agregar", sig)
        d.accion(f"Error {etiqueta} - Agregar", 135, y, COL, "Add Row", f"Error {etiqueta} - Llenar",
                 entradas=[("text", "Collection Name", '"Errores"')])
        d.multicalc(f"Error {etiqueta} - Llenar", 255, y,
                    [("[Dotacion.PersonaId]", "Errores.PersonaId"), ("[Dotacion.Instituto]", "Errores.Instituto"),
                     (motivo, "Errores.Motivo")], "Fin recorrido")
        y += 90

    # ---- Columna 3: archivo de errores ----
    x3 = 465
    d.accion("Crear libro errores", x3, 165, XL, "Create Workbook", "Contar errores",
             entradas=[("number", "handle", "[Handle]")], salidas=[("text", "Workbook Name", "Libro Salida")])
    d.accion("Contar errores", x3, 225, COL, "Count Rows", "¿Hay errores?",
             entradas=[("text", "Collection Name", '"Errores"')], salidas=[("number", "Count", "Cant Errores")])
    d.decision("¿Hay errores?", x3, 300, "[Cant Errores]>0", "Escribir errores", "Agregar Sin errores")
    d.accion("Agregar Sin errores", 585, 300, COL, "Add Row", "Texto Sin errores", entradas=[("text", "Collection Name", '"Errores"')])
    d.calculo("Texto Sin errores", 585, 375, '"Sin errores en el reporte"', "Errores.Motivo", "Escribir errores")
    d.accion("Escribir errores", x3, 375, XL, "Write Collection", "Guardar errores",
             entradas=[("number", "handle", "[Handle]"), ("text", "Workbook Name", "[Libro Salida]"),
                       ("collection", "Collection", "[Errores]"), ("text", "Worksheet Name", "[Hoja Salida]"),
                       ("text", "Cell Reference", '"A1"'), ("flag", "Include Column Names", "True")])
    d.accion("Guardar errores", x3, 435, XL, "Save Workbook As", "Cerrar libro errores",
             entradas=[("number", "handle", "[Handle]"), ("text", "Workbook Name", "[Libro Salida]"),
                       ("text", "Filename", f'[Carpeta Salida] & "\\Errores_BUK.xlsx"')])
    d.accion("Cerrar libro errores", x3, 495, XL, "Close Workbook", "Enviar al backend",
             entradas=[("number", "handle", "[Handle]"), ("text", "Workbook Name", '"Errores_BUK.xlsx"'),
                       ("flag", "Save Changes", "False")])

    # ---- Columna 4: enviar al backend ----
    x4 = 705
    comunes = [("text", "URL Base", "[URL Base]"), ("text", "API Key", "[API Key]")]
    d.accion("Enviar al backend", x4, 165, API, "Enviar Reporte", "¿Envío OK?",
             entradas=comunes + [("text", "Tipo", '"buk"'), ("text", "Archivo", "[Nombre Archivo]"),
                                 ("collection", "Registros", "[Dotacion]")],
             salidas=[("flag", "Exito", "Envio OK"), ("number", "Codigo HTTP", "Codigo HTTP"),
                      ("text", "Respuesta", "Respuesta Backend"), ("number", "Cambios Detectados", "Cambios Detectados"),
                      ("number", "Total Errores", "Errores Backend"), ("number", "Registros Enviados", "Registros Enviados")])
    d.decision("¿Envío OK?", x4, 240, "[Envio OK]", "Informar errores bot", "Fallo envío")
    d.accion("Informar errores bot", x4, 315, API, "Enviar Errores", "Resumen",
             entradas=comunes + [("text", "Archivo", "[Nombre Archivo]"), ("collection", "Errores", "[Errores]")],
             salidas=[("number", "Errores Enviados", "Errores Informados")])
    d.calculo("Resumen", x4, 375,
              '"Filas leídas: " & [Registros Enviados] & " | vacías: " & [Filas Vacias] & " | errores bot: " & [Errores Informados] & '
              '" | cambios detectados: " & [Cambios Detectados] & " | rechazadas backend: " & [Errores Backend]',
              "Resumen Carga", "Cerrar BUK")
    d.calculo("Fallo envío", 825, 240,
              '"No se pudo enviar al backend (HTTP " & [Codigo HTTP] & "): " & [Respuesta Backend]',
              "Resumen Carga", "Cerrar BUK")
    d.accion("Cerrar BUK", x4, 435, XL, "Close Workbook", "Cerrar Excel",
             entradas=[("number", "handle", "[Handle]"), ("text", "Workbook Name", "[Libro]"), ("flag", "Save Changes", "False")])
    d.accion("Cerrar Excel", x4, 495, XL, "Close Instance", "End", entradas=[("number", "handle", "[Handle]")])
    d.end(x4, 555)

    # ---- Datos ----
    xd = -420
    config = [
        ("Ruta Archivo", "text", r"C:\Users\bot05\Documents\Botathon_Entrada\Nac - Base contratos x mes.xlsx"),
        ("Nombre Archivo", "text", "Nac - Base contratos x mes.xlsx"),
        ("Ultima Celda", "text", "S6000"),
        ("Carpeta Salida", "text", SALIDA_DIR),
        ("Hoja Salida", "text", "Hoja1"),
        ("URL Base", "text", "https://desafio-teleton.onrender.com"),
        ("API Key", "text", "CAMBIAR-por-BOT_API_KEY"),
    ]
    for i, (n, t, v) in enumerate(config):
        d.dato(n, t, xd, -45 + 60 * i, v)
    trabajo = [("Handle", "number", ""), ("Libro", "text", ""), ("Libro Salida", "text", ""), ("Cant Errores", "number", "0"),
               ("Filas Vacias", "number", "0"), ("Envio OK", "flag", "False"), ("Codigo HTTP", "number", "0"),
               ("Respuesta Backend", "text", ""), ("Cambios Detectados", "number", "0"), ("Errores Backend", "number", "0"),
               ("Registros Enviados", "number", "0"), ("Errores Informados", "number", "0"), ("Resumen Carga", "text", "")]
    for i, (n, t, v) in enumerate(trabajo):
        d.dato(n, t, -300 + 90 * (i % 2), -45 + 60 * (i // 2), v)
    d.coleccion("Dotacion", -300, 375)
    d.coleccion("Errores", -210, 375, campos=[("PersonaId", "text"), ("Instituto", "text"), ("Motivo", "text")])

    xml = (f'<process name="Carga BUK Teleton" version="1.0" bpversion="{BPVERSION}" '
           'narrative="Lee el BUK, valida, guarda los errores y envía los datos al backend de Cada hora cuenta." '
           'byrefcollection="true">\n'
           + vista(150, 200) + '  <preconditions />\n  <endpoint narrative="" />\n' + ''.join(d.etapas) + '</process>\n')
    return xml


if __name__ == "__main__":
    archivos = {
        "BPA Object - Teleton API.xml": generar_objeto(),
        "BPA Process - Carga BUK Teleton.xml": generar_proceso(),
    }
    for nombre, xml in archivos.items():
        ruta = os.path.join(SALIDA, nombre)
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(xml)
        print("Generado:", ruta)

    # Código VB suelto, para el "Plan B" (armar el objeto a mano)
    carpeta = os.path.join(SALIDA, "codigo-vb")
    os.makedirs(carpeta, exist_ok=True)
    for nombre, codigo in {"0-Global code (Initialise).vb": vb.GLOBAL, "1-Ping.vb": vb.PING,
                           "2-Enviar Reporte.vb": vb.ENVIAR_REPORTE, "3-Enviar Errores.vb": vb.ENVIAR_ERRORES}.items():
        with open(os.path.join(carpeta, nombre), "w", encoding="utf-8") as f:
            f.write(codigo.strip() + "\n")
    print("Generado:", carpeta)
