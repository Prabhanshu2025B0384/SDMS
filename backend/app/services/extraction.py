import json
import requests
from typing import Dict, Any
from pdf2image import convert_from_path
import pytesseract
from app.core.config import settings

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Converts a PDF to images and extracts text using Tesseract OCR.
    """
    pages = convert_from_path(pdf_path, 300)
    full_text = ""
    for page in pages:
        text = pytesseract.image_to_string(page)
        full_text += text + "\n"
    return full_text

def extract_structured_data_with_ollama(raw_text: str) -> Dict[str, Any]:
    """
    Sends raw OCR text to a local Ollama model to extract structured data as JSON.
    """
    prompt = f"""
    You are an AI assistant helping a law enforcement agency extract structured data from scanned documents.
    Extract the following fields from the text below:
    - fir_number (string)
    - incident_date (string, YYYY-MM-DD if possible)
    - police_station (string)
    - complainant (string)
    - accused (string)
    - ipc_sections (list of strings)
    - document_type (string, e.g., 'FIR', 'Charge Sheet', 'Witness Statement')

    Return ONLY a valid JSON object. Do not include any explanation or markdown formatting outside the JSON block.

    TEXT:
    {raw_text}
    """
    
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        # The Ollama response 'response' field contains the generated text
        json_str = result.get("response", "{}")
        return json.loads(json_str)
    except Exception as e:
        print(f"Error during Ollama extraction: {e}")
        return {}

def process_document_pipeline(pdf_path: str) -> Dict[str, Any]:
    """
    Full pipeline: PDF -> Text (OCR) -> Structured Data (Ollama)
    """
    raw_text = extract_text_from_pdf(pdf_path)
    structured_data = extract_structured_data_with_ollama(raw_text)
    
    return {
        "raw_ocr_text": raw_text,
        "structured_data": structured_data
    }
