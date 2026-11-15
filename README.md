# VANISH — Vanish Class Network

VANISH is a mobile communication application developed as a university project. It provides a real-time chat experience through a WebSocket-based relay server.

## Project Structure

```text
VanishClassNetwork/
├── VanishMobile/       # React Native mobile application
├── server/             # Python backend and relay server
├── .gitignore
└── README.md
```

## Technologies Used

### Mobile Application
- React Native
- Expo
- JavaScript
- SQLite
- AsyncStorage
- React Native SVG
- Expo Linear Gradient

### Backend
- Python
- FastAPI
- WebSockets
- SQLite

## Features

- Join the chat using a display name
- Connect to the configured relay server
- Real-time messaging
- Message lifetime of 30 seconds
- Message length limit of 280 characters
- Connection heartbeat and automatic retry configuration
- Local storage for profile and application data
- Message queue and offline-handling support

## Backend Configuration

The mobile application uses the following default relay:

```text
wss://vanish-backend-mcls.onrender.com
```

The relay URL and protocol settings are defined in:

```text
VanishMobile/src/config.js
```

## Requirements

- Node.js 22.11 or later
- npm
- Java Development Kit (JDK)
- Android Studio and Android SDK
- Python 3.10 or later for the backend

## Run the Mobile Application

Open a terminal in the mobile project:

```bash
cd VanishMobile
npm install
```

Start the Expo/React Native development build for Android:

```bash
npx expo run:android
```

To start Metro separately:

```bash
npx expo start
```

A configured Android emulator or connected Android device is required.

## Run the Backend Locally

Open another terminal:

```bash
cd server
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The WebSocket chat endpoint is:

```text
ws://localhost:8000/ws
```

For a physical device, use the computer's reachable local IP address instead of `localhost` when connecting to a locally hosted server. Configure the mobile relay URL accordingly.

## Important Notes

- Do not commit passwords, API keys, private environment files, or local database files.
- Do not upload `node_modules`, build outputs, or temporary logs.
- Install dependencies using the provided package and requirements files.

## Project

**Name:** VANISH — Vanish Class Network  
**Mobile application:** `VanishMobile/`  
**Backend:** `server/`
