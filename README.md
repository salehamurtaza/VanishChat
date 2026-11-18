# VANISH — Vanish Class Network

**A Real-Time Messaging Application with Automatically Disappearing Messages**

VANISH (Vanish Class Network) is a mobile messaging application developed as a university Mobile Application Development project. It allows students to join a shared class room and exchange messages in real time.

The application uses WebSocket communication through an externally hosted relay. Messages have a limited lifetime of 30 seconds, while local storage, offline message queuing and automatic reconnection help maintain communication during temporary network interruptions.

VANISH is available as a standalone Android application, allowing users to install and run it without requiring VS Code, Expo Go or a development server.

## Key Features

- **Class Room Connection:** Join a shared class room using a display name and class code.
- **Real-Time Messaging:** Exchange messages through WebSocket communication.
- **Disappearing Messages:** Messages automatically expire according to their expiration timestamps.
- **Countdown Timer:** Displays the remaining lifetime of messages.
- **Message Length Limit:** Supports messages up to 280 characters.
- **Offline Message Queue:** Saves outgoing messages locally when connectivity is unavailable.
- **Automatic Reconnection:** Attempts to reconnect when the network connection is interrupted.
- **Duplicate Prevention:** Uses message IDs and in-flight tracking to help prevent duplicate transmissions.
- **Heartbeat Mechanism:** Sends periodic heartbeat messages to monitor the connection.
- **Clock Synchronization:** Uses relay-provided timestamps to calculate message expiration.
- **Local Data Storage:** Uses SQLite for messages and AsyncStorage for profile information.
- **Settings Screen:** Provides profile and connection settings.
- **Standalone Android Application:** Runs independently after installation.

## Technology Stack

| Technology | Purpose |
|---|---|
| React Native 0.88.1 | Mobile application development |
| Expo SDK 58 | Native modules and application tooling |
| React 19.3 | User interface |
| JavaScript | Application logic |
| Expo SQLite | Local message database |
| AsyncStorage | Profile storage |
| React Native SVG | SVG graphics |
| Expo Linear Gradient | Gradient UI elements |
| WebSocket | Real-time communication |

## Communication Architecture

VANISH connects directly to an externally hosted WebSocket relay for communication between students.

### How Communication Works

1. A student opens the mobile application.
2. The student enters a display name and class code.
3. The application establishes a WebSocket connection with the hosted relay.
4. Outgoing messages are sent through the WebSocket connection.
5. The relay facilitates delivery to other connected students.
6. Receiving applications display the messages and manage their expiration countdown.
7. When connectivity is interrupted, the application uses its local queue and reconnection mechanism to handle pending messages.

The relay configuration is maintained in:

`VanishMobile/src/config.js`

The hosted relay address is intentionally not published in this README.

## Message Lifecycle and Expiration

The application manages messages through different states:

- **Queued:** The message is stored locally while waiting to be sent.
- **Sent:** The message has been transmitted through the WebSocket connection.
- **Delivered:** The message has received a delivery acknowledgement.
- **Expired:** The message has reached its expiration timestamp.

### Expiration Handling

- The configured message lifetime is 30 seconds.
- The application uses relay-provided timestamps for expiration calculations.
- The chat screen refreshes the countdown every second.
- Expired messages are removed from the visible message list.
- Database cleanup deletes expired messages in the sent and delivered states.

## Offline Message Handling

VANISH supports offline message queuing.

When connectivity is unavailable:

1. The outgoing message is saved in the local SQLite database.
2. The application attempts to restore its WebSocket connection.
3. After reconnection, eligible queued messages are checked.
4. Messages are sent through the relay.
5. Queue entries are removed after delivery acknowledgement.
6. Messages older than the configured 60-second queue age are discarded.

The application also uses message IDs and in-flight tracking to help prevent duplicate transmissions.

## Local Storage

VANISH uses two storage technologies.

### SQLite

SQLite stores:
- Message IDs and text.
- Sender and device information.
- Message states.
- Sent and expiration timestamps.
- Queued messages.

The database also includes cleanup functions for deleting expired messages.

### AsyncStorage

AsyncStorage stores the user's profile information, including:
- Display name.
- Device ID.
- Class information.
- Relay configuration.
- Join status.

## Project Structure

```text
VanishChat/
│
├── VanishMobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── SplashScreen.js
│   │   │   ├── JoinScreen.js
│   │   │   ├── ChatScreen.js
│   │   │   └── SettingsScreen.js
│   │   │
│   │   ├── hooks/
│   │   │   └── useRelay.js
│   │   │
│   │   ├── AppNavigator.js
│   │   ├── config.js
│   │   ├── storage.js
│   │   ├── theme.js
│   │   ├── ui.js
│   │   └── utils.js
│   │
│   ├── android/
│   ├── ios/
│   ├── App.js
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## Requirements

### Development Requirements

- Node.js 22.11 or later
- npm
- Java Development Kit (JDK)
- Android Studio
- Android SDK
- Android emulator or physical Android device

### Normal Application Usage

- Android device.
- Installed VANISH application.
- Active internet connection for communication through the hosted relay.

The installed standalone application does not require development tools for normal use.

## Installation and Setup

These instructions are for developers who want to clone and run the mobile application.

### 1. Clone the Repository

```bash
git clone https://github.com/salehamurtaza/VanishChat.git
```

### 2. Open the Mobile Application Directory

```bash
cd VanishChat/VanishMobile
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run on Android

Connect an Android device with USB debugging enabled or start an Android emulator.

Run:

```bash
npm run android
```

Alternatively, start the Metro development server:

```bash
npm start
```

A compatible Android development environment and configured device or emulator are required.

## Standalone Android Application

VANISH supports standalone Android APK installation.

After installation:

- The application runs independently.
- VS Code and Expo Go are not required.
- Metro Bundler is not required for normal use.
- The application connects to the configured hosted relay.
- An internet connection is required for real-time communication.

The APK is distributed separately and is not included in this source repository.

## Important Notes

- The mobile application connects directly to an externally hosted WebSocket relay.
- A locally configured backend server is not required.
- An internet connection is required for real-time communication.
- Offline messages are handled through the local SQLite queue.
- Message expiration is managed using relay-provided timestamps.
- Screenshots, copied text and information stored outside the application cannot be guaranteed to disappear when an in-app message expires.
- Private credentials and sensitive configuration should not be committed to the public repository.

## Project Information

**Project Name:** VANISH — Vanish Class Network

**Project Type:** Mobile Application

**Framework:** React Native

**Programming Language:** JavaScript

**Communication Protocol:** WebSocket

**Local Database:** SQLite

**Platform:** Android

**Application Format:** Standalone APK

**Repository:** https://github.com/salehamurtaza/VanishChat

---

*Developed as a university Mobile Application Development project.*
