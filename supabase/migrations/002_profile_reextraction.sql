-- Additive migration for AI-verified profile re-extraction.
-- Apply after 001_initial.sql in Supabase SQL Editor. This does not change score,
-- confidence, review status, reviewer validation, or audit history.
create or replace function public.ats_update_profile(
    p_id bigint,
    p_analysis jsonb,
    p_full_name text,
    p_email text,
    p_phone text,
    p_summary text,
    p_actor text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    old_name text;
begin
    select full_name into old_name
      from public.ats_candidates
     where id = p_id
     for update;
    if not found then
        raise exception 'Candidate not found';
    end if;

    update public.ats_candidates
       set full_name = coalesce(p_full_name, ''),
           email = coalesce(p_email, ''),
           phone = coalesce(p_phone, ''),
           summary = coalesce(p_summary, ''),
           local_analysis_json = coalesce(p_analysis, '{}'::jsonb),
           structured_json = coalesce(p_analysis, '{}'::jsonb),
           updated_at = now()
     where id = p_id;

    insert into public.ats_audit_log(action, candidate_id, details, actor)
    values (
        'profile_reextracted',
        p_id,
        jsonb_build_object(
            'previous_name', old_name,
            'name', coalesce(p_full_name, ''),
            'fields', coalesce(
                (select jsonb_agg(key)
                   from jsonb_object_keys(coalesce(p_analysis->'ai_profile', '{}'::jsonb)) as key
                  where key not in ('source', 'field_evidence', 'needs_human_review')),
                '[]'::jsonb
            )
        )::text,
        coalesce(p_actor, '')
    );
end;
$$;

revoke execute on function public.ats_update_profile(bigint,jsonb,text,text,text,text,text)
    from public, anon, authenticated;
grant execute on function public.ats_update_profile(bigint,jsonb,text,text,text,text,text)
    to service_role;
