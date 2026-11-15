
"""
Shared protocol definitions for Vanish Class Network.

This file defines the common data structures used by
the mobile applications and the relay server.
"""

from pydantic import BaseModel, ConfigDict, Field


# Shared protocol version
PROTOCOL_VERSION = "1.0"

# Every chat message has a 30-second lifetime.
MESSAGE_LIFETIME_SECONDS = 30


class DeviceIdentity(BaseModel):
    """
    Identifies a student device when it connects.
    """

    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1)
    device_id: str = Field(min_length=1)


class ChatMessage(BaseModel):
    """
    Standard chat message format shared by all teams.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    sender: str = Field(min_length=1)
    text: str
    sent_at: int
    expires_at: int
