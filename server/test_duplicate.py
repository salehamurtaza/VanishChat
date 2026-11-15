
import asyncio
import json
import websockets

SERVER_URL = "ws://127.0.0.1:8000/ws"

JOIN_MESSAGE = {
    "type": "join",
    "class_code": "cs2024",
    "display_name": "Student",
    "device_id": ""
}


async def receive_event(ws, timeout=5):
    while True:
        event = json.loads(
            await asyncio.wait_for(ws.recv(), timeout=timeout)
        )

        if event.get("type") == "ping":
            await ws.send(json.dumps({"type": "pong"}))
            continue

        return event


async def main():
    async with (
        websockets.connect(SERVER_URL) as student1,
        websockets.connect(SERVER_URL) as student2
    ):
        # Join both students
        join1 = JOIN_MESSAGE.copy()
        join1["device_id"] = "duplicate-test-1"

        join2 = JOIN_MESSAGE.copy()
        join2["device_id"] = "duplicate-test-2"

        await student1.send(json.dumps(join1))
        await student2.send(json.dumps(join2))

        await receive_event(student1)
        await receive_event(student2)

        print("[PASS] Both students connected")

        # Send the first message
        message = {
            "id": "duplicate-test-message-001",
            "text": "Testing duplicate protection"
        }

        await student1.send(json.dumps({
            "type": "message",
            "message": message
        }))

        sender_event = await receive_event(student1)
        receiver_event = await receive_event(student2)

        assert sender_event["type"] == "sent"
        assert receiver_event["type"] == "message"

        print("[PASS] First message delivered")

        # Acknowledge the first message
        await student2.send(json.dumps({
            "type": "ack",
            "message_id": message["id"],
            "status": "delivered"
        }))

        delivered = await receive_event(student1)
        assert delivered["type"] == "delivered"

        print("[PASS] First message acknowledged")

        # Send exactly the same message ID again
        await student1.send(json.dumps({
            "type": "message",
            "message": message
        }))

        duplicate_event = await receive_event(student1)

        assert duplicate_event["type"] == "duplicate"
        assert duplicate_event["message_id"] == message["id"]

        print("[PASS] Duplicate message rejected")

        # Confirm receiver does not get the duplicate
        try:
            event = await receive_event(student2, timeout=3)

            if event.get("type") == "message":
                raise AssertionError(
                    "Duplicate message was delivered again"
                )

        except asyncio.TimeoutError:
            print("[PASS] Receiver did not receive duplicate")

        print("\nAll duplicate protection tests passed!")


asyncio.run(main())
