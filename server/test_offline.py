
import asyncio
import json
import websockets

SERVER_URL = "ws://127.0.0.1:8000/ws"


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
    # Student 1 connects first. Student 2 is offline.
    async with websockets.connect(SERVER_URL) as student1:

        await student1.send(json.dumps({
            "type": "join",
            "class_code": "cs2024",
            "display_name": "Student 1",
            "device_id": "offline-test-1"
        }))

        joined = await receive_event(student1)
        assert joined["type"] == "joined"

        print("[PASS] Student 1 connected")

        # Student 1 sends a message while Student 2 is offline.
        message = {
            "id": "offline-test-message-001",
            "text": "This message must not reach an offline student"
        }

        await student1.send(json.dumps({
            "type": "message",
            "message": message
        }))

        result = await receive_event(student1)

        assert result["type"] == "not_delivered"
        assert result["message_id"] == message["id"]

        print("[PASS] Server rejected delivery because recipient was offline")

        # Now Student 2 reconnects.
        async with websockets.connect(SERVER_URL) as student2:

            await student2.send(json.dumps({
                "type": "join",
                "class_code": "cs2024",
                "display_name": "Student 2",
                "device_id": "offline-test-2"
            }))

            joined2 = await receive_event(student2)
            assert joined2["type"] == "joined"

            print("[PASS] Student 2 connected after the message was sent")

            # Check that Student 2 does not receive the old message.
            try:
                event = await receive_event(student2, timeout=4)

                if (
                    event.get("type") == "message"
                    and event.get("message", {}).get("id") == message["id"]
                ):
                    raise AssertionError(
                        "Offline message was received after reconnect"
                    )

                print("[INFO] Received unrelated event:", event)

            except asyncio.TimeoutError:
                print("[PASS] No old message received after reconnect")

    print("\nAll offline protection tests passed!")


asyncio.run(main())
