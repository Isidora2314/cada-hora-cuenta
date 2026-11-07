Dim codigo As Integer = 0
Respuesta = Enviar("GET", UnirUrl(URLBase, "/api/bot/ping"), APIKey, Nothing, codigo)
CodigoHTTP = codigo
Exito = (codigo = 200)
