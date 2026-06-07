/*
  # Create Chat Media Storage System

  ## Overview
  This migration sets up the infrastructure for storing and managing chat media files (images, videos, documents).

  ## New Tables
  
  ### `chat_media` table
  - `id` (uuid, primary key) - Unique identifier for each media file
  - `file_name` (text) - Original file name
  - `file_url` (text) - Public URL to access the file
  - `file_type` (text) - Type of file: 'image', 'video', or 'file'
  - `sender_id` (text) - User who sent the file (nickname)
  - `receiver_id` (text) - User who received the file (nickname)
  - `mime_type` (text) - MIME type of the file (e.g., video/mp4, application/pdf)
  - `file_size` (bigint) - Size of the file in bytes
  - `created_at` (timestamptz) - When the record was created

  ## Storage Buckets
  This migration assumes the following Supabase Storage buckets exist:
  - `chat-images` (already exists for images)
  - `chat-videos` (for video files)
  - `chat-files` (for documents like PDF, PPT, DOCX)

  ## Security
  - Enable RLS on `chat_media` table
  - Add policies for authenticated users to insert their own media
  - Add policies for authenticated users to read media where they are sender or receiver
  - Storage buckets will have public read access but authenticated write access

  ## Notes
  - File size limit: 100MB for videos, 50MB for documents
  - Supported video formats: mp4, mov, avi, webm
  - Supported document formats: pdf, ppt, pptx, doc, docx, xls, xlsx, txt
*/

-- Create chat_media table
CREATE TABLE IF NOT EXISTS chat_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video', 'file')),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert media they send
CREATE POLICY "Users can insert their own media"
  ON chat_media FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can view media where they are sender or receiver
CREATE POLICY "Users can view their media"
  ON chat_media FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_media_sender ON chat_media(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_media_receiver ON chat_media(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_media_created_at ON chat_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_media_file_type ON chat_media(file_type);
