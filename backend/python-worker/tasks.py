import os
import json
import traceback
import requests
from dotenv import load_dotenv

load_dotenv()

from celery_app import app
from extraction import process_document_pipeline

# Spring Boot API URL for webhooks
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080")
# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vshsmnrzeusimlcemzhc.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "SDMS")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "verysecureinternalwebhooksecret123")

@app.task(bind=True, max_retries=3)
def process_document(self, document_id: str, version_id: str, user_id: str, document_type: str, storage_path: str):
    """
    Background job to extract text, run OCR (if needed), 
    and call Gemini AI for metadata.
    Then POST back to Spring Boot webhook.
    """
    print(f"Starting processing for Document ID: {document_id}")
    
    # 1. Fetch PDF from Supabase Storage
    download_url = f"{SUPABASE_URL}/storage/v1/object/authenticated/{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY
    }
    
    import tempfile
    
    try:
        response = requests.get(download_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Save to temp file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            full_pdf_path = tmp_file.name
            
    except Exception as fetch_err:
        error_msg = f"Failed to download file from Supabase: {fetch_err}"
        print(error_msg)
        send_webhook(document_id, {"status": "PROCESSING_FAILED", "failure_reason": error_msg})
        return
        
    try:
        # 2. Extract text and metadata
        result = process_document_pipeline(full_pdf_path, document_type)
        
        # 3. Send successful webhook
        webhook_payload = {
            "status": "READY",
            "raw_ocr_text": result.get("raw_ocr_text", ""),
            "structured_data": result.get("structured_data", {})
        }
        send_webhook(document_id, webhook_payload)
        
        print(f"Successfully processed Document ID: {document_id}")
        
    except Exception as e:
        error_msg = f"Error processing document: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        send_webhook(document_id, {"status": "PROCESSING_FAILED", "failure_reason": str(e)})
        raise self.retry(exc=e, countdown=60)
        
    finally:
        if 'full_pdf_path' in locals() and os.path.exists(full_pdf_path):
            os.remove(full_pdf_path)

def send_webhook(document_id: str, payload: dict):
    webhook_url = f"{API_BASE_URL}/documents/{document_id}/webhook/processed"
    headers = {
        "X-Webhook-Secret": WEBHOOK_SECRET
    }
    try:
        response = requests.post(webhook_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to send webhook to {webhook_url}: {e}")
