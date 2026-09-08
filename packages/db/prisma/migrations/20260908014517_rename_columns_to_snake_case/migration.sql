-- Columns carried the Prisma field names verbatim, so they were camelCase.
-- PostgreSQL folds unquoted identifiers to lower case, which made every
-- hand-written query quote them. `@map` moves them to snake_case, matching
-- the table names that `@@map` already set.
--
-- Written by hand: Prisma cannot detect a rename and generates DROP + ADD,
-- which would discard every value. RENAME COLUMN preserves the data, and
-- carries indexes, constraints and defaults with it.

-- Columns
ALTER TABLE "attachments" RENAME COLUMN "messageId" TO "message_id";
ALTER TABLE "attachments" RENAME COLUMN "storageKey" TO "storage_key";
ALTER TABLE "attachments" RENAME COLUMN "mimeType" TO "mime_type";
ALTER TABLE "attachments" RENAME COLUMN "sizeBytes" TO "size_bytes";
ALTER TABLE "attachments" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "conversations" RENAME COLUMN "tenantId" TO "tenant_id";
ALTER TABLE "conversations" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "conversations" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "conversations" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "document_chunks" RENAME COLUMN "documentId" TO "document_id";
ALTER TABLE "document_chunks" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "documents" RENAME COLUMN "tenantId" TO "tenant_id";
ALTER TABLE "documents" RENAME COLUMN "uploadedById" TO "uploaded_by_id";
ALTER TABLE "documents" RENAME COLUMN "storageKey" TO "storage_key";
ALTER TABLE "documents" RENAME COLUMN "mimeType" TO "mime_type";
ALTER TABLE "documents" RENAME COLUMN "sizeBytes" TO "size_bytes";
ALTER TABLE "documents" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "documents" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "messages" RENAME COLUMN "conversationId" TO "conversation_id";
ALTER TABLE "messages" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "operator_sessions" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "operator_sessions" RENAME COLUMN "operatorId" TO "operator_id";
ALTER TABLE "operator_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "operator_sessions" RENAME COLUMN "lastUsedAt" TO "last_used_at";
ALTER TABLE "operator_sessions" RENAME COLUMN "expiresAt" TO "expires_at";

ALTER TABLE "operators" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "operators" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "operators" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "sign_in_throttles" RENAME COLUMN "failureCount" TO "failure_count";
ALTER TABLE "sign_in_throttles" RENAME COLUMN "windowStartedAt" TO "window_started_at";

ALTER TABLE "tenants" RENAME COLUMN "defaultLanguage" TO "default_language";
ALTER TABLE "tenants" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tenants" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "user_sessions" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "user_sessions" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "user_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "user_sessions" RENAME COLUMN "lastUsedAt" TO "last_used_at";
ALTER TABLE "user_sessions" RENAME COLUMN "expiresAt" TO "expires_at";

ALTER TABLE "users" RENAME COLUMN "tenantId" TO "tenant_id";
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "languageConfirmedAt" TO "language_confirmed_at";
ALTER TABLE "users" RENAME COLUMN "mustChangePassword" TO "must_change_password";
ALTER TABLE "users" RENAME COLUMN "firstLoginCompletedAt" TO "first_login_completed_at";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";

-- Indexes (Prisma derives their names from the column names)
ALTER INDEX "attachments_messageId_idx" RENAME TO "attachments_message_id_idx";
ALTER INDEX "conversations_tenantId_updatedAt_idx" RENAME TO "conversations_tenant_id_updated_at_idx";
ALTER INDEX "conversations_userId_idx" RENAME TO "conversations_user_id_idx";
ALTER INDEX "document_chunks_documentId_idx" RENAME TO "document_chunks_document_id_idx";
ALTER INDEX "document_chunks_documentId_ordinal_key" RENAME TO "document_chunks_document_id_ordinal_key";
ALTER INDEX "documents_tenantId_createdAt_idx" RENAME TO "documents_tenant_id_created_at_idx";
ALTER INDEX "messages_conversationId_createdAt_idx" RENAME TO "messages_conversation_id_created_at_idx";
ALTER INDEX "operator_sessions_expiresAt_idx" RENAME TO "operator_sessions_expires_at_idx";
ALTER INDEX "operator_sessions_operatorId_idx" RENAME TO "operator_sessions_operator_id_idx";
ALTER INDEX "operator_sessions_tokenHash_key" RENAME TO "operator_sessions_token_hash_key";
ALTER INDEX "sign_in_throttles_windowStartedAt_idx" RENAME TO "sign_in_throttles_window_started_at_idx";
ALTER INDEX "user_sessions_expiresAt_idx" RENAME TO "user_sessions_expires_at_idx";
ALTER INDEX "user_sessions_tokenHash_key" RENAME TO "user_sessions_token_hash_key";
ALTER INDEX "user_sessions_userId_idx" RENAME TO "user_sessions_user_id_idx";
ALTER INDEX "users_tenantId_idx" RENAME TO "users_tenant_id_idx";

-- Foreign keys (likewise)
ALTER TABLE "attachments" RENAME CONSTRAINT "attachments_messageId_fkey" TO "attachments_message_id_fkey";
ALTER TABLE "conversations" RENAME CONSTRAINT "conversations_tenantId_fkey" TO "conversations_tenant_id_fkey";
ALTER TABLE "conversations" RENAME CONSTRAINT "conversations_userId_fkey" TO "conversations_user_id_fkey";
ALTER TABLE "document_chunks" RENAME CONSTRAINT "document_chunks_documentId_fkey" TO "document_chunks_document_id_fkey";
ALTER TABLE "documents" RENAME CONSTRAINT "documents_tenantId_fkey" TO "documents_tenant_id_fkey";
ALTER TABLE "documents" RENAME CONSTRAINT "documents_uploadedById_fkey" TO "documents_uploaded_by_id_fkey";
ALTER TABLE "messages" RENAME CONSTRAINT "messages_conversationId_fkey" TO "messages_conversation_id_fkey";
ALTER TABLE "operator_sessions" RENAME CONSTRAINT "operator_sessions_operatorId_fkey" TO "operator_sessions_operator_id_fkey";
ALTER TABLE "user_sessions" RENAME CONSTRAINT "user_sessions_userId_fkey" TO "user_sessions_user_id_fkey";
ALTER TABLE "users" RENAME CONSTRAINT "users_tenantId_fkey" TO "users_tenant_id_fkey";
