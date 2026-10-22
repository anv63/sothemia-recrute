-- Allow common raster image CV files in ATS records and the private originals bucket.
-- Apply after 002_profile_reextraction.sql in Supabase SQL Editor.
-- Image OCR is performed server-side; the image itself is not sent to the AI provider.
alter table public.ats_candidates
    drop constraint if exists ats_candidates_file_type_check;

alter table public.ats_candidates
    add constraint ats_candidates_file_type_check
    check (file_type in ('pdf','docx','png','jpg','jpeg','tif','tiff','bmp','gif','webp'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'candidate-cvs',
    'candidate-cvs',
    false,
    10485760,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/tiff',
        'image/bmp',
        'image/gif',
        'image/webp'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;
