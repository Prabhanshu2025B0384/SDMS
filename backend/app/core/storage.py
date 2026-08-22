import boto3
from botocore.client import Config

from app.core.config import settings


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
        region_name='us-east-1' # Default region
    )

def ensure_bucket_exists():
    client = get_storage_client()
    try:
        client.head_bucket(Bucket=settings.CEPH_BUCKET_NAME)
    except Exception:
        try:
            client.create_bucket(Bucket=settings.CEPH_BUCKET_NAME)
        except Exception as e:
            print(f"Warning: Could not create bucket. Is the storage server running? {e}")

# In a real app, you would call ensure_bucket_exists() at startup.
