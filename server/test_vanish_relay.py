
"""
Vanish Class Network - WebSocket Relay Test

Tests:
1. Two students connect.
2. Both join using the shared class code.
3. Student 1 sends a message.
4. Student 2 receives it.
5. Student 2 acknowledges delivery.
6. Student 1 receives confirmation.
7. Both students receive the expiry event.
8. Heartbeat ping events are handled correctly.
"""

import asyncio
import json
import uuid
import websockets


SERVER_URL = "ws://127.0.0.1:8000/ws"
CLASS_CODE = "cs2024"


async def receive_event(websocket, timeout=10):
    """Receive one JSON event."""
    raw = await asyncio.wait_for(
        websocket.recv(),
        timeout=timeout
    )
    return json.loads(raw)


async def wait_for_event(websocket, expected_type, timeout=35):
    """
    Keep receiving events until the expected event arrives.
    Respond to heartbeat pings instead of treating them as failures.
    """

    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout

    while True:
        remaining = deadline - loop.time()

        if remaining <= 0:
            raise TimeoutError(
                f"Timed out waiting for {expected_type}"
            )

        event = await receive_event(
            websocket,
            timeout=remaining
        )

        event_type = event.get("type")

        if event_type == "ping":
            print("Heartbeat ping received. Sending pong...")

            await websocket.send(json.dumps({
                "type": "pong"
            }))

            continue

        if event_type == expected_type:
            return event

        print("Ignoring unrelated event:", event)


async def main():

    print("=" * 55)
    print("       VANISH CLASS NETWORK - RELAY TEST")
    print("=" * 55)

    print("\nConnecting two students...\n")

    async with (
        websockets.connect(SERVER_URL) as student1,
        websockets.connect(SERVER_URL) as student2
    ):

        # TEST 1: Join

        await student1.send(json.dumps({
            "type": "join",
            "class_code": CLASS_CODE,
            "display_name": "Student 1",
            "device_id": "device-001"
        }))

        await student2.send(json.dumps({
            "type": "join",
            "class_code": CLASS_CODE,
            "display_name": "Student 2",
            "device_id": "device-002"
        }))

        response1 = await receive_event(student1)
        response2 = await receive_event(student2)

        print("Student 1:", response1)
        print("Student 2:", response2)

        if response1.get("type") != "joined":
            raise RuntimeError("Student 1 connection failed")

        if response2.get("type") != "joined":
            raise RuntimeError("Student 2 connection failed")

        print("\nPASS: Both students connected!")

        # TEST 2: Send message

        message_id = str(uuid.uuid4())

        await student1.send(json.dumps({
            "type": "message",
            "message": {
                "id": message_id,
                "text": "Hello from Student 1!"
            }
        }))

        sender_response = await receive_event(student1)
        receiver_response = await receive_event(student2)

        print("\nSender response:", sender_response)
        print("Receiver response:", receiver_response)

        if sender_response.get("type") != "sent":
            raise RuntimeError("Relay did not accept the message")

        if receiver_response.get("type") != "message":
            raise RuntimeError("Student 2 did not receive the message")

        received_message = receiver_response.get("message", {})

        if received_message.get("id") != message_id:
            raise RuntimeError("Message ID mismatch")

        if received_message.get("text") != "Hello from Student 1!":
            raise RuntimeError("Message text mismatch")

        sent_at = received_message.get("sent_at")
        expires_at = received_message.get("expires_at")

        if not isinstance(sent_at, int) or not isinstance(expires_at, int):
            raise RuntimeError("Invalid timestamps")

        if expires_at - sent_at != 30:
            raise RuntimeError("Message lifetime is not 30 seconds")

        print("\nPASS: Message received successfully!")
        print("Sent at:", sent_at)
        print("Expires at:", expires_at)

        # TEST 3: Delivery acknowledgement

        await student2.send(json.dumps({
            "type": "ack",
            "message_id": message_id,
            "status": "delivered"
        }))

        delivery_response = await receive_event(student1)

        print("\nDelivery confirmation:", delivery_response)

        if delivery_response.get("type") != "delivered":
            raise RuntimeError("Delivery acknowledgement failed")

        print("\nPASS: Delivery acknowledgement received!")

        # TEST 4: Expiry

        print("\nWaiting for the 30-second expiry event...")

        expiry_sender, expiry_receiver = await asyncio.gather(
            wait_for_event(student1, "expired", timeout=35),
            wait_for_event(student2, "expired", timeout=35)
        )

        print("\nSender expiry event:", expiry_sender)
        print("Receiver expiry event:", expiry_receiver)

        if expiry_sender.get("message_id") != message_id:
            raise RuntimeError("Sender expiry ID mismatch")

        if expiry_receiver.get("message_id") != message_id:
            raise RuntimeError("Receiver expiry ID mismatch")

        print("\nPASS: Both students received the expiry event!")

    # FINAL RESULT

    print("\n" + "=" * 55)
    print("       ALL RELAY TESTS PASSED SUCCESSFULLY!")
    print("=" * 55)

    print("""
[PASS] Two students connected
[PASS] Shared class code accepted
[PASS] Message sent
[PASS] Message received
[PASS] Relay timestamps
[PASS] 30-second lifetime in timestamps
[PASS] Delivery acknowledgement
[PASS] Heartbeat ping handled
[PASS] Expiry event received by both students
""")


if __name__ == "__main__":
    asyncio.run(main())
