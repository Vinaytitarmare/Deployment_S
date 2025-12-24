import os
import asyncio
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Tuple, Dict, Any
import concurrent.futures
import requests
import time

# 1. Load Environment Variables
# Expecting .env to be loaded by main.py or auto-loaded here
load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY, FIRECRAWL_API_KEY]):
    # Allow import even if env vars missing, check at runtime
    pass

# 2. Initialize Clients
# We'll initialize these lazily or globally if vars exist
try:
    if not SUPABASE_URL: print("❌ Missing SUPABASE_URL")
    if not SUPABASE_KEY: print("❌ Missing SUPABASE_KEY")
    if not GOOGLE_API_KEY: print("❌ Missing GOOGLE_API_KEY")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    genai.configure(api_key=GOOGLE_API_KEY)
    print("✅ Backend Clients Initialized Successfully")
except Exception as e:
    print(f"❌ Warning: Clients failed to initialize. Error: {e}")
    import traceback
    traceback.print_exc()

FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

# Import configuration
from config import ChunkingConfig, EmbeddingConfig, FeatureFlags

# Import semantic chunking
from chunking import chunk_text

def scrape_website_firecrawl(url: str, max_retries: int = 3) -> str:
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{FIRECRAWL_BASE_URL}/scrape",
                headers=headers,
                json={
                    "url": url,
                    "formats": ["markdown", "raw"],
                    "onlyMainContent": True,
                    "includeTags": ["p", "h1", "h2", "h3", "code", "pre"],
                    "excludeTags": ["nav", "header", "footer", "script"]
                },
                timeout=45
            )
            
            if response.status_code == 200:
                data = response.json()
                content = (data.get('data', {}).get('markdown') or 
                          data.get('data', {}).get('raw') or 
                          data.get('html', ''))
                
                if content and len(content) > 200:
                    return content
        except Exception as e:
            print(f"Scrape attempt {attempt} failed: {e}")
        
        time.sleep(2 ** attempt)
    
    return simple_scrape_fallback(url)

def simple_scrape_fallback(url: str) -> str:
    """🛡️ BeautifulSoup fallback"""
    try:
        from bs4 import BeautifulSoup
        
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()
        
        main_content = soup.find('main') or soup.find('article') or soup.body
        text = main_content.get_text(separator='\n', strip=True)
        return text[:50000]
        
    except:
        return ""

def embed_single_chunk(chunk: str) -> Tuple[str, List[float]]:
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=chunk,
            task_type="retrieval_document"
        )
        
        embedding = result['embedding'] if isinstance(result, dict) else result.embedding
        
        if isinstance(embedding, list):
            return chunk, embedding
        else:
            return chunk, []
    except Exception as e:
        print(f"Embedding error: {e}")
        return chunk, []

async def parallel_embed_chunks(chunks: List[dict], max_workers: int = None, source_url: str = "") -> List[dict]:
    """
    Embed chunks in parallel. Now handles chunks with metadata.
    
    Args:
        chunks: List of chunk dicts with 'content' and 'metadata' keys
        max_workers: Number of parallel workers (uses config default if None)
        source_url: Source URL (will be merged with chunk metadata)
    
    Returns:
        List of dicts ready for database insertion
    """
    if max_workers is None:
        max_workers = EmbeddingConfig.MAX_EMBEDDING_WORKERS
    
    data_list = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Extract content for embedding
        future_to_chunk = {
            executor.submit(embed_single_chunk, chunk['content']): chunk 
            for chunk in chunks
        }
        
        for future in concurrent.futures.as_completed(future_to_chunk):
            try:
                content, embedding = future.result()
                original_chunk = future_to_chunk[future]
                
                if embedding:
                    # Merge metadata
                    metadata = original_chunk.get('metadata', {})
                    metadata['chunk_id'] = metadata.get('chunk_id', f"{str(hash(content))[:8]}")
                    
                    data_list.append({
                        "content": content, 
                        "embedding": embedding,
                        "source_url": source_url,
                        "metadata": metadata
                    })
            except Exception:
                continue
    
    return data_list


# --- Phase 3: Site Management (Using existing source_url) ---

def normalize_url(url: str) -> str:
    """Normalize URL for consistent storage and matching."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        # Remove trailing slash, query params, and fragments
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
        return normalized
    except:
        return url

async def ingest_website_logic(url: str) -> Dict[str, Any]:
    """Backend logic for ingesting a website."""
    
    # Normalize URL for consistent storage
    normalized_url = normalize_url(url)
    print(f"[INGEST] Normalizing URL: {url} -> {normalized_url}")
    
    # 1. Extract content
    markdown_content = scrape_website_firecrawl(url)
    
    if not markdown_content or len(markdown_content) < 100:
        return {"success": False, "message": "Insufficient content found."}
    
    # 2. Chunk with semantic chunking (configurable via FeatureFlags)
    chunks = chunk_text(
        markdown_content, 
        max_chars=ChunkingConfig.TARGET_CHUNK_SIZE,
        source_url=normalized_url,
        use_semantic=FeatureFlags.PHASE_1_SEMANTIC_CHUNKING
    )
    
    if not chunks:
        return {"success": False, "message": "No valid chunks created."}
    
    # 3. Embed
    data_list = await parallel_embed_chunks(
        chunks, 
        max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
        source_url=normalized_url
    )
    
    if not data_list:
        return {"success": False, "message": "Failed to create embeddings."}

    # 4. Bulk insert
    try:
        response = supabase.table("documents").insert(data_list).execute()
        return {
            "success": True, 
            "message": f"Successfully ingested {len(response.data)} chunks.",
            "chunks_count": len(response.data),
            "source_url": normalized_url
        }
    except Exception as e:
        return {"success": False, "message": f"Database insert failed: {str(e)}"}

async def ingest_text_logic(url: str, text_content: str) -> Dict[str, Any]:
    """Backend logic for ingesting raw text (e.g. from VLM)."""
    
    # Normalize URL for consistent storage
    normalized_url = normalize_url(url)
    print(f"[INGEST] Normalizing URL: {url} -> {normalized_url}")
    
    if not text_content or len(text_content) < 50:
        return {"success": False, "message": "Insufficient text content provided."}
        
    # 1. Chunk with semantic chunking (configurable)
    chunks = chunk_text(
        text_content,
        max_chars=ChunkingConfig.TARGET_CHUNK_SIZE,
        source_url=normalized_url,
        use_semantic=FeatureFlags.PHASE_1_SEMANTIC_CHUNKING
    )
    
    if not chunks:
        return {"success": False, "message": "No valid chunks extracted."}
        
    # 2. Embed
    data_list = await parallel_embed_chunks(
        chunks,
        max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
        source_url=normalized_url
    )
    
    if not data_list:
        return {"success": False, "message": "Failed to create embeddings."}

    # 3. Bulk insert
    try:
        response = supabase.table("documents").insert(data_list).execute()
        return {
            "success": True, 
            "message": f"Successfully ingested {len(response.data)} visual text chunks.",
            "chunks_count": len(response.data),
            "source_url": normalized_url
        }
    except Exception as e:
        return {"success": False, "message": f"Database insert failed: {str(e)}"}



def crawl_website_firecrawl(url: str, max_pages: int = 50, max_depth: int = 3) -> List[Dict[str, str]]:
    """
    Crawl multiple pages using Firecrawl Crawl API.
    """
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
    
    print(f"[CRAWL] Starting multi-page crawl: {url} (max_pages={max_pages}, max_depth={max_depth})")
    
    import urllib.parse
    
    # Calculate current depth of the URL to ensure maxDepth is relative
    parsed_url = urllib.parse.urlparse(url)
    path_segments = [s for s in parsed_url.path.split('/') if s]
    current_depth = len(path_segments)
    
    # Firecrawl maxDepth is absolute from root, so we add current depth
    effective_max_depth = current_depth + max_depth
    print(f"[CRAWL] Adjusted max_depth: {max_depth} (relative) -> {effective_max_depth} (absolute)")

    try:
        # Start crawl job
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/crawl",
            headers=headers,
            json={
                "url": url,
                "limit": max_pages,
                "maxDepth": effective_max_depth,
                "scrapeOptions": {
                    "formats": ["markdown"],
                    "onlyMainContent": True
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"[CRAWL] Failed to start crawl: {response.status_code}")
            print(f"[CRAWL] Response: {response.text}")
            return []
        
        data = response.json()
        job_id = data.get('jobId') or data.get('id')
        
        if not job_id:
            print("[CRAWL] No job ID returned")
            return []
        
        print(f"[CRAWL] Job started: {job_id}")
        
        # Poll for completion (max 5 minutes)
        max_wait = 300
        poll_interval = 5
        elapsed = 0
        
        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            # Check status
            status_response = requests.get(
                f"{FIRECRAWL_BASE_URL}/crawl/{job_id}",
                headers=headers,
                timeout=30
            )
            
            if status_response.status_code != 200:
                print(f"[CRAWL] Status check failed: {status_response.status_code}")
                continue
            
            status_data = status_response.json()
            status = status_data.get('status')
            
            if status == 'completed':
                crawled_pages = status_data.get('data', [])
                results = []
                for page in crawled_pages:
                    page_url = page.get('url', '') or page.get('metadata', {}).get('sourceURL', '')
                    markdown = page.get('markdown', '')
                    if markdown and len(markdown) > 200:
                        results.append({
                            'url': page_url,
                            'content': markdown
                        })
                return results
            
            elif status == 'failed':
                print(f"[CRAWL] Job failed")
                return []
        
        print(f"[CRAWL] Timeout")
        return []
        
    except Exception as e:
        print(f"[CRAWL] Error: {e}")
        return []

async def ingest_multipage_logic(url: str, max_pages: int = 50, max_depth: int = 3) -> Dict[str, Any]:
    """
    Crawl and ingest multiple pages.
    """
    try:
        normalized_url = normalize_url(url)
        pages = crawl_website_firecrawl(normalized_url, max_pages, max_depth)
        
        if not pages:
            # Fallback to single page if crawl fails or returns 0
            print("[MULTIPAGE] Crawl failed or empty, falling back to single page.")
            return await ingest_website_logic(url)
        
        print(f"[MULTIPAGE] Crawled {len(pages)} pages. Ingesting...")
        
        total_chunks = 0
        failed_pages = 0
        
        for idx, page in enumerate(pages, 1):
            page_url = page['url']
            content = page['content']
            
            try:
                chunks = chunk_text(
                    content,
                    max_chars=ChunkingConfig.TARGET_CHUNK_SIZE,
                    source_url=page_url,
                    use_semantic=FeatureFlags.PHASE_1_SEMANTIC_CHUNKING
                )
                
                if not chunks: continue

                embedded_chunks = await parallel_embed_chunks(
                    chunks,
                    max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
                    source_url=page_url
                )
                
                if embedded_chunks:
                    try:
                        # Log chunking details as requested
                        print(f"[MULTIPAGE] Page {idx}: {page_url} -> {len(chunks)} chunks, {len(embedded_chunks)} embedded.")
                        supabase.table("documents").insert(embedded_chunks).execute()
                        total_chunks += len(embedded_chunks)
                    except Exception as db_err:
                        # Sometimes inserting many chunks fails if one is too big?
                        # Or user mentioned "fix multi page error", could be here.
                        # help.py reference seems straightforward.
                        print(f"[MULTIPAGE] DB Insert Error for {page_url}: {db_err}")
                        failed_pages += 1
                        
            except Exception as e:
                print(f"[MULTIPAGE] Failed {page_url}: {e}")
                failed_pages += 1
                continue
        
        success_pages = len(pages) - failed_pages
        return {
            "success": True,
            "message": f"Crawled {len(pages)} pages, Indexed {success_pages} ({total_chunks} chunks).",
            "chunks_count": total_chunks,
            "source_url": normalized_url
        }
        
    except Exception as e:
        print(f"[MULTIPAGE] Error: {str(e)}")
        return {"success": False, "message": f"Multi-page error: {str(e)}"}
