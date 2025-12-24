import os
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    genai.configure(api_key=GOOGLE_API_KEY)
except:
    pass

from mistralai import Mistral
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
mistral_client = Mistral(api_key=MISTRAL_API_KEY)

# Import hybrid search, reranking, and configuration
from hybrid_search import HybridSearcher
from config import SearchConfig, FeatureFlags, RerankingConfig

# Lazy import reranker to avoid loading heavy models unless needed
_reranker_instance = None

def get_reranker():
    """Lazy initialization of reranker"""
    global _reranker_instance
    if _reranker_instance is None and RerankingConfig.RERANK_ENABLED:
        try:
            from reranker import Reranker
            prefer_local = (RerankingConfig.RERANK_MODEL == "local")
            _reranker_instance = Reranker(prefer_local=prefer_local)
        except Exception as e:
            print(f"[RERANK] Failed to initialize: {e}")
            _reranker_instance = None
    return _reranker_instance

GENERATION_MODEL = "gemini-2.0-flash-lite"

def get_relevant_context(query: str, match_threshold: float = None, site_id: str | None = None) -> str:
    """
    Retrieves relevant context from Supabase using hybrid search (Phase 2)
    and optional reranking (Phase 3).
    """
    
    # Use configured threshold if not specified
    if match_threshold is None:
        match_threshold = SearchConfig.MATCH_THRESHOLD
    
    # Determine search mode based on feature flags
    if FeatureFlags.PHASE_2_HYBRID_SEARCH:
        search_mode = SearchConfig.SEARCH_MODE
    else:
        search_mode = "vector_only"  # Fallback to Phase 1 behavior
    
    print(f"[SEARCH] Mode: {search_mode}, Rerank: {RerankingConfig.RERANK_ENABLED}, Query: {query[:50]}...")
    
    try:
        # Step 1: Initial retrieval (hybrid or vector search)
        searcher = HybridSearcher(supabase)
        
        # Get more candidates if reranking is enabled
        initial_count = SearchConfig.MATCH_COUNT
        if RerankingConfig.RERANK_ENABLED and FeatureFlags.PHASE_3_RERANKING:
            initial_count = RerankingConfig.RERANK_CANDIDATES
        
        matches = searcher.search(
            query=query,
            site_id=site_id,
            top_k=initial_count,
            mode=search_mode
        )
        
        print(f"[SEARCH] Initial retrieval: {len(matches)} candidates")
        
        if not matches:
            print("[SEARCH] No matches found")
            return ""
        
        # Step 2: Reranking (if enabled)
        if RerankingConfig.RERANK_ENABLED and FeatureFlags.PHASE_3_RERANKING and len(matches) > 1:
            try:
                reranker = get_reranker()
                if reranker:
                    print(f"[RERANK] Reranking {len(matches)} candidates → top {RerankingConfig.RERANK_TOP_K}")
                    matches = reranker.rerank(
                        query=query,
                        documents=matches,
                        top_k=RerankingConfig.RERANK_TOP_K
                    )
                    print(f"[RERANK] Reranked to {len(matches)} results")
                    
                    # Log reranking quality
                    for idx, doc in enumerate(matches[:3]):
                        print(f"[RERANK] Result {idx+1}:")
                        print(f"  Rerank score: {doc.get('rerank_score', 0):.4f}")
                        print(f"  Original rank: {doc.get('original_rank', 'N/A')}")
                else:
                    print("[RERANK] Reranker not available, using original order")
            except Exception as e:
                print(f"[RERANK] Error during reranking: {e}")
                # Continue with original matches if reranking fails
        
        # Log search quality metrics
        if matches and search_mode == "hybrid":
            for idx, doc in enumerate(matches[:3]):
                print(f"[SEARCH] Match {idx+1}:")
                if 'rerank_score' in doc:
                    print(f"  Rerank: {doc.get('rerank_score', 0):.4f}")
                print(f"  Combined: {doc.get('score', 0):.4f}")
                print(f"  Vector: {doc.get('vector_score', 0):.4f}")
                print(f"  Keyword: {doc.get('keyword_score', 0):.4f}")
        
        # Step 3: Format Context with citations
        context_parts = []
        for i, doc in enumerate(matches):
            source = doc.get('source_url', 'Doc') or "Doc"
            content = doc.get('content', '').strip()
            
            # Inject citation ID
            pseudo_id = f"bi-block-{i+1}"
            
            # Add metadata if available
            metadata = doc.get('metadata', {})
            heading = metadata.get('heading', '')
            heading_info = f"\nHeading: {heading}" if heading else ""
            
            # Add rerank info if available
            rerank_info = ""
            if 'rerank_score' in doc:
                rerank_info = f" (Relevance: {doc['rerank_score']:.2f})"
            
            context_parts.append(
                f"Source: {source}{heading_info}{rerank_info}\n"
                f"ID: [{pseudo_id}]\n"
                f"Content:\n{content}"
            )
        
        full_context = "\n\n---\n\n".join(context_parts)
        print(f"[SEARCH] Final context: {len(matches)} chunks, {len(full_context)} chars")
        
        return full_context
    
    except Exception as e:
        print(f"[SEARCH] Error: {e}")
        import traceback
        traceback.print_exc()
        return ""

def chat_logic(query: str, page_content: str | None = None, content_blocks: list[dict] | None = None, site_id: str | None = None, history: list[dict] | None = None) -> dict:
    """
    Main chat logic.
    1. If content_blocks provided -> Use ID-tagged context for citations.
    2. If page_content provided -> Use it as context (Direct RAG).
    3. Else -> Search vector DB (Indexed RAG).
    """
    
    system_instruction = "You are a strict QA assistant. You answer questions strictly based on the provided CONTEXT.\\nCRITICAL RULES:\\n1. Answer ONLY using information from the CONTEXT.\\n2. If the user asks a question that cannot be answered from the CONTEXT (e.g., general knowledge, code generation unrelated to context), you MUST REFUSE to answer.\\n3. Your refusal message should be: 'I cannot answer this question as it is outside the scope of the current page context.'\\n4. Do NOT use your own training data or outside knowledge.\\n5. Follow-up suggestions must be derived strictly from the CONTEXT."
    citation_instruction = ""
    context = ""
    is_direct_context = False

    if content_blocks:
        # 1. Structured Context (Phase 1 Goal)
        # Format: [id] text
        context_parts = []
        for block in content_blocks:
            # Skip empty or tiny blocks
            if not block.get("text") or len(block["text"]) < 5:
                continue
                
            block_id = block.get("id", "unknown")
            text = block.get("text", "")
            context_parts.append(f"[{block_id}] {text}")
        
        # Join with newlines
        context = "CURRENT PAGE CONTENT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True
        citation_instruction = "\nIMPORTANT: You MUST cite the source block ID in brackets, e.g. [bi-block-12] whenever you use information from the context. Ensure you include citations for every fact. Use at most 4 distinct citations per response."

    elif page_content:
        # 2. Raw Text Context -> Chunk it to allow citations
        lines = page_content[:100000].split('\n')
        context_parts = []
        block_count = 1
        current_chunk = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            current_chunk.append(line)
            # Group a few lines or check length to make chunks
            if len("\n".join(current_chunk)) > 500: # Approximate chunk size
                text = "\n".join(current_chunk)
                context_parts.append(f"ID: [bi-block-{block_count}]\n{text}")
                block_count += 1
                current_chunk = []
        
        # Add remaining
        if current_chunk:
             text = "\n".join(current_chunk)
             context_parts.append(f"ID: [bi-block-{block_count}]\n{text}")

        context = "CURRENT PAGE CONTENT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True
        citation_instruction = "\nIMPORTANT: You MUST cite the source block ID in brackets, e.g. [bi-block-12] whenever you use information from the context. Ensure you include citations for every fact. Use at most 4 distinct citations per response."
    else:
        # 3. Fallback to vector search
        context = get_relevant_context(query, site_id=site_id)
        # Add citation instruction for vector search results
        citation_instruction = "\nIMPORTANT: You MUST cite the source block ID in brackets, e.g. [bi-block-1] whenever you use information from the context. Ensure you include citations for every fact. Use at most 4 distinct citations per response."

    if context:
        prompt = f"""{system_instruction}

CONTEXT:
{context}

{citation_instruction}
CITATION RULE: You MUST cite the source ID (e.g. [bi-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support.

QUESTION: {query}
"""
    else:
        prompt = f"""{system_instruction}
        
NO SPECIFIC CONTEXT WAS RETRIEVED.
Question: {query}
"""

    # Mistral Generation
    try:
        print(f"Generating with Mistral model: mistral-small-latest")
        
        # Construct Messages
        messages = [
            {
                "role": "system", 
                "content": prompt # Prompt contains System Instruction + Context + Current Query
            }
        ]
        
        # Insert History/Previous Turns if available
        # Note: Mistral API expects strictly alternating user/assistant roles
        # For this simple implementation, we'll append history before the final current turn.
        # BUT: The "prompt" variable above currently packs everything (System + Context + Question).
        # To do this properly with history, we should restructure:
        
        # 1. System Message (Instructions + RAG Context)
        # 1. System Message (Instructions + RAG Context)
        # Fix: detailed prompt rules were being ignored. Now appending strict citation rules.
        citation_rule = "\nCITATION RULE: You MUST cite the source ID (e.g. [bi-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support."
        
        full_system_instruction = f"{system_instruction}\n{citation_instruction}\n{citation_rule}"
        
        if context:
            system_content = f"{full_system_instruction}\n\nCONTEXT:\n{context}"
        else:
            system_content = f"{full_system_instruction}\nNO CONTEXT FOUND."
        
        final_messages = [
            {"role": "system", "content": system_content}
        ]
        
        # 2. History
        if history:
            for msg in history:
                # Sanitize roles just in case
                role = "user" if msg.get("role") == "user" else "assistant"
                final_messages.append({"role": role, "content": msg.get("content", "")})
        
        # 3. Current User Question
        final_messages.append({"role": "user", "content": query})

        chat_response = mistral_client.chat.complete(
            model="mistral-small-latest",
            messages=final_messages,
        )
        answer = chat_response.choices[0].message.content
        return {
            "answer": answer,
            "context_found": bool(context),
            "sources": ["Current Page"] if is_direct_context else [],
            "model_used": "mistral-small-latest"
        }
    except Exception as e:
        print(f"Warning: Mistral failed: {e}")
        last_error = e

    return {"error": f"All models failed. Last error: {str(last_error)}"}

def chat_logic_stream(query: str, page_content: str | None = None, content_blocks: list[dict] | None = None, site_id: str | None = None, history: list[dict] | None = None):
    """
    Streaming version of chat logic. Yields NDJSON chunks.
    """
    import json
    
    system_instruction = "You are a strict QA assistant. You answer questions strictly based on the provided CONTEXT.\\nCRITICAL RULES:\\n1. Answer ONLY using information from the CONTEXT.\\n2. If the user asks a question that cannot be answered from the CONTEXT (e.g., general knowledge, code generation unrelated to context), you MUST REFUSE to answer.\\n3. Your refusal message should be: 'I cannot answer this question as it is outside the scope of the current page context.'\\n4. Do NOT use your own training data or outside knowledge.\\n5. Follow-up suggestions must be derived strictly from the CONTEXT."
    citation_instruction = ""
    context = ""
    is_direct_context = False

    if content_blocks:
        # 1. Structured Context
        context_parts = []
        for block in content_blocks:
            if not block.get("text") or len(block["text"]) < 5:
                continue
            block_id = block.get("id", "unknown")
            text = block.get("text", "")
            context_parts.append(f"[{block_id}] {text}")
        
        context = "CURRENT PAGE CONTENT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True
        citation_instruction = "\nIMPORTANT: You MUST cite the source block ID in brackets, e.g. [bi-block-12] whenever you use information from the context. Ensure you include citations for every fact. Use at most 4 distinct citations per response."

    elif page_content:
        # 2. Raw Text Context -> Chunk it to allow citations
        lines = page_content[:100000].split('\n')
        context_parts = []
        block_count = 1
        current_chunk = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            current_chunk.append(line)
            if len("\n".join(current_chunk)) > 500:
                text = "\n".join(current_chunk)
                context_parts.append(f"ID: [bi-block-{block_count}]\n{text}")
                block_count += 1
                current_chunk = []
        
        if current_chunk:
             text = "\n".join(current_chunk)
             context_parts.append(f"ID: [bi-block-{block_count}]\n{text}")

        context = "CURRENT PAGE CONTENT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True
        citation_instruction = "\nIMPORTANT: You MUST cite the source block ID in brackets, e.g. [bi-block-12] whenever you use information from the context. Ensure you include citations for every fact. Use at most 4 distinct citations per response."
    else:
        # 3. Fallback to vector search (with optional site filter)
        context = get_relevant_context(query, site_id=site_id)

    if context:
        prompt = f"""{system_instruction}

CONTEXT:
{context}

{citation_instruction}
CITATION RULE: You MUST cite the source ID (e.g. [bi-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support.

QUESTION: {query}
"""
    else:
        prompt = f"""{system_instruction}
        
NO SPECIFIC CONTEXT WAS RETRIEVED.
Question: {query}
"""

    # Mistral Streaming
    try:
        print(f"Streaming with Mistral model: mistral-small-latest")
        
        # 1. System Message (Instructions + RAG Context)
        # 1. System Message (Instructions + RAG Context)
        citation_rule = "\nCITATION RULE: You MUST cite the source ID (e.g. [bi-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support."
        
        full_system_instruction = f"{system_instruction}\n{citation_instruction}\n{citation_rule}"
        
        if context:
            system_content = f"{full_system_instruction}\n\nCONTEXT:\n{context}"
        else:
            system_content = f"{full_system_instruction}\nNO CONTEXT FOUND."
        
        final_messages = [
            {"role": "system", "content": system_content}
        ]
        
        # 2. History
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "assistant"
                final_messages.append({"role": role, "content": msg.get("content", "")})
        
        # 3. Current User Question
        final_messages.append({"role": "user", "content": query})

        stream_response = mistral_client.chat.stream(
            model="mistral-small-latest",
            messages=final_messages,
        )

        for chunk in stream_response:
             if chunk.data.choices[0].delta.content:
                text_chunk = chunk.data.choices[0].delta.content
                yield json.dumps({"type": "token", "text": text_chunk}) + "\n"
        
        # Final Metadata
        yield json.dumps({
            "type": "usage",
            "context_found": bool(context),
            "model_used": "mistral-small-latest"
        }) + "\n"
        return
        
    except Exception as e:
        print(f"Warning: Mistral streaming failed: {e}")

    yield json.dumps({"type": "error", "error": "All models failed."}) + "\n"
