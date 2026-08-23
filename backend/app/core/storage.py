import os
from pathlib import Path
import boto3
from botocore.client import Config

from app.core.config import settings


def ensure_storage_ready():
    """
    Ensures local storage directory exists, and optionally S3 bucket if configured.
    """
    # Always ensure local storage dir exists
    Path(settings.STORAGE_LOCAL_DIR).mkdir(parents=True, exist_ok=True)
    
    if settings.STORAGE_TYPE == "s3":
        try:
            client = get_storage_client()
            client.head_bucket(Bucket=settings.CEPH_BUCKET_NAME)
        except Exception:
            try:
                client = get_storage_client()
                client.create_bucket(Bucket=settings.CEPH_BUCKET_NAME)
            except Exception as e:
                print(f"Warning: S3 bucket setup failed, will fallback to local storage: {e}")


def get_storage_client():
    """
    Returns an S3-compatible client for Ceph or MinIO.
    """
    return boto3.client(
        's3',
        endpoint_url=settings.CEPH_ENDPOINT_URL,
        aws_access_key_id=settings.CEPH_ACCESS_KEY,
        aws_secret_access_key=settings.CEPH_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )


def save_storage_file(storage_path: str, data: bytes) -> str:
    """
    Saves file to local disk and/or S3.
    """
    # 1. Local filesystem storage
    local_full_path = Path(settings.STORAGE_LOCAL_DIR) / storage_path
    local_full_path.parent.mkdir(parents=True, exist_ok=True)
    with open(local_full_path, "wb") as f:
        f.write(data)

    # 2. Optionally mirror to S3 if configured
    if settings.STORAGE_TYPE == "s3":
        try:
            s3 = get_storage_client()
            s3.put_object(
                Bucket=settings.CEPH_BUCKET_NAME,
                Key=storage_path,
                Body=data,
                ContentType='application/pdf'
            )
        except Exception as e:
            print(f"Warning: S3 put_object failed ({e}), saved to local storage at {local_full_path}")

    return str(local_full_path)


def get_storage_file(storage_path: str) -> bytes:
    """
    Retrieves file bytes from local disk or S3.
    """
    local_full_path = Path(settings.STORAGE_LOCAL_DIR) / storage_path
    if local_full_path.exists():
        with open(local_full_path, "rb") as f:
            return f.read()

    # Fallback to S3 if not found locally
    try:
        s3 = get_storage_client()
        obj = s3.get_object(Bucket=settings.CEPH_BUCKET_NAME, Key=storage_path)
        return obj['Body'].read()
    except Exception as e:
        raise FileNotFoundError(f"Document file not found at {storage_path}: {e}")

