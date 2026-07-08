import os
from pathlib import Path

# Base Directory
BASE_DIR = Path(__file__).resolve().parent

# Authentication settings
JWT_SECRET = os.getenv("JWT_SECRET", "metanno_super_secret_key_123_456_789")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600  # 10 hours

# Database configuration
# If FIREBASE_CREDENTIALS env var points to a json file or is set, we use firebase.
# Otherwise, we use local json database.
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

import sys

if FIREBASE_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS or os.getenv("USE_FIREBASE") == "true":
    DATABASE_MODE = "firebase"
else:
    DATABASE_MODE = "local"

if getattr(sys, "frozen", False):
    LOCAL_DB_DIR = Path.home() / ".metanno"
else:
    LOCAL_DB_DIR = BASE_DIR / "data"

LOCAL_DB_PATH = LOCAL_DB_DIR / "local_db.json"

# Create directories if they do not exist
LOCAL_DB_DIR.mkdir(parents=True, exist_ok=True)
