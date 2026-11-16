# VANISH — Vanish Class Network

**A Real-Time Messaging Application with Automatically Disappearing Messages**

VANISH (Vanish Class Network) is a mobile messaging application developed as a university Mobile Application Development project. It provides a real-time communication platform where classmates can join a shared chat room and exchange messages.

The application uses a WebSocket-based relay server for real-time communication. Messages have a limited lifetime of 30 seconds, while local storage and offline message queuing help maintain the messaging experience during temporary connectivity interruptions.

VANISH is also available as a standalone Android application (APK), allowing users to install and run it directly on their devices without requiring VS Code, Expo Go, or a development environment.

## Key Features

- **Shared Chat Room:** Join the chat using a display name.
- **Real-Time Messaging:** Exchange messages through WebSocket communication.
- **Disappearing Messages:** Messages automatically expire after 30 seconds from relay delivery.
- **Message Length Limit:** Supports messages up to 280 characters.
- **Offline Message Queue:** Temporarily stores outgoing messages when connectivity is unavailable.
- **Automatic Reconnection:** Attempts to reconnect when the connection is interrupted.
- **Duplicate Prevention:** Helps prevent duplicate message processing.
- **Heartbeat Mechanism:** Monitors the connection with periodic heartbeat messages.
- **Local Data Storage:** Uses SQLite and AsyncStorage for local application data.
- **Settings Screen:** Provides access to application settings.
- **Standalone Android Application:** Can be installed and launched directly as an APK without requiring development tools.

## Technology Stack

### Mobile Application

| Technology | Purpose |
|---|---|
| React Native | Mobile application development |
| Expo | Development and build tooling |
| JavaScript | Application logic |
| SQLite | Local database and message storage |
| AsyncStorage | Local profile and application data |
| React Native SVG | SVG graphics |
| Expo Linear Gradient | Gradient UI elements |

### Backend

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| FastAPI | Backend framework |
| WebSockets | Real-time communication |
| SQLite | Backend data storage |

## Project Structure

```text
VanishChat/
│
├── VanishMobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── hooks/
│   │   ├── config.js
│   │   └── ...
│   ├── android/
│   ├── package.json
│   └── ...
│
├── server/
│   ├── main.py
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

## System Architecture

The application follows a client-server communication model.

1. A user opens the mobile application.
2. The user joins the shared chat using a display name.
3. The mobile application establishes a WebSocket connection with the relay server.
4. Messages are sent to the server and relayed to connected users.
5. Messages automatically expire after their configured lifetime.
6. If connectivity is interrupted, the application uses its offline queue and reconnection mechanism to handle pending messages.

```text
        Mobile User 1
              |
              |
        WebSocket
              |
              v
       VANISH Relay Server
              |
              |
        WebSocket
              |
              v
        Mobile User 2
```

## Backend Configuration

The mobile application is configured to use the following hosted relay server by default:

```text
wss://vanish-backend-mcls.onrender.com
```

The relay URL and protocol settings can be found in:

```text
VanishMobile/src/config.js
```

The application can also be configured to connect to a locally running backend.

## Standalone Android Application

VANISH supports standalone Android APK installation. Users can install and launch the application directly on an Android device without running the development server.

### Standalone Application Features

- Runs independently after installation.
- Does not require VS Code or Expo Go.
- Does not require Metro Bundler for normal usage.
- Connects to the configured WebSocket relay server.
- Supports real-time messaging through the hosted backend.

**Note:** An active internet connection is required for communication with the hosted relay server.

## Requirements

### For Development

Before running the project in a development environment, make sure you have:

- Node.js 22.11 or later
- npm
- Python 3.10 or later
- Java Development Kit (JDK)
- Android Studio
- Android SDK
- An Android emulator or physical Android device

### For Normal Application Usage

- An Android device.
- The installed VANISH APK.
- An active internet connection.

No development tools are required to run the installed standalone application.

## Installation and Setup

The following instructions are for developers who want to clone, configure, and run the project.

### 1. Clone the Repository

```bash
git clone https://github.com/salehamurtaza/VanishChat.git
```

Navigate to the project directory:

```bash
cd VanishChat
```

### 2. Set Up the Backend

Open a terminal in the backend directory:

```bash
cd server
```

Install the required Python packages:

```bash
pip install -r requirements.txt
```

Start the backend server:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The local WebSocket endpoint is:

```text
ws://localhost:8000/ws
```

For a physical Android device, use your computer's reachable local IP address instead of `localhost` and configure the mobile application's relay URL accordingly.

### 3. Set Up the Mobile Application

Open another terminal in the project directory:

```bash
cd VanishMobile
```

Install dependencies:

```bash
npm install
```

Run the application on an Android device or emulator:

```bash
npx expo run:android
```

Alternatively, start the Expo development server:

```bash
npx expo start
```

A compatible Android development environment and configured device or emulator are required.

## Important Notes

- Keep passwords, API keys, private credentials, and environment files out of the public repository.
- Do not commit `node_modules`, generated build files, local databases, or temporary logs.
- Install project dependencies using the provided dependency files.
- The local backend and hosted relay are alternative server configurations; use the appropriate WebSocket URL for your environment.
- The standalone Android application uses the configured relay server and requires internet connectivity for messaging.

## Project Information

**Project Name:** VANISH — Vanish Class Network

**Project Type:** Mobile Application

**Development Framework:** React Native

**Backend Framework:** FastAPI

**Communication Protocol:** WebSocket

**Platform:** Android

**Application Format:** Standalone APK

**Repository:** https://github.com/salehamurtaza/VanishChat

---

*Developed as a university Mobile Application Development project.*
