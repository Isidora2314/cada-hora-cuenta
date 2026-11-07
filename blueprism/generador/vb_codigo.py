# Código VB.NET de los code stages del objeto "Teleton API".
# Se guarda aparte para poder copiarlo a mano si la importación falla
# (ver blueprism/README.md, sección "Plan B").

GLOBAL = r'''
' ------------------------------------------------------------
' Objeto Teleton API - Botathon 2026 "Cada hora cuenta"
' Convierte colecciones de Blue Prism a JSON y las envía al backend.
' ------------------------------------------------------------

' Escapa un texto para que sea válido dentro de un JSON
Private Function JsonEscape(ByVal s As String) As String
    If s Is Nothing Then Return ""
    Dim sb As New StringBuilder()
    For Each c As Char In s
        Select Case c
            Case """"c
                sb.Append("\""")
            Case "\"c
                sb.Append("\\")
            Case ControlChars.Cr
                sb.Append("\r")
            Case ControlChars.Lf
                sb.Append("\n")
            Case ControlChars.Tab
                sb.Append("\t")
            Case Else
                If AscW(c) < 32 Then
                    sb.Append("\u" & AscW(c).ToString("x4"))
                Else
                    sb.Append(c)
                End If
        End Select
    Next
    Return sb.ToString()
End Function

' Convierte un valor de una celda de la colección a JSON
Private Function JsonValor(ByVal v As Object) As String
    Dim inv As System.Globalization.CultureInfo = System.Globalization.CultureInfo.InvariantCulture
    If v Is Nothing OrElse IsDBNull(v) Then Return """"""
    If TypeOf v Is DateTime Then
        Return """" & CType(v, DateTime).ToString("yyyy-MM-dd", inv) & """"
    End If
    If TypeOf v Is Boolean Then
        If CBool(v) Then Return "true" Else Return "false"
    End If
    If TypeOf v Is Decimal OrElse TypeOf v Is Double OrElse TypeOf v Is Single _
       OrElse TypeOf v Is Integer OrElse TypeOf v Is Long OrElse TypeOf v Is Short Then
        Return Convert.ToString(v, inv)
    End If
    Return """" & JsonEscape(Convert.ToString(v, inv)) & """"
End Function

' Convierte una colección completa en una lista JSON: [ {...}, {...} ]
Private Function TablaAJson(ByVal t As DataTable) As String
    Dim sb As New StringBuilder("[")
    Dim primera As Boolean = True
    For Each fila As DataRow In t.Rows
        If Not primera Then sb.Append(",")
        primera = False
        sb.Append("{")
        For i As Integer = 0 To t.Columns.Count - 1
            If i > 0 Then sb.Append(",")
            sb.Append("""").Append(JsonEscape(t.Columns(i).ColumnName)).Append(""":")
            sb.Append(JsonValor(fila(i)))
        Next
        sb.Append("}")
    Next
    sb.Append("]")
    Return sb.ToString()
End Function

' Devuelve el texto de una columna si existe; si no, texto vacío
Private Function Columna(ByVal fila As DataRow, ByVal nombre As String) As String
    If fila.Table.Columns.Contains(nombre) AndAlso Not IsDBNull(fila(nombre)) Then
        Return Convert.ToString(fila(nombre), System.Globalization.CultureInfo.InvariantCulture)
    End If
    Return ""
End Function

' Une la URL base con la ruta, sin barras dobles
Private Function UnirUrl(ByVal baseUrl As String, ByVal ruta As String) As String
    Return baseUrl.Trim().TrimEnd("/"c) & ruta
End Function

' Hace la llamada HTTP. Devuelve el texto de la respuesta y deja el código HTTP en "codigo"
' (0 si no hubo conexión).
Private Function Enviar(ByVal metodo As String, ByVal url As String, ByVal apiKey As String, _
                        ByVal cuerpo As String, ByRef codigo As Integer) As String
    ' Codespaces usa HTTPS: se habilita TLS 1.2
    ServicePointManager.SecurityProtocol = ServicePointManager.SecurityProtocol Or CType(3072, SecurityProtocolType)
    Dim req As HttpWebRequest = CType(WebRequest.Create(url), HttpWebRequest)
    req.Method = metodo
    req.Timeout = 300000
    req.ReadWriteTimeout = 300000
    req.Accept = "application/json"
    req.Headers.Add("x-api-key", apiKey)
    If cuerpo IsNot Nothing Then
        Dim bytes As Byte() = Encoding.UTF8.GetBytes(cuerpo)
        req.ContentType = "application/json; charset=utf-8"
        req.ContentLength = bytes.Length
        Using s As System.IO.Stream = req.GetRequestStream()
            s.Write(bytes, 0, bytes.Length)
        End Using
    End If
    Dim resp As HttpWebResponse = Nothing
    Try
        resp = CType(req.GetResponse(), HttpWebResponse)
    Catch ex As WebException
        resp = TryCast(ex.Response, HttpWebResponse)
        If resp Is Nothing Then
            codigo = 0
            Return "Sin conexión con el backend: " & ex.Message
        End If
    End Try
    codigo = CInt(resp.StatusCode)
    Dim texto As String
    Using lector As New System.IO.StreamReader(resp.GetResponseStream(), Encoding.UTF8)
        texto = lector.ReadToEnd()
    End Using
    resp.Close()
    Return texto
End Function

' Lee un número de la respuesta JSON, por ejemplo "cambiosDetectados": 6
Private Function NumeroJson(ByVal json As String, ByVal clave As String) As Integer
    Dim m As System.Text.RegularExpressions.Match = _
        System.Text.RegularExpressions.Regex.Match(json, """" & clave & """\s*:\s*(\d+)")
    If m.Success Then Return CInt(m.Groups(1).Value)
    Return 0
End Function
'''

PING = r'''
Dim codigo As Integer = 0
Respuesta = Enviar("GET", UnirUrl(URLBase, "/api/bot/ping"), APIKey, Nothing, codigo)
CodigoHTTP = codigo
Exito = (codigo = 200)
'''

ENVIAR_REPORTE = r'''
' Tipo = "buk" o "sic"
Dim ruta As String = "/api/bot/" & Tipo.Trim().ToLower()
Dim cuerpo As String = "{""archivo"":""" & JsonEscape(Archivo) & """,""registros"":" & TablaAJson(Registros) & "}"
Dim codigo As Integer = 0
Respuesta = Enviar("POST", UnirUrl(URLBase, ruta), APIKey, cuerpo, codigo)
CodigoHTTP = codigo
Exito = (codigo = 200)
CambiosDetectados = NumeroJson(Respuesta, "cambiosDetectados")
TotalErrores = NumeroJson(Respuesta, "totalErrores")
RegistrosEnviados = Registros.Rows.Count
'''

ENVIAR_ERRORES = r'''
' Envía los errores que encontró el bot (colección con columnas PersonaId, Instituto y Motivo)
Dim sb As New StringBuilder()
sb.Append("{""archivo"":""").Append(JsonEscape(Archivo)).Append(""",""errores"":[")
Dim n As Integer = 0
For Each fila As DataRow In Errores.Rows
    Dim motivo As String = Columna(fila, "Motivo")
    If motivo = "" OrElse motivo.StartsWith("Sin errores") Then Continue For
    If n > 0 Then sb.Append(",")
    n += 1
    Dim inst As String = Columna(fila, "Instituto")
    If inst <> "" Then motivo = motivo & " (" & inst & ")"
    sb.Append("{""fila"":").Append(n)
    sb.Append(",""columna"":"""",""tipo"":""VALIDACION_BOT""")
    sb.Append(",""valor"":""").Append(JsonEscape(Columna(fila, "PersonaId"))).Append("""")
    sb.Append(",""mensaje"":""").Append(JsonEscape(motivo)).Append("""}")
Next
sb.Append("]}")
ErroresEnviados = n
If n = 0 Then
    Respuesta = "No hay errores que informar"
    CodigoHTTP = 0
    Exito = True
Else
    Dim codigo As Integer = 0
    Respuesta = Enviar("POST", UnirUrl(URLBase, "/api/bot/errores"), APIKey, sb.ToString(), codigo)
    CodigoHTTP = codigo
    Exito = (codigo = 200)
End If
'''
