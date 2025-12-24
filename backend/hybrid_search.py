"""
Hybrid Search Module for RAG Pipeline

Combines dense vector search with sparse keyword search (BM25) for improved retrieval.
Implements Reciprocal Rank Fusion (RRF) for result merging.
"""

import os
from typing import List, Dict, Any, Tuple
import google.generativeai as genai
from supabase import Client
from config import SearchConfig


class HybridSearcher:
    """
    Hybrid search combining vector similarity and keyword matching.
    """
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.search_mode = SearchConfig.SEARCH_MODE
        self.vector_weight = SearchConfig.VECTOR_WEIGHT
        self.keyword_weight = SearchConfig.KEYWORD_WEIGHT
        self.match_threshold = SearchConfig.MATCH_THRESHOLD
        self.match_count = SearchConfig.MATCH_COUNT
    
    def search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_id: str = None,
        top_k: int = None,
        mode: str = None
    ) -> List[Dict[str, Any]]:
        """
        Main search method that routes to appropriate search strategy.
        
        Args:
            query: Search query text
            query_embedding: Pre-computed query embedding (optional)
            site_id: Filter by source URL
            top_k: Number of results to return
            mode: Override search mode ('vector_only', 'hybrid', 'keyword_only')
        
        Returns:
            List of document dictionaries with scores
        """
        search_mode = mode or self.search_mode
        top_k = top_k or self.match_count
        
        if search_mode == "keyword_only":
            return self._keyword_search(query, site_id, top_k)
        elif search_mode == "hybrid":
            return self._hybrid_search(query, query_embedding, site_id, top_k)
        else:  # vector_only (default)
            return self._vector_search(query, query_embedding, site_id, top_k)
    
    def _vector_search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_id: str = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Pure vector similarity search (existing implementation).
        """
        # Generate embedding if not provided
        if query_embedding is None:
            query_embedding = self._embed_query(query)
        
        # Normalize URL for consistent matching
        normalized_url = self._normalize_url(site_id) if site_id else None
        
        # RPC Call
        params = {
            "query_embedding": query_embedding,
            "match_threshold": self.match_threshold,
            "match_count": top_k,
            "filter_source_url": normalized_url
        }
        
        try:
            response = self.supabase.rpc("match_documents", params).execute()
            matches = response.data or []
            
            # Add search metadata
            for match in matches:
                match['search_method'] = 'vector'
                match['score'] = match.get('similarity', 0)
            
            return matches
        except Exception as e:
            print(f"Vector search error: {e}")
            return []
    
    def _keyword_search(
        self,
        query: str,
        site_id: str = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Pure keyword search using PostgreSQL full-text search.
        """
        normalized_url = self._normalize_url(site_id) if site_id else None
        
        params = {
            "query_text": query,
            "match_count": top_k,
            "filter_source_url": normalized_url
        }
        
        try:
            response = self.supabase.rpc("keyword_search_documents", params).execute()
            matches = response.data or []
            
            # Add search metadata
            for match in matches:
                match['search_method'] = 'keyword'
                match['score'] = match.get('rank', 0)
            
            return matches
        except Exception as e:
            print(f"Keyword search error: {e}")
            # Fallback to vector search
            return self._vector_search(query, None, site_id, top_k)
    
    def _hybrid_search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_id: str = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining vector and keyword search with RRF.
        """
        # Generate embedding if not provided
        if query_embedding is None:
            query_embedding = self._embed_query(query)
        
        normalized_url = self._normalize_url(site_id) if site_id else None
        
        params = {
            "query_embedding": query_embedding,
            "query_text": query,
            "match_threshold": self.match_threshold,
            "match_count": top_k,
            "filter_source_url": normalized_url,
            "vector_weight": self.vector_weight,
            "keyword_weight": self.keyword_weight
        }
        
        try:
            response = self.supabase.rpc("hybrid_search_documents", params).execute()
            matches = response.data or []
            
            # Add search metadata
            for match in matches:
                match['search_method'] = 'hybrid'
                match['score'] = match.get('combined_score', 0)
                match['vector_score'] = match.get('similarity', 0)
                match['keyword_score'] = match.get('bm25_score', 0)
            
            return matches
        except Exception as e:
            print(f"Hybrid search error: {e}")
            print("Falling back to vector search...")
            # Fallback to vector search if hybrid search fails
            return self._vector_search(query, query_embedding, site_id, top_k)
    
    def _embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for query text.
        """
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=query,
                task_type="retrieval_query"
            )
            return result['embedding'] if isinstance(result, dict) else result.embedding
        except Exception as e:
            print(f"Embedding error: {e}")
            return []
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL for consistent matching.
        """
        if not url:
            return None
        
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
            return normalized
        except:
            return url
    
    def reciprocal_rank_fusion(
        self,
        vector_results: List[Dict],
        keyword_results: List[Dict],
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Combine results using Reciprocal Rank Fusion.
        
        RRF formula: score(d) = sum(1 / (k + rank(d)))
        
        Args:
            vector_results: Results from vector search
            keyword_results: Results from keyword search
            k: Constant for RRF (default: 60)
        
        Returns:
            Fused and ranked results
        """
        # Create score dictionaries
        doc_scores = {}
        doc_data = {}
        
        # Process vector results
        for rank, doc in enumerate(vector_results, start=1):
            doc_id = doc['id']
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + (1 / (k + rank))
            doc_data[doc_id] = doc
            if 'rrf_components' not in doc_data[doc_id]:
                doc_data[doc_id]['rrf_components'] = {}
            doc_data[doc_id]['rrf_components']['vector_rank'] = rank
        
        # Process keyword results
        for rank, doc in enumerate(keyword_results, start=1):
            doc_id = doc['id']
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + (1 / (k + rank))
            if doc_id not in doc_data:
                doc_data[doc_id] = doc
                doc_data[doc_id]['rrf_components'] = {}
            doc_data[doc_id]['rrf_components']['keyword_rank'] = rank
        
        # Sort by RRF score
        sorted_docs = sorted(
            doc_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Build final result list
        results = []
        for doc_id, rrf_score in sorted_docs:
            doc = doc_data[doc_id].copy()
            doc['rrf_score'] = rrf_score
            doc['search_method'] = 'rrf_fusion'
            results.append(doc)
        
        return results


def create_hybrid_searcher(supabase_client: Client) -> HybridSearcher:
    """
    Factory function to create a HybridSearcher instance.
    """
    return HybridSearcher(supabase_client)


# Convenience function for backward compatibility
def hybrid_search(
    supabase_client: Client,
    query: str,
    query_embedding: List[float] = None,
    site_id: str = None,
    top_k: int = 10,
    mode: str = None
) -> List[Dict[str, Any]]:
    """
    Convenience function for hybrid search.
    
    Args:
        supabase_client: Supabase client instance
        query: Search query
        query_embedding: Pre-computed embedding (optional)
        site_id: Filter by source URL
        top_k: Number of results
        mode: Search mode override
    
    Returns:
        List of search results
    """
    searcher = HybridSearcher(supabase_client)
    return searcher.search(query, query_embedding, site_id, top_k, mode)
