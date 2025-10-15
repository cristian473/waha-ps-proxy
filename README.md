# WAHA PS API

API REST para integración con WhatsApp a través de WAHA (WhatsApp HTTP API). Este proyecto proporciona endpoints para recibir webhooks de WhatsApp y enviar mensajes programáticamente.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Prerrequisitos](#prerrequisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Docker](#docker)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Desarrollo](#desarrollo)
- [Contribución](#contribución)

## 🚀 Características

- **Webhook de WhatsApp**: Recibe y procesa mensajes entrantes de WhatsApp
- **Envío de Mensajes**: Envía mensajes de texto a través de WAHA API
- **Integración con Google Sheets**: Gestiona configuraciones de webhooks mediante Google Sheets
- **Autenticación JWT**: Protección de endpoints con tokens JWT
- **Validación de Datos**: Validación robusta de entrada con class-validator
- **Manejo de Errores**: Sistema centralizado de manejo de errores
- **Logging**: Sistema de logging con jet-logger
- **Docker**: Contenedorización para despliegue fácil

## 🛠 Tecnologías

- **Node.js** - Runtime de JavaScript
- **TypeScript** - Tipado estático
- **Express.js** - Framework web
- **WAHA** - WhatsApp HTTP API
- **Google Sheets API** - Integración con hojas de cálculo
- **JWT** - Autenticación
- **Axios** - Cliente HTTP
- **Docker** - Contenedorización

## 📋 Prerrequisitos

- Node.js (versión 20 o superior)
- npm o yarn
- Docker (opcional)
- Cuenta de Google Cloud con Google Sheets API habilitada
- Instancia de WAHA ejecutándose

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd ws-ps-server/api
```

2. **Instalar dependencias**
```bash
npm install
# o
yarn install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

4. **Compilar el proyecto**
```bash
npm run build
```

## ⚙️ Configuración

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Servidor
NODE_ENV=development
PORT=8081

# JWT
JWT_SECRET=your_jwt_secret_here
COOKIE_EXP=3600000

# WAHA API
WAHA_BASE_URL=http://localhost:3000
WAHA_AUTH_TOKEN=your_waha_auth_token

# Google Sheets
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_AUTH_CLIENT_EMAIL=your_service_account_email
GOOGLE_AUTH_PRIVATE_KEY=your_private_key

# Supabase (opcional)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cookies
COOKIE_SECRET=your_cookie_secret
COOKIE_PATH=/
COOKIE_DOMAIN=localhost
SECURE_COOKIE=false
```

### Configuración de Google Sheets

1. Crear un proyecto en Google Cloud Console
2. Habilitar Google Sheets API
3. Crear una cuenta de servicio
4. Descargar el archivo JSON de credenciales
5. Configurar las variables de entorno correspondientes

La hoja de cálculo debe tener la siguiente estructura:
| numero | webhook | comando |
|--------|---------|---------|
| 1234567890 | https://api.example.com/webhook | comando1 |
| 0987654321 | https://api.example.com/webhook2 | comando2 |

## 🚀 Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

### Con Docker
```bash
docker build -t waha-ps-api .
docker run -p 8081:8081 --env-file .env waha-ps-api
```

## 📡 API Endpoints

### Base URL
```
http://localhost:8081/api
```

### Endpoints Disponibles

#### 1. Test
```http
GET /api/test
```
**Descripción**: Endpoint de prueba para verificar que la API está funcionando.

**Respuesta**:
```json
"Hello World!"
```

#### 2. Webhook de WhatsApp
```http
POST /api/ws/webhook
```
**Descripción**: Recibe webhooks de WhatsApp desde WAHA.

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body**:
```json
{
  "id": "message_id",
  "timestamp": 1234567890,
  "event": "message",
  "session": "session_name",
  "payload": {
    "from": "1234567890@c.us",
    "body": "Hola mundo",
    "hasMedia": false,
    "_data": {
      "notifyName": "Usuario"
    }
  }
}
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

#### 3. Enviar Mensaje
```http
POST /api/ws/send-message
```
**Descripción**: Envía un mensaje de texto a través de WAHA.

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body**:
```json
{
  "chatId": "1234567890@c.us",
  "text": "Mensaje a enviar",
  "session": "session_name"
}
```

**Respuesta**:
```json
{
  "success": true,
  "messageId": "message_id",
  "message": "Message sent successfully"
}
```

## 🐳 Docker

### Construir imagen
```bash
docker build -t waha-ps-api .
```

### Ejecutar contenedor
```bash
docker run -p 8081:8081 --env-file .env waha-ps-api
```

### Docker Compose (ejemplo)
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8081:8081"
    environment:
      - NODE_ENV=production
      - PORT=8081
      - WAHA_BASE_URL=http://waha:3000
    depends_on:
      - waha
    env_file:
      - .env
```

## 📁 Estructura del Proyecto

```
api/
├── src/
│   ├── constants/          # Constantes de la aplicación
│   │   ├── EnvVars.ts     # Variables de entorno
│   │   ├── HttpStatusCodes.ts
│   │   └── misc.ts
│   ├── entities/          # Entidades del dominio
│   │   └── ws/           # WhatsApp
│   │       ├── ws.controller.ts
│   │       ├── ws.dto.ts
│   │       ├── ws.router.ts
│   │       └── ws.service.ts
│   ├── middlewares/       # Middlewares personalizados
│   │   ├── bodyValidation.ts
│   │   ├── formDataValidation.ts
│   │   ├── multer.ts
│   │   ├── permissionVerification.ts
│   │   └── tokenVerification.ts
│   ├── other/            # Utilidades y configuraciones
│   │   ├── errorHandler.ts
│   │   └── wahaClient.ts
│   ├── utils/            # Utilidades generales
│   │   ├── pagination.ts
│   │   ├── sharp.ts
│   │   ├── sheets.ts
│   │   └── webhook.ts
│   ├── index.ts          # Punto de entrada
│   ├── pre-start.ts      # Configuración previa
│   ├── router.ts         # Router principal
│   └── server.ts         # Configuración del servidor
├── uploads/              # Archivos subidos
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🔧 Desarrollo

### Scripts Disponibles

```bash
# Desarrollo con hot reload
npm run dev

# Compilar TypeScript
npm run build

# Verificar tipos TypeScript
npm run ts.check

# Iniciar en producción
npm start
```

### Flujo de Desarrollo

1. **Fork** del repositorio
2. Crear una **rama** para la nueva funcionalidad
3. Realizar los **cambios** necesarios
4. **Probar** localmente
5. Crear un **Pull Request**

### Estándares de Código

- Usar **TypeScript** para todo el código
- Seguir las **convenciones** de naming de Express.js
- Documentar funciones y clases con **JSDoc**
- Usar **ESLint** y **Prettier** para formateo
- Escribir **tests** para nuevas funcionalidades

## 🔒 Seguridad

- **JWT** para autenticación de endpoints
- **Helmet** para headers de seguridad
- **CORS** configurado apropiadamente
- **Validación** de entrada en todos los endpoints
- **Manejo seguro** de errores sin exponer información sensible

## 📊 Monitoreo y Logs

- **jet-logger** para logging estructurado
- **Morgan** para logs de HTTP en desarrollo
- **Manejo centralizado** de errores
- **Timeouts** configurados para requests externos

## 🤝 Contribución

1. Fork el proyecto
2. Crea tu rama de funcionalidad (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia ISC. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte y preguntas:
- Crear un **Issue** en GitHub
- Contactar al equipo de desarrollo

## 🔄 Changelog

### v1.0.0
- Implementación inicial
- Webhook de WhatsApp
- Envío de mensajes
- Integración con Google Sheets
- Autenticación JWT
- Dockerización

---

**Nota**: Asegúrate de tener WAHA ejecutándose antes de usar esta API. WAHA es un componente externo necesario para la funcionalidad de WhatsApp.
