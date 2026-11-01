import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import jwt, JWTError
from app.core.config import settings

ALGORITHM = "HS256"
def get_jwt_secret() -> str:
    secret = settings.jwt_secret.strip()
    if not secret:
        raise RuntimeError("JWT_SECRET must be configured before using authentication.")
    return secret

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False

def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
