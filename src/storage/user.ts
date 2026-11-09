// Single local user until accounts exist (Supabase later). Every record is
// stamped with this so multi-user support is a data migration, not a rewrite.
export const LOCAL_USER_ID = 'local-user'
