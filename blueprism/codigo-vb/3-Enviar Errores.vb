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
