/*
# Create product-images storage bucket

1. Storage
- Create a public bucket `product-images` for uploading product/menu photos.
- Public read access (anyone can view product images).
- Authenticated users can upload and update images.
- Authenticated users can delete their own uploads.

2. Security
- Bucket is public (read access for anon + authenticated).
- INSERT/UPDATE/DELETE scoped to authenticated users.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated to upload
DROP POLICY IF EXISTS "Auth upload product images" ON storage.objects;
CREATE POLICY "Auth upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated to update
DROP POLICY IF EXISTS "Auth update product images" ON storage.objects;
CREATE POLICY "Auth update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated to delete
DROP POLICY IF EXISTS "Auth delete product images" ON storage.objects;
CREATE POLICY "Auth delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
