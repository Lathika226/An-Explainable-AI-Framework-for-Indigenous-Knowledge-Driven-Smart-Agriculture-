from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User
from app.core.security import decode_access_token

security = HTTPBearer(auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    if not token or not token.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    try:
        user_id_int = int(user_id)
        user = db.get(User, user_id_int)
    except (ValueError, TypeError):
        user = db.query(User).filter(User.mobile_number == str(user_id)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
