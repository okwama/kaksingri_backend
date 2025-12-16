# Supabase Storage Setup Guide

## Step 1: Create Storage Bucket in Supabase

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"**
5. Create a bucket named: `kaksingri-uploads`
6. Make it **Public** (so images can be accessed via URL)
7. Click **"Create bucket"**

## Step 2: Set Up Bucket Policies

1. Click on the `kaksingri-uploads` bucket
2. Go to **"Policies"** tab
3. Create policies for upload/delete:

### Policy 1: Allow Authenticated Users to Upload
```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kaksingri-uploads');
```

### Policy 2: Allow Authenticated Users to Delete
```sql
CREATE POLICY "Allow authenticated users to delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'kaksingri-uploads');
```

### Policy 3: Allow Public Read Access
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'kaksingri-uploads');
```

## Step 3: Get Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key** (⚠️ Keep this secret! Use for backend only)

## Step 4: Update .env File

Add these to your `.env` file:

```env
# Supabase Storage
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Important:** 
- Use the **Service Role Key** (not the anon key) for backend operations
- Never expose the Service Role Key in frontend code
- The Service Role Key bypasses Row Level Security (RLS)

## Step 5: Create Folder Structure (Optional)

The bucket will automatically create folders when you upload files. The service organizes files into:
- `products/` - Product images
- `categories/` - Category images
- `avatars/` - User avatars
- `hero/` - Hero/banner images
- `general/` - Other uploads

## Testing

After setup, test the upload endpoint:

```bash
curl -X POST http://localhost:3001/api/upload/product \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `kaksingri-uploads`
- Check that the bucket exists in your Supabase project

### Error: "new row violates row-level security policy"
- Make sure you've created the storage policies (Step 2)
- Verify you're using the Service Role Key (not anon key)

### Error: "Invalid API key"
- Verify your SUPABASE_URL and SUPABASE_SERVICE_KEY are correct
- Make sure you copied the Service Role Key, not the anon key

### Files not accessible publicly
- Make sure the bucket is set to **Public**
- Check the public read policy is created

