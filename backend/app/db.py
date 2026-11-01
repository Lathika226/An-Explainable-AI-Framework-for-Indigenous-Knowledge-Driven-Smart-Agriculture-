import socket
from sqlalchemy import DateTime, create_engine
from sqlalchemy import inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

def is_postgres_available() -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect(("127.0.0.1", 5432))
        s.close()
        return True
    except Exception:
        return False

def create_db_engine():
    db_url = settings.database_url
    if db_url and "postgresql" in db_url and is_postgres_available():
        try:
            test_engine = create_engine(db_url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
            with test_engine.connect() as conn:
                pass
            return test_engine
        except Exception:
            pass

    # Fast fallback to SQLite agri.db
    sqlite_url = "sqlite:///./agri.db"
    return create_engine(sqlite_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)

engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def migrate_crop_tracking_columns():
    existing_columns = {column["name"] for column in inspect(engine).get_columns("crops")}
    new_columns = {
        "is_custom": "BOOLEAN NOT NULL DEFAULT FALSE",
        "land_size": "FLOAT",
        "land_unit": "VARCHAR(30)",
        "updated_at": str(DateTime().compile(dialect=engine.dialect)),
    }

    with engine.begin() as connection:
        for column_name, column_definition in new_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE crops ADD COLUMN {column_name} {column_definition}")
                )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
