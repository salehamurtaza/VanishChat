# VANISH — Vanish Class Network

**A Real-Time Messaging Application with Automatically Disappearing Messages**

VANISH (Vanish Class Network) is a mobile messaging application developed as a university Mobile Application Development project. It allows students to join a shared class room and exchange messages in real time.

The application uses WebSocket communication through an externally hosted relay. Messages have a limited lifetime of **30 seconds**, after which they automatically expire and are removed from the app's visible chat and applicable local message storage.

VANISH also supports local message storage, temporary offline message queuing, automatic reconnection, and duplicate-message prevention.

---

## Features

- **Shared Class Room:** Students can join a class room and communicate with other connected users.
- **Real-Time Messaging:** Messages are exchanged through WebSocket communication.
- **Disappearing Messages:** Messages automatically expire after 30 seconds.
- **Countdown Timer:** Each message displays its remaining lifetime.
- **Message Length Limit:** Messages can contain up to 280 characters.
- **Offline Message Queue:** Temporarily stores outgoing messages when the connection is unavailable.
- **Automatic Reconnection:** Attempts to reconnect when the connection is interrupted.
- **Duplicate Prevention:** Uses message IDs and in-flight tracking to help prevent duplicate delivery.
- **Heartbeat Mechanism:** Periodically checks the connection with the relay.
- **Server Time Synchronization:** Uses relay-provided timestamps to calculate message expiration.
- **Local Database:** Stores messages and queue information using SQLite.
- **Profile Storage:** Saves user profile information locally using AsyncStorage.
- **Settings Screen:** Allows users to manage their app settings and profile.
- **Standalone Android App:** Runs as an installed Android application without requiring Expo Go or a development server during normal use.

---

## Technology Stack

| Technology | Version / Usage |
|---|---|
| React Native | 0.88.1 |
| Expo SDK | 58 |
| React | 19.3.0 |
| JavaScript | Application language |
| Expo SQLite | 58.0.17 |
| AsyncStorage | 2.2.0 |
| React Native SVG | 15.16.0 |
| Expo Linear Gradient | 58.0.4 |
| Expo Vector Icons | 15.1.1 |
| WebSocket | Real-time communication |

### Development Environment

The following versions were installed in the development environment:

| Tool | Version |
|---|---|
| Node.js | 24.19.0 |
| npm | 11.17.0 |
| Java (JDK) | 25.0.2 LTS |

---

## Communication Architecture

VANISH connects directly to an **externally hosted WebSocket relay** for real-time communication.

The application does not require a locally running backend server from this repository.

### How Communication Works

1. A student enters their profile information and joins the class room.
2. The application establishes a WebSocket connection with the hosted relay.
3. When a student sends a message, the application sends it through the WebSocket connection.
4. The relay handles message delivery to other connected students in the same class room.
5. The receiving application stores the message locally and displays its countdown timer.
6. The message expires automatically when its 30-second lifetime ends.

The relay configuration is maintained inside:

`VanishMobile/src/config.js`

The hosted relay address is intentionally not displayed in this README.

---

## Message Lifecycle

Each message follows a lifecycle managed by the application.

| State | Description |
|---|---|
| Queued | The message is waiting to be sent because the connection is unavailable. |
| Sent | The message has been sent through the WebSocket connection. |
| Delivered | The message has been acknowledged as delivered. |
| Expired | The message has reached the end of its lifetime. |

### Message Expiration

- Each message has a lifetime of 30 seconds.
- Relay-provided timestamps are used to calculate expiration.
- The countdown updates every second.
- Expired messages are removed from the visible chat.
- Expired messages in applicable sent and delivered states are cleaned from the local SQLite database.

Expiration applies to messages managed by the application. It cannot guarantee deletion of screenshots, copied text, notifications, or information saved outside the application.

---

## Offline Message Handling

VANISH includes a temporary offline message queue.

When the connection is unavailable:

1. Outgoing messages are saved locally in SQLite.
2. The application attempts to reconnect automatically.
3. When the connection is restored, eligible queued messages are sent.
4. The application waits for delivery acknowledgment before removing a queued message.
5. Messages older than 60 seconds in the queue are discarded.

Message IDs and in-flight tracking help prevent duplicate sending during reconnection and delivery handling.

---

## Local Data Storage

VANISH uses two local storage technologies.

### SQLite (Expo SQLite)

SQLite is used for message-related data, including:

- Message IDs
- Sender information
- Message text
- Device IDs
- Message states
- Sent and expiration timestamps
- Queued messages

### AsyncStorage

AsyncStorage stores local profile and application information, including:

- Display name
- Device ID
- Class information
- Relay configuration
- Join status

---

## Project Structure

```text
VanishClassNetwork/
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
│   ├── App.js
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

---

## Requirements

To set up the development environment, you need:

- Node.js
- npm
- Java Development Kit (JDK)
- Android Studio
- Android SDK
- Android Emulator or a physical Android device

An internet connection is required for communication through the hosted relay.

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/salehamurtaza/VanishChat.git
```

### 2. Navigate to the Mobile Project

```bash
cd VanishChat/VanishMobile
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run on Android

With Android Studio, Android SDK, and the required development environment configured, run:

```bash
npx expo run:android
```

This builds and runs the application on an available Android emulator or connected device.

---

## Standalone Android Application

VANISH is also available as a standalone Android application.

Once installed, the application can be opened and used without:

- VS Code
- Expo Go
- A running Metro development server

An internet connection is still required to communicate with the hosted WebSocket relay.

The standalone APK is distributed separately and is not included in this source repository.

---

## Important Notes

- The application communicates through an externally hosted WebSocket relay.
- No locally configured backend server is required from this repository.
- An internet connection is required for real-time communication.
- Outgoing messages may be temporarily queued when the connection is unavailable.
- Queued messages older than 60 seconds are discarded.
- Message expiration is managed using timestamps and the application's local storage.
- The application cannot guarantee deletion of screenshots, copied text, notifications, or information saved outside the application.
- The hosted relay address is maintained in the application's configuration and is not displayed in this README.

---

## Project Information

| Detail | Description |
|---|---|
| Project Name | VANISH — Vanish Class Network |
| Project Type | Mobile Messaging Application |
| Course | Mobile Application Development |
| Framework | React Native |
| Development Platform | Android |
| Programming Language | JavaScript |
| Communication | WebSocket |
| Local Database | SQLite |
| Local Preferences | AsyncStorage |
| Message Lifetime | 30 Seconds |
| Repository | [VanishChat on GitHub](https://github.com/salehamurtaza/VanishChat) |
