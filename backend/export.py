"""
Export utilities for downloading indexed content.
"""
from typing import Dict, Any, List
from rag_pipeline import supabase


def export_site_json(source_url: str) -> Dict[str, Any]:
    """
    Export all documents for a given source URL as JSON.
    
    Args:
        source_url: The source URL to export
        
    Returns:
        Dictionary with success status and data
    """
    try:
        # Query all documents for this URL
        response = supabase.table("documents")\
            .select("*")\
            .eq("source_url", source_url)\
            .order("created_at")\
            .execute()
        
        documents = response.data or []
        
        return {
            "success": True,
            "source_url": source_url,
            "total_documents": len(documents),
            "documents": documents,
            "export_format": "json"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def export_site_text(source_url: str) -> str:
    """
    Export all documents for a given source URL as plain text.
    
    Args:
        source_url: The source URL to export
        
    Returns:
        Formatted text string
    """
    try:
        # Query all documents for this URL
        response = supabase.table("documents")\
            .select("content, created_at")\
            .eq("source_url", source_url)\
            .order("created_at")\
            .execute()
        
        documents = response.data or []
        
        # Format as text
        lines = [
            f"Export from: {source_url}",
            f"Total chunks: {len(documents)}",
            f"Generated: {documents[0]['created_at'] if documents else 'N/A'}",
            "=" * 80,
            ""
        ]
        
        for idx, doc in enumerate(documents, 1):
            lines.append(f"--- Chunk {idx} ---")
            lines.append(doc.get('content', ''))
            lines.append("")
        
        return "\n".join(lines)
    except Exception as e:
        return f"Export failed: {str(e)}"
