# 🔧 Supabase Storage Setup Instructions

## Step 1: Create Storage Policies

Go to your Supabase Dashboard → Storage → Policies → chat-images bucket

### Policy 1: Allow Public Uploads
```sql
CREATE POLICY "Allow public uploads to chat-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-images');
```

### Policy 2: Allow Public Downloads  
```sql
CREATE POLICY "Allow public downloads from chat-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');
```

### Policy 3: Allow Public Updates (Optional)
```sql
CREATE POLICY "Allow public updates to chat-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chat-images');
```

## Step 2: Make Bucket Public (Alternative Method)

If policies don't work, make the entire bucket public:

1. Go to Storage → Settings → chat-images bucket
2. Click "Make Public"
3. Confirm the action

## Step 3: Test Upload

After setting up policies, try uploading an image again. The error should be resolved.

## 🚨 If Still Getting Errors:

1. Check bucket name is exactly: `chat-images`
2. Verify your Supabase URL and key are correct
3. Make sure the bucket exists and is accessible
4. Try refreshing your browser and testing again

## 📞 Need Help?

If you're still getting RLS errors, please:
1. Share a screenshot of your Storage policies
2. Confirm your bucket settings
3. Check the browser console for detailed error messages