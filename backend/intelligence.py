import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import requests
from dotenv import load_dotenv

# Firebase Imports
import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(override=True)

# --- Configuration & Initialization ---

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

# Initialize Mistral (Handle v0.x and v1.x)
mistral_client = None
is_legacy_mistral = False

if MISTRAL_API_KEY:
    try:
        # Try new v1.x import
        from mistralai import Mistral
        mistral_client = Mistral(api_key=MISTRAL_API_KEY)
        logger.info("✅ Initialized Mistral SDK (v1.x)")
    except ImportError:
        try:
            # Fallback to old v0.x import
            from mistralai.client import MistralClient
            from mistralai.models.chat_completion import ChatMessage
            mistral_client = MistralClient(api_key=MISTRAL_API_KEY)
            is_legacy_mistral = True
            logger.info("✅ Initialized Mistral SDK (Legacy v0.x)")
        except ImportError:
            logger.error("❌ Could not import 'mistralai'. Please pip install mistralai")
else:
    logger.warning("⚠️ Missing MISTRAL_API_KEY")

# Initialize Firebase
db = None

def initialize_firebase():
    global db
    if db:
        return db

    try:
        # 0. Check Environment Variable (Base64 encoded JSON) - Best for Cloud/Render
        env_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
        if env_creds:
            try:
                import base64
                decoded_json = base64.b64decode(env_creds).decode('utf-8')
                creds_dict = json.loads(decoded_json)
                cred = credentials.Certificate(creds_dict)
                if not firebase_admin._apps:
                    firebase_admin.initialize_app(cred)
                db = firestore.client()
                logger.info("🔥 Firebase Admin Initialized from Env Var successfully.")
                return db
            except Exception as e:
                logger.error(f"❌ Failed to load credentials from Env Var: {e}")

        # Check standard locations
        possible_paths = [
            "serviceAccountKey.json",
            "../serviceAccountKey.json",
            "../intelligence-service/serviceAccountKey.json"
        ]
        
        cred_path = None
        for path in possible_paths:
            if os.path.exists(path):
                cred_path = path
                break
        
        if cred_path:
            logger.info(f"🔍 Found service account at: {cred_path}")
            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            logger.info("🔥 Firebase Admin Initialized from File successfully.")
        else:
            logger.warning("⚠️ serviceAccountKey.json not found. Firebase features will be disabled.")
            
    except Exception as e:
        logger.error(f"❌ Failed to initialize Firebase: {e}")
        print(f"CRITICAL FIREBASE ERROR: {e}") # Ensure it shows in Render logs

initialize_firebase()


# --- Helper Functions ---

def derive_type_from_url(url: Optional[str]) -> str:
    if not url: return 'text'
    u = url.lower()
    if 'youtube.com' in u or 'youtu.be' in u: return 'youtube'
    if 'linkedin.com' in u: return 'linkedin'
    if 'twitter.com' in u or 'x.com' in u: return 'twitter'
    if 'reddit.com' in u: return 'reddit'
    if 'github.com' in u: return 'github'
    if u.endswith('.pdf'): return 'pdf'
    return 'article'

def scrape_with_firecrawl(url: str) -> Dict[str, Any]:
    logger.info(f"🕷️ Starting Firecrawl Scrape for: {url}")
    if not FIRECRAWL_API_KEY:
        raise ValueError("Missing FIRECRAWL_API_KEY")

    try:
        response = requests.post(
            'https://api.firecrawl.dev/v1/scrape',
            headers={
                'Authorization': f"Bearer {FIRECRAWL_API_KEY}",
                'Content-Type': 'application/json'
            },
            json={
                "url": url,
                "formats": ['markdown'],
                "onlyMainContent": False
            },
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                logger.info(f"✅ Scrape Success. Length: {len(data['data'].get('markdown', ''))}")
                return data['data']
            else:
                raise ValueError("Firecrawl returned unsuccessful response")
        else:
             raise ValueError(f"Firecrawl API error: {response.status_code}")

    except Exception as e:
        logger.error(f"❌ Firecrawl Error: {str(e)}")
        raise e

def analyze_content_mistral(text: str) -> Dict[str, Any]:
    logger.info("🧠 Starting Mistral Analysis...")
    if not mistral_client:
        raise ValueError("Mistral Client not initialized")

    todays_timestamp = datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat()
    system_prompt = f"""
        You are an expert data analysis engine. Analyze the text and extract specific info.
        Output MUST be valid JSON.
        Keys: "title", "summary", "keywords" (array), "emotions" (array),
        "timestamp" (use {todays_timestamp} if none found), "source_url".
    """
    
    user_content = f"Analyze this text:\n---\n{text[:50000]}... (truncated)\n---"

    try:
        json_response_text = ""
        
        if is_legacy_mistral:
            # V0.x Logic
            from mistralai.models.chat_completion import ChatMessage
            completion = mistral_client.chat(
                model='mistral-small-latest', 
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    ChatMessage(role='system', content=system_prompt),
                    ChatMessage(role='user', content=user_content)
                ]
            )
            json_response_text = completion.choices[0].message.content
        else:
            # V1.x Logic
            completion = mistral_client.chat.complete(
                model='mistral-small-latest', 
                temperature=0.2,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content}
                ],
                response_format={"type": "json_object"},
            )
            json_response_text = completion.choices[0].message.content

        # Cleanup and Parse
        json_response_text = (json_response_text or '{}').replace("```json", "").replace("```", "").strip()
        data = json.loads(json_response_text)
        logger.info(f"✅ Mistral Analysis Complete. Emotions: {data.get('emotions')}")
        return data

    except Exception as e:
        logger.error(f"❌ Mistral Analysis Error: {str(e)}")
        raise e

async def process_intelligence_data(url: Optional[str], text: Optional[str], title: Optional[str]) -> Dict[str, Any]:
    logger.info("-----------------------------------------")
    logger.info(f"📥 Received Request. URL: {url or 'N/A'}")

    # FORCE DB CHECK 
    if not db:
        logger.error("❌ CRITICAL: Attempting to process data but Database is not initialized.")
        return {"success": False, "error": "Database Connection Failed. Check server logs."}

    if not url and not text:
         raise ValueError("Either URL or text content is required")

    content_to_analyze = ""
    final_url = url or None
    is_local = url and ('localhost' in url or '127.0.0.1' in url)

    # Scrape
    if url and not is_local:
        try:
            scrape_result = scrape_with_firecrawl(url)
            content_to_analyze = scrape_result.get('markdown', "")
            if title or text:
                 content_to_analyze = f"User Note: {title} {text}\n\nScraped:\n{content_to_analyze}"
        except Exception as scrape_err:
            logger.warning(f"⚠️ Scraping failed: {scrape_err}")
            if text:
                content_to_analyze = f"User Note: {title}\n\n{text}"
            else:
                 raise scrape_err
    else:
        logger.info("ℹ️ Using provided text.")
        content_to_analyze = f"Title: {title}\nContent: {text}"

    # Analyze
    analysis_data = analyze_content_mistral(content_to_analyze or "No content")

    # Construct Memory
    final_memory = {
        **analysis_data,
        "title": analysis_data.get('title') or title or 'Untitled Memory',
        "url": final_url,
        "original_url": final_url,
        "firecrawl_metadata": "",
        "full_content": "", 
        "created_at": datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat(),
        "type": derive_type_from_url(final_url),
        "favorite": False
    }

    # Save
    logger.info("💾 Saving to Firebase...")
    try:
        update_time, doc_ref = db.collection('memories').add(final_memory)
        logger.info(f"✅ Saved. ID: {doc_ref.id}")
        return {"success": True, "id": doc_ref.id, "memory": final_memory}
    except Exception as db_err:
            logger.error(f"❌ Save failed: {db_err}")
            return {"success": False, "error": f"DB Write Error: {str(db_err)}"}
