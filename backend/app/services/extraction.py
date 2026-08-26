import json
import re
from typing import Any, List
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
import traceback

from app.core.config import settings

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts text from PDF using PyMuPDF, falling back to OCR if the PDF is image-based.
    """
    full_text = ""
    errors = []
    
    # 1. Try pure-python PyMuPDF extraction first
    try:
        import fitz # use fitz (pymupdf)
        doc = fitz.open(pdf_path)
        for page in doc:
            page_text = page.get_text()
            if page_text:
                full_text += page_text + "\n"
        doc.close()
    except Exception as e:
        errors.append(f"PyMuPDF/fitz error: {str(e)}\n{traceback.format_exc()}")
        try:
            import pymupdf
            doc = pymupdf.open(pdf_path)
            for page in doc:
                page_text = page.get_text()
                if page_text:
                    full_text += page_text + "\n"
            doc.close()
        except Exception as e2:
            errors.append(f"PyMuPDF error: {str(e2)}\n{traceback.format_exc()}")
            # 1.5 Fallback to pure Python pypdf
            try:
                import pypdf
                with open(pdf_path, 'rb') as f:
                    reader = pypdf.PdfReader(f)
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            full_text += text + "\n"
            except Exception as e3:
                errors.append(f"pypdf error: {str(e3)}\n{traceback.format_exc()}")

    # 2. If PyMuPDF extracted meaningful text, return it
    if len(full_text.strip()) > 30:
        return full_text.strip()

    # 3. Fallback to OCR if PyMuPDF extracted nothing (image-only/scanned PDF)
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
        errors.append(f"OCR error: {str(ocr_err)}\n{traceback.format_exc()}")

    # Return whatever text we got, even if it's minimal, rather than failing abruptly.
    if full_text.strip():
        return full_text.strip()
    else:
        error_msg = "\n".join(errors)
        print(f"Extraction completely failed. Errors:\n{error_msg}")
        return f"EXTRACTION_FAILED: {error_msg}"


class MetadataField(BaseModel):
    field: str = Field(description="The name of the extracted metadata field.")
    value: str = Field(description="The extracted value from the document.")

class MetadataResponse(BaseModel):
    metadata: List[MetadataField] = Field(description="List of extracted metadata fields.")


class MetadataExtractor(ABC):
    @abstractmethod
    def extract(self, raw_text: str, document_type: str = "Document") -> dict[str, Any]:
        pass


class GeminiMetadataExtractor(MetadataExtractor):
    def extract(self, raw_text: str, document_type: str = "Document") -> dict[str, Any]:
        if not raw_text or "EXTRACTION_FAILED:" in raw_text:
            return {
                "error": "insufficient_text", 
                "message": f"Insufficient machine-readable text was extracted from this document. Details: {raw_text}"
            }
        
        if not settings.GEMINI_API_KEY:
            print("Gemini API key is not configured, falling back to heuristic")
            return HeuristicMetadataExtractor().extract(raw_text, document_type)

        try:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            
            # Truncate to a safe limit
            if len(raw_text) > 100000:
                text_to_process = raw_text[:80000] + "\n...[CONTENT TRUNCATED]...\n" + raw_text[-20000:]
            else:
                text_to_process = raw_text

            prompt = f"""
            You are an AI assistant analyzing a legal/investigative document.
            Document Type: {document_type}
            
            Your task is to extract a SMALL SET of metadata fields (MAXIMUM 15) that genuinely distinguish and uniquely identify this document in a document management system.
            Examples of good identifiers: Reference numbers, FIR/Case numbers, specific dates, agencies, courts, specific people, legal sections, subject.
            
            CRITICAL RULES:
            - Select ONLY fields actually present in the text.
            - DO NOT hallucinate, infer, or guess any information.
            - If information is ambiguous, omit the field.
            - Do not include generic summaries or repetitive data.
            - Output maximum 15 fields. If only 4 are useful, return 4.

            TEXT:
            {text_to_process}
            """
            
            print(f"Sending {len(text_to_process)} chars of text to Gemini for extraction...")
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MetadataResponse,
                    temperature=0.0
                ),
            )
            
            if response.text:
                result_json = json.loads(response.text)
                metadata_list = result_json.get("metadata", [])
                
                print(f"Gemini returned {len(metadata_list)} fields")
                
                # Flatten for the UI
                structured_dict = {}
                for item in metadata_list:
                    if item.get("field") and item.get("value"):
                        structured_dict[item["field"]] = item["value"]
                
                return structured_dict
            else:
                print("Gemini API returned empty response, falling back to heuristic")
                return HeuristicMetadataExtractor().extract(raw_text, document_type)

        except Exception as e:
            print(f"Gemini API extraction failed: {e}")
            return HeuristicMetadataExtractor().extract(raw_text, document_type)


class HeuristicMetadataExtractor(MetadataExtractor):
    def extract(self, raw_text: str, document_type: str = "Document") -> dict[str, Any]:
        """
        Fast, rule-based heuristic extractor as a fallback.
        """
        data: dict[str, Any] = {}
        
        if not raw_text or "EXTRACTION_FAILED:" in raw_text:
            return data

        text_lower = raw_text.lower()
        
        date_match = re.search(r'(\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b|\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b)', raw_text)
        if date_match:
            data["date_mentioned"] = date_match.group(1)
            
        case_match = re.search(r'(?:case no|case number|cr(?:ime)?\s+no)\s*[:\-\s]*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
        if case_match:
            data["case_number"] = case_match.group(1).strip()
        
        fir_match = re.search(r'\b(?:fir|crime|case)\s*(?:no\.?|number|#|num)\s*[:\-\s]+([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
        if not fir_match:
            fir_match = re.search(r'\b(?:fir|case)\s*[:\-\=]\s*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
        if fir_match and fir_match.group(1).upper() not in ["INFORMATION", "REPORT", "BRANCH", "NO", "NUMBER"]:
            data["fir_number"] = fir_match.group(1).strip()

        ps_match = re.search(r'(?:police\s+station|p\.s\.?|ps)\s*[:\-\s]*([a-zA-Z0-9\s]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
        if ps_match:
            data["police_station"] = ps_match.group(1).strip()

        comp_match = re.search(r'(?:complainant|informant|reported\s+by)\s*[:\-\s]*([a-zA-Z0-9\s\.]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
        if comp_match:
            data["complainant"] = comp_match.group(1).strip()

        acc_match = re.search(r'(?:accused(?:\s+name)?|suspect|perpetrator|against)\s*[:\-\s]*([a-zA-Z0-9\s\.]+?)(?:,|\n|\.|\r|$)', raw_text, re.IGNORECASE)
        if acc_match:
            data["accused"] = acc_match.group(1).strip()

        ipc_matches = re.findall(r'(?:sec(?:tion)?s?|u/s|ipc|it\s+act)\s*[:\-\s]*([0-9A-Za-z,\s]+)', raw_text, re.IGNORECASE)
        sections = []
        for m in ipc_matches:
            parts = [p.strip() for p in re.split(r'[,/&]', m) if any(c.isalnum() for c in p)]
            sections.extend(parts)
        
        if sections:
            data["legal_sections"] = list(dict.fromkeys(sections))[:6]

        if document_type == "Evidence Log":
            id_match = re.search(r'(?:evidence id|item no)\s*[:\-\s]*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
            if id_match:
                data["evidence_id"] = id_match.group(1).strip()
                
            col_date_match = re.search(r'(?:collection date|date of collection)\s*[:\-\s]*(\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b)', raw_text, re.IGNORECASE)
            if col_date_match:
                data["collection_date"] = col_date_match.group(1)

        elif document_type == "Forensic Report":
            rep_match = re.search(r'(?:report no|report number)\s*[:\-\s]*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
            if rep_match:
                data["report_number"] = rep_match.group(1).strip()
                
            lab_match = re.search(r'(?:laboratory|lab name)\s*[:\-\s]*([a-zA-Z0-9\s]+?)(?:,|\n|\.|$)', raw_text, re.IGNORECASE)
            if lab_match:
                data["laboratory"] = lab_match.group(1).strip()

        elif document_type == "Witness Statement":
            wit_match = re.search(r'(?:witness name|name of witness|statement of)\s*[:\-\s]*([a-zA-Z0-9\s]+?)(?:,|\n|\.|$)', raw_text, re.IGNORECASE)
            if wit_match:
                data["witness_name"] = wit_match.group(1).strip()

        elif document_type == "Charge Sheet":
            cs_match = re.search(r'(?:charge sheet no|cs no)\s*[:\-\s]*([a-zA-Z0-9\/\-]+)', raw_text, re.IGNORECASE)
            if cs_match:
                data["charge_sheet_number"] = cs_match.group(1).strip()

        elif document_type in ["Court Filing", "Judgment", "Court Order"]:
            court_match = re.search(r'(?:in the court of|court)\s*[:\-\s]*([a-zA-Z0-9\s]+?)(?:,|\n|\.|$)', raw_text, re.IGNORECASE)
            if court_match:
                data["court"] = court_match.group(1).strip()

        return data


def process_document_pipeline(pdf_path: str, document_type: str = "Document") -> dict[str, Any]:
    """
    Full pipeline: PDF -> Text Extraction -> Structured Data Extraction
    """
    raw_text = extract_text_from_pdf(pdf_path)
    
    if settings.GEMINI_API_KEY:
        extractor = GeminiMetadataExtractor()
    else:
        extractor = HeuristicMetadataExtractor()
        
    structured_data = extractor.extract(raw_text, document_type)
    
    # If extraction failed, ensure the raw_text is cleanly stored (not the traceback)
    # But for debugging, we might want to store the traceback in raw_ocr_text.
    # The user says: "Do not simply report: 'No machine-readable text was found.'"
    
    return {
        "raw_ocr_text": raw_text,
        "structured_data": structured_data
    }
