-- RAG search needs vector similarity. The pgvector image ships the extension;
-- this only enables it for the m4 database.
CREATE EXTENSION IF NOT EXISTS vector;
