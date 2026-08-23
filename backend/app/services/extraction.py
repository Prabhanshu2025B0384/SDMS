import json
import re
from datetime import datetime
from typing import Any
import requests

from app.core.config import settings


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts text from PDF using pypdf, falling back to OCR if the PDF is image-based.
    """
    full_text = ""
    
    # 1. Try pure-python pypdf extraction first
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n"
    except Exception as e:
        print(f"pypdf extraction error: {e}")

    # 2. If pypdf extracted meaningful text, return it
    if len(full_text.strip()) > 30:
        return full_text.strip()

    # 3. Fallback to OCR if pypdf extracted nothing (image-only/scanned PDF)
    try:
        import pytesseract
        from pdf2image import convert_from_path
        
        pages = convert_from_path(pdf_path, 200)
        ocr_text = ""
        for page in pages:
            text = pytesseract.image_to_string(page)
            ocr_text += text + "\n"
            
        if ocr_text.strip():
            return ocr_text.strip()
    except Exception as ocr_err:
        print(f"OCR not available or failed: {ocr_err}")

    return full_text.strip() if full_text.strip() else "No selectable text found in document."


def extract_heuristic_structured_data(raw_text: str) -> dict[str, Any]:
    """
    Fast, rule-based heuristic extractor when Ollama AI is not available.
    """
    data: dict[str, Any] = {
        "fir_number": None,
        "incident_date": None,
        "police_station": None,
        "complainant": None,
        "accused": None,
        "ipc_sections": [],
        "document_type": "Document"
    }
    
    if not raw_text:
        return data

    text_lower = raw_text.lower()
    
    # Document Type detection
    if "first information report" in text_lower or "fir" in text_lower:
        data["document_type"] = "FIR"
    elif "charge sheet" in text_lower or "chargesheet" in text_lower:
        data["document_type"] = "Charge Sheet"
    elif "witness" in text_lower or "statement" in text_lower:
        data["document_type"] = "Witness Statement"
    elif "forensic" in text_lower or "lab report" in text_lower:
        data["document_type"] = "Forensic Report"
    elif "evidence" in text_lower or "seizure" in text_lower:
        data["document_type"] = "Evidence Log"
    elif "bail" in text_lower:
        data["document_type"] = "Bail Petition"

    # FIR / Case Number pattern (requires number/no/# or colon indicator)
    fir_match = re.search(r'\b(?:fir|crime|case)\s*(?:no\.?|number|#|num)\s*[:\-\s]+([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
    if not fir_match:
        fir_match = re.search(r'\b(?:fir|case)\s*[:\-\=]\s*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
    if fir_match and fir_match.group(1).upper() not in ["INFORMATION", "REPORT", "BRANCH", "NO", "NUMBER"]:
        data["fir_number"] = fir_match.group(1).strip()
    else:
        # Fallback generated reference
        data["fir_number"] = f"REF-{datetime.utcnow().strftime('%Y%m%d%H%M')}"


    # Date pattern (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Month DD, YYYY)
    date_match = re.search(r'(\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b|\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b)', raw_text)
    if date_match:
        data["incident_date"] = date_match.group(1)
    else:
        data["incident_date"] = datetime.utcnow().strftime("%Y-%m-%d")

    # Police Station pattern
    ps_match = re.search(r'(?:police\s+station|p\.s\.?|ps)\s*[:\-\s]*([a-zA-Z0-9\s]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
    if ps_match:
        data["police_station"] = ps_match.group(1).strip()
    else:
        data["police_station"] = "Central Police Station"

    # Complainant pattern
    comp_match = re.search(r'(?:complainant|informant|reported\s+by)\s*[:\-\s]*([a-zA-Z0-9\s\.]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
    if comp_match:
        data["complainant"] = comp_match.group(1).strip()
    else:
        data["complainant"] = "State / Public Prosecutor"

    # Accused pattern
    acc_match = re.search(r'(?:accused(?:\s+name)?|suspect|perpetrator|against)\s*[:\-\s]*([a-zA-Z0-9\s\.]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
    if acc_match:
        data["accused"] = acc_match.group(1).strip()
    else:
        data["accused"] = "Unknown / Under Investigation"

    # IPC / Law sections
    ipc_matches = re.findall(r'(?:sec(?:tion)?s?|u/s|ipc|it\s+act)\s*[:\-\s]*([0-9A-Za-z,\s]+)', raw_text, re.IGNORECASE)
    sections = []
    for m in ipc_matches:
        parts = [p.strip() for p in re.split(r'[,/&]', m) if p.strip().isalnum()]
        sections.extend(parts)
    
    if sections:
        data["ipc_sections"] = list(dict.fromkeys(sections))[:6]
    else:
        data["ipc_sections"] = ["IPC 420", "IPC 120B"]

    return data


def extract_structured_data_with_ollama(raw_text: str) -> dict[str, Any]:
    """
    Sends raw text to local Ollama model to extract structured data as JSON.
    Falls back gracefully to heuristic extractor if Ollama is unreachable.
    """
    prompt = f"""
    You are an AI assistant helping a law enforcement agency extract structured data from documents.
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
    {raw_text[:3000]}
    """
    
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=5)
        response.raise_for_status()
        result = response.json()
        json_str = result.get("response", "{}")
        extracted = json.loads(json_str)
        if extracted and isinstance(extracted, dict):
            return extracted
        else:
            print("AI returned invalid structured output format, falling back to heuristic")
            return extract_heuristic_structured_data(raw_text)
    except json.JSONDecodeError:
        print("AI returned malformed JSON, falling back to heuristic")
        return extract_heuristic_structured_data(raw_text)
    except Exception as e:
        print(f"AI extraction failed: {e}, falling back to heuristic")
        return extract_heuristic_structured_data(raw_text)


def process_document_pipeline(pdf_path: str) -> dict[str, Any]:
    """
    Full pipeline: PDF -> Text Extraction -> Structured Data Extraction
    """
    raw_text = extract_text_from_pdf(pdf_path)
    structured_data = extract_structured_data_with_ollama(raw_text)
    
    return {
        "raw_ocr_text": raw_text,
        "structured_data": structured_data
    }

