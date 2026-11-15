
# Vanish Class Network
## Shared Communication Protocol

**Status:** Draft – pending class approval  
**Protocol Version:** 1.0

### 1. Purpose
This protocol defines how all Vanish mobile applications communicate with the shared class relay server.

All teams must follow the same agreed protocol.

### 2. Connection
- Transport: WebSocket (proposed; pending class approval).
- Relay address: To be provided/agreed by the class.
- All teams connect to the same relay.
- Each device identifies itself using a display name and unique device ID.

### 3. Student Identification
Each connecting student provides:
- display_name
- device_id

### 4. Message Format

Every chat message contains:

{
  "id": "unique-message-id",
  "sender": "student-name",
  "text": "message-content",
  "sent_at": 0,
  "expires_at": 0
}

Notes:
- The sender generates a unique message ID.
- The relay provides authoritative timestamps.
- Timestamp units and exact definitions must be agreed by the class.
- Each message has a 30-second lifetime after relay acceptance.

### 5. Message Lifecycle
Created → Waiting → Sent → Delivered → Displayed → Expired

Messages that cannot or should not be sent are dropped.

### 6. Expiry Rules
- The relay determines the authoritative expiry timestamp.
- The relay keeps chat messages in memory only.
- The relay deletes each message after 30 seconds.
- Receiving apps calculate remaining time using expires_at.
- Expired messages must not be displayed or replayed.
- Chat content must not be written to disk or logs.

### 7. Delivery Confirmation
The relay and clients must support delivery confirmation.

Exact acknowledgement message format: Pending class approval.

### 8. Expiry Announcement
The relay announces message expiry to connected clients.

Exact expiry event format: Pending class approval.

### 9. Duplicate Prevention
- Every message must have a unique ID.
- Already processed message IDs must be ignored.
- Reconnection must not cause expired messages to be replayed.

### 10. Heartbeat and Reconnection
The protocol must define:
- Heartbeat message format.
- Heartbeat interval.
- Connection timeout.
- Reconnection behavior.
- Handling of expired messages after reconnection.

Exact values and event formats: Pending class approval.

### 11. Offline Messages
Clients may queue eligible messages while offline.

The class must agree on:
- When an offline message becomes expired.
- Whether an old queued message may be sent.
- How the relay assigns expiry timestamps.

### 12. Shared Server Rules
- All teams use the same relay address.
- All teams use the same protocol version.
- Chat messages remain in relay memory only.
- No team independently changes the shared protocol.
- Protocol changes require whole-class agreement.
