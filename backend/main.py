from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv

# Import our pipeline logic
from rag_pipeline import ingest_website_logic, ingest_multipage_logic
from search import chat_logic

load_dotenv(override=True)

app = FastAPI(title="Snapmind Backend")

# Allow CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    url: str
    text_content: str | None = None # [NEW] For Visual/Manual Ingest
    crawl: bool = False # [NEW] Multi-page mode
    max_pages: int = 50
    max_depth: int = 3

class ChatRequest(BaseModel):
    query: str
    context_url: str | None = None
    page_content: str | None = None  # [NEW] Allow direct text context
    content_blocks: list[dict] | None = None # [NEW] Structured blocks for citation
    site_id: str | None = None # [NEW] Phase 3: Context Switching (UUID)
    history: list[dict] | None = None # [NEW] Conversational History

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Snapmind Backend"}

@app.post("/ingest")
async def ingest_endpoint(request: IngestRequest):
    """
    Ingests a URL (via Firecrawl) OR raw text (e.g. VLM output) into the RAG database.
    Supports Multi-page Crawling.
    """
    print(f"Received ingestion request for: {request.url} (Crawl: {request.crawl})")
    
    if request.text_content:
        # Direct ingestion
        from rag_pipeline import ingest_text_logic
        result = await ingest_text_logic(request.url, request.text_content)
    elif request.crawl:
        # Multi-page Crawling
        result = await ingest_multipage_logic(request.url, request.max_pages, request.max_depth)
    else:
        # Single page ingestion
        result = await ingest_website_logic(request.url)
    
    if not result["success"]:
         print(f"❌ Ingest Failed: {result['message']}")
         raise HTTPException(status_code=400, detail=result["message"])
    
    return result

@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    """
    Chat with the RAG knowledge base OR current page content.
    """
    print(f"Chat query: {request.query} (Site ID: {request.site_id})")
    
    # Pass page_content to logic if present
    answer = chat_logic(request.query, request.page_content, request.content_blocks, request.site_id, request.history)
    
    if "error" in answer:
        raise HTTPException(status_code=500, detail=answer["error"])
        
    return answer

@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Streaming Chat Endpoint. Returns NDJSON.
    """
    from fastapi.responses import StreamingResponse
    from search import chat_logic_stream
    
    print(f"Stream query: {request.query} (Site ID: {request.site_id})")
    
    return StreamingResponse(
        chat_logic_stream(request.query, request.page_content, request.content_blocks, request.site_id, request.history),
        media_type="application/x-ndjson"
    )

class AnalyzeImageRequest(BaseModel):
    image_data: str # Base64 string
    prompt: str | None = None
    mode: str = "qa" # [NEW] "qa" or "extraction"

@app.post("/analyze-image")
def analyze_image_endpoint(request: AnalyzeImageRequest):
    """
    Analyzes an image using Gemini Vision (Server-side).
    Moves logic from Frontend to Backend.
    """
    from vision import analyze_image_logic
    import base64

    # Decode base64
    try:
        # Check if header exists (data:image/jpeg;base64,)
        if "," in request.image_data:
            image_data = request.image_data.split(",")[1]
        else:
            image_data = request.image_data
            
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    print(f"Analyze request: {request.prompt} (Mode: {request.mode})")
    result = analyze_image_logic(image_bytes, request.prompt, request.mode)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

    return result

# --- Phase 3: Site Management APIs (Using source_url) ---

@app.get("/sites")
def list_sites():
    """Returns list of indexed sites from unique source URLs."""
    try:
        from rag_pipeline import supabase
        
        # Get unique URLs with their latest timestamp
        # Query documents grouped by source_url with max created_at
        response = supabase.table("documents")\
            .select("source_url, created_at")\
            .order("created_at", desc=True)\
            .execute()
        
        # Group by URL and get latest timestamp
        url_map = {}
        for doc in (response.data or []):
            url = doc.get('source_url')
            created_at = doc.get('created_at')
            if url and (url not in url_map or created_at > url_map[url]['created_at']):
                url_map[url] = {
                    'url': url,
                    'created_at': created_at
                }
        
        # Transform to match frontend expectations
        sites = []
        for url, data in url_map.items():
            sites.append({
                "id": url,  # Use URL as ID
                "url": url,
                "title": url,  # Could extract domain name if needed
                "last_updated_at": data['created_at']
            })
        
        # Sort by most recent first
        sites.sort(key=lambda x: x['last_updated_at'], reverse=True)
        
        return {"success": True, "sites": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sites/{site_id}")
def delete_site(site_id: str):
    """Deletes all documents for a given source URL."""
    try:
        from rag_pipeline import supabase
        # Delete all documents with this source_url
        response = supabase.table("documents").delete().eq("source_url", site_id).execute()
        return {"success": True, "deleted_url": site_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Export Endpoints (Phase 4.1) ---

@app.get("/export/{source_url:path}")
def export_site(source_url: str, format: str = "json"):
    """
    Export all indexed content for a given source URL.
    
    Args:
        source_url: URL to export (path parameter)
        format: Export format - 'json' or 'text' (query parameter)
    """
    try:
        from export import export_site_json, export_site_text
        from urllib.parse import unquote
        from fastapi.responses import JSONResponse, PlainTextResponse
        
        # Decode URL
        decoded_url = unquote(source_url)
        
        if format == "text":
            content = export_site_text(decoded_url)
            return PlainTextResponse(
                content=content,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.txt"'
                }
            )
        else:  # json
            data = export_site_json(decoded_url)
            return JSONResponse(
                content=data,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.json"'
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Intelligence Service Endpoints (Ported) ---

class IntelligenceRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    title: str | None = None

@app.post("/receive_data")
async def receive_data_endpoint(request: IntelligenceRequest):
    """
    Intelligence Service Endpoint (Ported from Node.js).
    Scrapes URL, Analyzes with Mistral, Saves to Firestore.
    """
    try:
        from intelligence import process_intelligence_data
        result = await process_intelligence_data(request.url, request.text, request.title)
        return result
    except ValueError as ve:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Debug Endpoint ---

@app.get("/debug/urls")
def debug_list_urls():
    """Debug: List all unique source URLs in the database."""
    try:
        from rag_pipeline import supabase
        response = supabase.rpc("get_unique_urls").execute()
        urls = [row.get('source_url') for row in (response.data or [])]
        return {"success": True, "urls": urls, "count": len(urls)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Restart trigger
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

