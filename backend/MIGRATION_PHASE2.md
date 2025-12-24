# Phase 2: Hybrid Search - Database Migration Guide

## Overview

This guide explains how to apply the Phase 2 database migration to enable hybrid search (vector + BM25 keyword search) in your Supabase database.

## Prerequisites

- Access to your Supabase project dashboard
- SQL Editor access in Supabase
- Existing `documents` table with vector embeddings

## Migration Steps

### Step 1: Backup Your Database (Recommended)

Before running any migration, create a backup:

1. Go to Supabase Dashboard → Database → Backups
2. Create a manual backup or ensure automatic backups are enabled

### Step 2: Run the Migration SQL

1. Open Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `database_migration_phase2.sql`
5. Paste into the SQL Editor
6. Click **Run** to execute

### Step 3: Verify Migration

After running the migration, verify it was successful:

```sql
-- Check if indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
    AND indexname LIKE '%fts%';

-- Should show: idx_documents_content_fts

-- Test hybrid search function
SELECT * FROM hybrid_search_documents(
    query_embedding := (SELECT embedding FROM documents LIMIT 1),
    query_text := 'test',
    match_count := 5
);
```

### Step 4: Enable Phase 2 in Configuration

Update your `.env` file:

```bash
# Enable Phase 2: Hybrid Search
PHASE_2_ENABLED=true

# Configure search mode
SEARCH_MODE=hybrid  # Options: vector_only, hybrid, keyword_only

# Adjust weights if needed (should sum to ~1.0)
VECTOR_WEIGHT=0.7
KEYWORD_WEIGHT=0.3
```

### Step 5: Restart Your Backend

```bash
# Restart your FastAPI server to load new configuration
# The exact command depends on your deployment
```

## What Gets Created

### 1. Full-Text Search Index

```sql
CREATE INDEX idx_documents_content_fts 
ON documents USING GIN (to_tsvector('english', content));
```

- Enables fast keyword search
- Uses PostgreSQL's built-in full-text search
- Automatically updated when documents are added/modified

### 2. Additional Indexes

```sql
CREATE INDEX idx_documents_source_url ON documents (source_url);
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);
```

- Improves filtering performance
- Supports future metadata-based queries

### 3. Hybrid Search RPC Function

```sql
CREATE FUNCTION hybrid_search_documents(...)
```

- Combines vector similarity and BM25 keyword search
- Configurable weights for vector vs keyword
- Returns unified results with combined scores

### 4. Keyword-Only Search Function

```sql
CREATE FUNCTION keyword_search_documents(...)
```

- Pure full-text search fallback
- Useful for debugging and comparison

## Testing the Migration

### Test 1: Keyword Search

```sql
SELECT * FROM keyword_search_documents(
    query_text := 'python programming',
    match_count := 5
);
```

Should return documents containing "python" and "programming".

### Test 2: Hybrid Search

```sql
-- First, get a sample embedding
WITH sample AS (
    SELECT embedding FROM documents LIMIT 1
)
SELECT * FROM hybrid_search_documents(
    query_embedding := (SELECT embedding FROM sample),
    query_text := 'machine learning tutorial',
    match_count := 10,
    vector_weight := 0.7,
    keyword_weight := 0.3
);
```

Should return results combining semantic similarity and keyword matching.

### Test 3: From Python

```python
from hybrid_search import HybridSearcher
from rag_pipeline import supabase

searcher = HybridSearcher(supabase)

# Test hybrid search
results = searcher.search(
    query="How to use Python for data analysis?",
    mode="hybrid",
    top_k=5
)

for i, result in enumerate(results, 1):
    print(f"{i}. Score: {result['score']:.4f}")
    print(f"   Vector: {result.get('vector_score', 0):.4f}")
    print(f"   Keyword: {result.get('keyword_score', 0):.4f}")
    print(f"   Content: {result['content'][:100]}...")
    print()
```

## Rollback Instructions

If you need to rollback the migration:

```sql
-- Drop the new functions
DROP FUNCTION IF EXISTS hybrid_search_documents;
DROP FUNCTION IF EXISTS keyword_search_documents;
DROP FUNCTION IF EXISTS bm25_score;

-- Drop the new indexes
DROP INDEX IF EXISTS idx_documents_content_fts;
DROP INDEX IF EXISTS idx_documents_source_url;
DROP INDEX IF EXISTS idx_documents_metadata;
```

Then set in `.env`:
```bash
PHASE_2_ENABLED=false
```

## Performance Considerations

### Index Size

The full-text search index will increase database size by approximately:
- **~10-15%** of your total document content size
- Example: 1GB of documents → ~100-150MB index

### Query Performance

Expected latency changes:
- **Vector-only**: ~50-100ms (baseline)
- **Hybrid search**: ~100-200ms (+50-100ms for keyword search)
- **Keyword-only**: ~30-80ms (faster than vector)

### Optimization Tips

1. **Adjust weights** based on your use case:
   - More factual queries → Increase keyword weight
   - More semantic queries → Increase vector weight

2. **Monitor index usage**:
   ```sql
   SELECT 
       schemaname,
       tablename,
       indexname,
       idx_scan as index_scans,
       idx_tup_read as tuples_read
   FROM pg_stat_user_indexes
   WHERE tablename = 'documents';
   ```

3. **Rebuild index if needed** (after bulk updates):
   ```sql
   REINDEX INDEX idx_documents_content_fts;
   ```

## Troubleshooting

### Issue: "function hybrid_search_documents does not exist"

**Solution**: Re-run the migration SQL. Ensure you're connected to the correct database.

### Issue: Slow keyword search

**Solution**: 
1. Check if index exists: `\d documents`
2. Rebuild index: `REINDEX INDEX idx_documents_content_fts;`
3. Analyze table: `ANALYZE documents;`

### Issue: No keyword matches found

**Possible causes**:
- Query language mismatch (migration uses 'english')
- No matching terms in content
- Try simpler query terms

**Solution**: Test with simple query:
```sql
SELECT * FROM keyword_search_documents(
    query_text := 'the',  -- Common word
    match_count := 5
);
```

### Issue: Hybrid search returns only vector results

**Check**:
1. Verify keyword search works independently
2. Check keyword_weight is > 0
3. Ensure query_text is not empty

## Next Steps

After successful migration:

1. **Test with real queries** to find optimal weights
2. **Monitor performance** using the `/metrics` endpoint (Phase 9)
3. **Consider Phase 3** (Reranking) for further quality improvements

## Support

For issues:
1. Check Supabase logs in Dashboard → Logs
2. Review backend logs for error messages
3. Test each search mode independently to isolate issues
