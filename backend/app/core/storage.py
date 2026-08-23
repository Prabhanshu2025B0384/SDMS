import os
from pathlib import Path
from supabase import create_client, Client, ClientOptions

from app.core.config import settings


def get_supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase configuration is missing.")
    options = ClientOptions(auto_refresh_token=False, persist_session=False)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=options)


def ensure_storage_ready():
    """
    Ensures Supabase client can be initialized.
    """
    try:
        get_supabase_client()
    except Exception as e:
        print(f"Warning: Supabase client initialization failed: {e}")


def save_storage_file(storage_path: str, data: bytes) -> str:
    """
    Saves file to Supabase Storage bucket.
    """
    client = get_supabase_client()
    try:
        # Use upsert to handle retries without failing
        client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
    except Exception as e:
        raise Exception(f"Failed to upload document to Supabase Storage: {e}")

    return storage_path


def get_storage_file(storage_path: str) -> bytes:
    """
    Retrieves file bytes from Supabase Storage bucket.
    """
    client = get_supabase_client()
    try:
        response = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).download(storage_path)
        return response
    except Exception as e:
        raise FileNotFoundError(f"Document file not found at {storage_path}: {e}")


