from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user
from app.core.security import verify_password, create_access_token
from app.crud.user import get_user_by_username, create_admin_user
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.config import settings

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    login_request: LoginRequest,
    db: AsyncSession = Depends(get_session)
):
    # For now, we'll use a simple admin login
    # Later, this can be extended for multiple users
    if login_request.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if login_request.password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check if admin user exists in database, create if not
    user = await get_user_by_username(db, username="admin")
    if not user:
        user = await create_admin_user(db, username="admin", password=settings.admin_password)
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.post("/logout")
async def logout():
    # In a real application, you might want to add token blacklisting
    return {"message": "Successfully logged out"}