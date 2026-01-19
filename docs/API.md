# API Documentation

This document describes the REST API endpoints for the Raspberry Pi Server Manager.

## Base URL

All API endpoints are prefixed with `/api`

## Authentication

Most endpoints require authentication via JWT token stored in an HttpOnly cookie.

### Login

```http
POST /api/login
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=securepassword
```

**Response:**
```json
{
  "success": true,
  "userId": "user-id-123"
}
```

**Rate Limit:** 5 attempts per 15 minutes per IP address

### Logout

```http
POST /api/logout
```

**Response:**
```json
{
  "success": true
}
```

### Check Authentication

```http
GET /api/whoami
```

**Response:**
```json
{
  "loggedIn": true,
  "userId": "user-id-123"
}
```

## User Management

### Get Users

```http
GET /api/users
```

**Response:**
```json
[
  {
    "id": "user-id-123",
    "email": "user@example.com"
  }
]
```

### Create User

```http
POST /api/users
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "name": "New User"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully"
}
```

### Delete User

```http
DELETE /api/users/:userId
```

**Response:**
```json
{
  "success": true
}
```

## File Management

### List Files

```http
GET /api/files
```

**Response:**
```json
[
  {
    "name": "document.pdf",
    "size": 1048576,
    "modified": "2024-01-19T12:00:00.000Z"
  }
]
```

### Upload File

```http
POST /api/files/upload
Content-Type: multipart/form-data

file=<binary data>
```

**Limits:**
- Max file size: 50MB
- Filenames are sanitized to prevent path traversal

**Response:**
```json
{
  "success": true,
  "filename": "document.pdf"
}
```

### Download File

```http
GET /api/files/download/:filename
```

Returns the file as `application/octet-stream`

### Delete File

```http
DELETE /api/files/:filename
```

**Response:**
```json
{
  "success": true
}
```

## System Metrics

### Get Current Metrics

```http
GET /api/metrics
```

**Response:**
```json
{
  "cpu": {
    "usage": 25.5,
    "cores": 4,
    "speed": 1500,
    "temp": 45.2
  },
  "memory": {
    "total": 4.0,
    "used": 2.5,
    "free": 1.5,
    "usagePercent": 62.5
  },
  "disk": {
    "totalSize": 32.0,
    "used": 15.2,
    "available": 16.8,
    "usagePercent": 47.5,
    "rIO": 100,
    "wIO": 50
  },
  "network": {
    "rx": 125.5,
    "tx": 45.2,
    "interface": "wlan0"
  },
  "timestamp": "2024-01-19T12:00:00.000Z"
}
```

### Get Metrics History

```http
GET /api/metrics/history
```

Returns last 60 metrics snapshots (1 per second cache)

## Network Management

### Get Network Details

```http
GET /api/network/details
```

**Response:**
```json
{
  "ethernet": {
    "connected": true,
    "interface": "eth0",
    "ipAddress": "192.168.1.100",
    "macAddress": "aa:bb:cc:dd:ee:ff",
    "speed": "1000 Mbps",
    "rx": 125.5,
    "tx": 45.2
  },
  "wifi": {
    "connected": true,
    "interface": "wlan0",
    "ipAddress": "192.168.1.101",
    "ssid": "MyNetwork",
    "signal": -45
  }
}
```

### Get WiFi Status

```http
GET /api/wifi/status
```

**Response:**
```json
{
  "connected": true,
  "ssid": "MyNetwork",
  "signal": -45
}
```

### Scan WiFi Networks

```http
GET /api/wifi/scan
```

**Response:**
```json
[
  {
    "ssid": "Network1",
    "signal": 75,
    "security": true,
    "connected": false
  }
]
```

### Connect to WiFi

```http
POST /api/wifi/connect
Content-Type: application/json

{
  "ssid": "Network1",
  "password": "wifipassword"
}
```

**Security:** Input is validated to prevent command injection

**Response:**
```json
{
  "success": true,
  "message": "Connected successfully"
}
```

## Speed Test

### Run Speed Test

```http
POST /api/speedtest
```

**Response:**
```json
{
  "success": true,
  "ping": 15.2,
  "download": 95.5,
  "upload": 45.2,
  "unit": "ms / Mbit/s",
  "timestamp": "2024-01-19T12:00:00.000Z"
}
```

### Get Speed Test History

```http
GET /api/speedtest/history
```

**Response:**
```json
{
  "history": [
    {
      "timestamp": "2024-01-19T12:00:00.000Z",
      "ping": 15.2,
      "download": 95.5,
      "upload": 45.2
    }
  ]
}
```

## System Administration

### Get System Info

```http
GET /api/system-info
```

**Response:**
```json
{
  "os": {
    "platform": "linux",
    "distro": "Raspberry Pi OS",
    "release": "11",
    "hostname": "raspberrypi",
    "uptime": 1440
  },
  "system": {
    "manufacturer": "Raspberry Pi Foundation",
    "model": "Raspberry Pi 4 Model B",
    "version": "Rev 1.4"
  }
}
```

### Restart Server

```http
POST /api/admin/restart
```

**Response:**
```json
{
  "success": true,
  "message": "Server restarting..."
}
```

### Shutdown Server

```http
POST /api/admin/shutdown
```

**Response:**
```json
{
  "success": true,
  "message": "Server shutting down..."
}
```

### Update and Restart

```http
POST /api/admin/update
```

Pulls latest changes from git and restarts the server.

## Game Scores

### Get Top Scores

```http
GET /api/scores
```

**Response:**
```json
[
  {
    "score": 1500,
    "user": "player@example.com",
    "timestamp": "2024-01-19T12:00:00.000Z"
  }
]
```

### Submit Score

```http
POST /api/scores
Content-Type: application/json

{
  "score": 1500
}
```

**Response:**
```json
{
  "success": true
}
```

## Error Responses

All endpoints return JSON error responses:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (authentication required)
- `404` - Not Found
- `413` - Payload Too Large (file too big)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## CORS

CORS is enabled for all `/api/*` routes:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
