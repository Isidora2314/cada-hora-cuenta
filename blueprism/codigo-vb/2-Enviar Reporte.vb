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
