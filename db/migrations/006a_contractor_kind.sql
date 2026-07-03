-- Stratos — migration 006a: extend org_kind for contractor organizations.
-- Split from 006_contracts so the new enum value commits before use.

alter type public.org_kind add value if not exists 'contractor';
