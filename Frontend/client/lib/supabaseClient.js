
// Stub file to prevent import errors if any legacy files still import it
export const supabase = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      eq: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ error: { message: "Auth disabled" } }),
    signOut: () => Promise.resolve(),
  },
  channel: () => ({
    on: () => ({ subscribe: () => {} }),
    subscribe: () => {},
  }),
  removeChannel: () => {},
};