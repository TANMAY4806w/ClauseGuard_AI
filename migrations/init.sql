-- ====================================================================
-- ClauseGuard AI — PostgreSQL Relational Schema Initialization
-- Defines persistent transactional data model for documents, clauses,
-- risk flags, and audit logs according to docs/04_Database_and_API_Design.md
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    sha256_hash VARCHAR(64) UNIQUE NOT NULL,
    page_count INTEGER NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'PENDING',
    overall_risk_score NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Clauses Table
CREATE TABLE IF NOT EXISTS clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    section_number VARCHAR(50),
    section_title VARCHAR(255),
    page_number INTEGER NOT NULL,
    verbatim_text TEXT NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Risk Flags Table
CREATE TABLE IF NOT EXISTS risk_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    clause_id UUID REFERENCES clauses(id) ON DELETE SET NULL,
    risk_level VARCHAR(20) NOT NULL,
    headline VARCHAR(255) NOT NULL,
    danger_summary TEXT NOT NULL,
    counter_term TEXT NOT NULL,
    statutory_compliance_note TEXT,
    negotiation_advice TEXT,
    verbatim_quote TEXT NOT NULL,
    quote_page INTEGER NOT NULL,
    quote_section VARCHAR(50),
    confidence_score NUMERIC(4,3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_clauses_doc_id ON clauses(document_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_doc_id ON risk_flags(document_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_level ON risk_flags(risk_level);
