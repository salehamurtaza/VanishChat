
"""
Vanish Class Network - WebSocket Relay

Chat messages are stored in server memory only.
They are not written to the Field Sync SQLite database
or intentionally logged by this application.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


# ---------------------------------
# Shared settings
# ---------------------------------

router = APIRouter()

CLASS_CODE = os.getenv("VANISH_CLASS_CODE", "cs2024")

MESSAGE_LIFETIME_SECONDS = 30
HEARTBEAT_INTERVAL_SECONDS = 20
HEARTBEAT_TIMEOUT_SECONDS = 60

MAX_MESSAGE_CHARS = 2000
MAX_MESSAGE_ID_CHARS = 128

DUPLICATE_RETENTION_SECONDS = MESSAGE_LIFETIME_SECONDS + 60


# ---------------------------------
# Connected devices
# ---------------------------------

@dataclass
class Client:
    websocket: WebSocket
    display_name: str
    device_id: str
    last_pong: float = field(default_factory=time.monotonic)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


# Active connections stored in RAM.
connected_clients: dict[str, Client] = {}

# Active chat messages stored in RAM.
active_messages: dict[str, dict] = {}

# Recently processed message IDs stored in RAM.
seen_message_ids: dict[str, float] = {}

# Expiry tasks stored so they can be tracked.
expiry_tasks: dict[str, asyncio.Task] = {}


# ---------------------------------
# Safe sending
# ---------------------------------

async def send_event(client: Client, event: dict) -> bool:
    """Send a JSON event safely to a connected device."""

    try:
        async with client.send_lock:
            await client.websocket.send_json(event)

        return True

    except Exception:
        return False


async def broadcast_event(event: dict):
    """Send an event to every currently connected device."""

    clients = list(connected_clients.values())

    for client in clients:
        await send_event(client, event)


# ---------------------------------
# Duplicate prevention
# ---------------------------------

def clean_seen_ids():
    """Remove expired duplicate-tracking entries."""

    now = time.monotonic()

    expired_ids = [
        message_id
        for message_id, expiry in seen_message_ids.items()
        if expiry <= now
    ]

    for message_id in expired_ids:
        seen_message_ids.pop(message_id, None)


# ---------------------------------
# Message expiry
# ---------------------------------

async def expire_message(message_id: str, deadline: float):
    """
    Remove a message when its relay-controlled
    monotonic expiry deadline is reached.
    """

    try:
        remaining = deadline - time.monotonic()

        if remaining > 0:
            await asyncio.sleep(remaining)

        message = active_messages.pop(message_id, None)

        if message is not None:
            await broadcast_event({
                "type": "expired",
                "message_id": message_id
            })

    except asyncio.CancelledError:
        raise

    finally:
        expiry_tasks.pop(message_id, None)


# ---------------------------------
# Heartbeat
# ---------------------------------

async def heartbeat(client: Client):
    """
    Send ping every 20 seconds.

    Close the connection if no pong is received
    within 60 seconds.
    """

    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)

            inactive_time = time.monotonic() - client.last_pong

            if inactive_time >= HEARTBEAT_TIMEOUT_SECONDS:
                await client.websocket.close(
                    code=1001,
                    reason="Heartbeat timeout"
                )
                break

            if not await send_event(client, {"type": "ping"}):
                break

    except asyncio.CancelledError:
        raise

    except Exception:
        pass


# ---------------------------------
# Message handling
# ---------------------------------

async def handle_message(client: Client, data: dict):
    """Validate and distribute a new chat message."""

    message_data = data.get("message")

    if not isinstance(message_data, dict):
        await send_event(client, {
            "type": "error",
            "message": "Invalid message"
        })
        return

    message_id = message_data.get("id")
    message_text = message_data.get("text")

    # Validate message ID.
    if (
        not isinstance(message_id, str)
        or not message_id.strip()
        or len(message_id) > MAX_MESSAGE_ID_CHARS
    ):
        await send_event(client, {
            "type": "error",
            "message": "Invalid message ID"
        })
        return

    message_id = message_id.strip()

    # Validate message text.
    if (
        not isinstance(message_text, str)
        or not message_text.strip()
    ):
        await send_event(client, {
            "type": "error",
            "message": "Message text is empty"
        })
        return

    if len(message_text) > MAX_MESSAGE_CHARS:
        await send_event(client, {
            "type": "error",
            "message": "Message exceeds maximum length"
        })
        return

    # Remove old duplicate IDs.
    clean_seen_ids()

    # Reject a previously processed ID.
    if message_id in seen_message_ids:
        await send_event(client, {
            "type": "duplicate",
            "message_id": message_id
        })
        return

    # Find other connected devices.
    recipients = [
        other
        for device_id, other in connected_clients.items()
        if device_id != client.device_id
    ]

    if not recipients:
        await send_event(client, {
            "type": "not_delivered",
            "message_id": message_id,
            "reason": "No other devices are connected"
        })
        return

    # Generate authoritative relay timestamps.
    now = time.time()
    sent_at = int(now)
    expires_at = sent_at + MESSAGE_LIFETIME_SECONDS

    # Use a monotonic clock for the actual expiry timer.
    remaining_lifetime = max(0, expires_at - time.time())
    deadline = time.monotonic() + remaining_lifetime

    message = {
        "id": message_id,
        "sender": client.display_name,
        "text": message_text,
        "sent_at": sent_at,
        "expires_at": expires_at
    }

    # Record this ID to prevent duplicate processing.
    seen_message_ids[message_id] = (
        time.monotonic() + DUPLICATE_RETENTION_SECONDS
    )

    # Track only devices that were intended recipients.
    active_messages[message_id] = {
        "message": message,
        "sender_device_id": client.device_id,
        "expected_recipients": {
            recipient.device_id for recipient in recipients
        },
        "delivered": False,
        "deadline": deadline
    }

    # Schedule expiry before sending to recipients.
    expiry_tasks[message_id] = asyncio.create_task(
        expire_message(message_id, deadline)
    )

    # Tell sender the authoritative message and timestamps.
    sender_ok = await send_event(client, {
        "type": "sent",
        "message": message
    })

    if not sender_ok:
        active_messages.pop(message_id, None)

        task = expiry_tasks.pop(message_id, None)

        if task is not None:
            task.cancel()

        return

    # Send message to connected classmates.
    successful_recipients = set()

    for recipient in recipients:
        success = await send_event(recipient, {
            "type": "message",
            "message": message
        })

        if success:
            successful_recipients.add(recipient.device_id)

    # Remove recipients whose sends failed.
    record = active_messages.get(message_id)

    if record is not None:
        record["expected_recipients"] = successful_recipients

    if not successful_recipients:
        await send_event(client, {
            "type": "not_delivered",
            "message_id": message_id,
            "reason": "Message could not be sent to any recipient"
        })


# ---------------------------------
# Delivery acknowledgement
# ---------------------------------

async def handle_ack(client: Client, data: dict):
    """
    Accept acknowledgement only from an intended
    recipient of the active message.

    Delivered means at least one intended recipient
    confirmed receipt.
    """

    message_id = data.get("message_id")

    if not isinstance(message_id, str):
        return

    record = active_messages.get(message_id)

    if record is None:
        return

    # Reject acknowledgements after expiry.
    if time.monotonic() >= record["deadline"]:
        return

    # Ignore acknowledgement from the sender.
    if client.device_id == record["sender_device_id"]:
        return

    # Ignore acknowledgement from an unintended device.
    if client.device_id not in record["expected_recipients"]:
        return

    # Only the first valid acknowledgement is needed.
    if record["delivered"]:
        return

    record["delivered"] = True

    sender = connected_clients.get(record["sender_device_id"])

    if sender is not None:
        await send_event(sender, {
            "type": "delivered",
            "message_id": message_id,
            "status": "delivered"
        })


# ---------------------------------
# WebSocket endpoint
# ---------------------------------

@router.websocket("/ws")
async def vanish_websocket(websocket: WebSocket):

    await websocket.accept()

    client = None
    heartbeat_task = None

    try:
        # First event must identify the student.
        join_data = await websocket.receive_json()

        if not isinstance(join_data, dict):
            await websocket.close(
                code=1008,
                reason="Invalid join data"
            )
            return

        if join_data.get("type") != "join":
            await websocket.close(
                code=1008,
                reason="Join required"
            )
            return

        if join_data.get("class_code") != CLASS_CODE:
            await websocket.close(
                code=1008,
                reason="Invalid class code"
            )
            return

        display_name = join_data.get("display_name")
        device_id = join_data.get("device_id")

        if (
            not isinstance(display_name, str)
            or not display_name.strip()
            or len(display_name) > 80
        ):
            await websocket.close(
                code=1008,
                reason="Invalid display name"
            )
            return

        if (
            not isinstance(device_id, str)
            or not device_id.strip()
            or len(device_id) > 128
        ):
            await websocket.close(
                code=1008,
                reason="Invalid device ID"
            )
            return

        client = Client(
            websocket=websocket,
            display_name=display_name.strip(),
            device_id=device_id.strip()
        )

        # Replace an older connection from this device.
        old_client = connected_clients.get(client.device_id)

        if old_client is not None:
            await old_client.websocket.close(
                code=1001,
                reason="Device reconnected"
            )

        connected_clients[client.device_id] = client

        joined = await send_event(client, {
            "type": "joined",
            "status": "connected",
            "protocol_version": "1.0"
        })

        if not joined:
            return

        heartbeat_task = asyncio.create_task(
            heartbeat(client)
        )

        # Listen for events from this device.
        while True:

            data = await websocket.receive_json()

            if not isinstance(data, dict):
                continue

            event_type = data.get("type")

            if event_type == "message":
                await handle_message(client, data)

            elif event_type == "ack":
                await handle_ack(client, data)

            elif event_type == "pong":
                client.last_pong = time.monotonic()

            elif event_type == "ping":
                await send_event(client, {
                    "type": "pong"
                })

    except WebSocketDisconnect:
        pass

    except Exception:
        # Do not log message content or sensitive event data.
        pass

    finally:

        # Stop and clean up the heartbeat task.
        if heartbeat_task is not None:
            heartbeat_task.cancel()

            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        # Remove only this connection.
        # Do not remove a newer replacement connection.
        if client is not None:
            if connected_clients.get(client.device_id) is client:
                connected_clients.pop(client.device_id, None)
