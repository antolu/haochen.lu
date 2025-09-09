from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel, model_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None
    is_admin: bool
    
    @model_validator(mode='before')
    @classmethod
    def convert_uuid_to_str(cls, data):
        if hasattr(data, 'id') and isinstance(data.id, UUID):
            data = dict(data.__dict__) if hasattr(data, '__dict__') else data
            data['id'] = str(data['id'])
        elif isinstance(data, dict) and 'id' in data and isinstance(data['id'], UUID):
            data['id'] = str(data['id'])
        return data
    
    class Config:
        from_attributes = True