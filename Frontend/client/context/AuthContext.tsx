import { createContext, useContext } from 'react';

// Simplified AuthContext for Firebase migration (Auth handled by Firebase now)
const AuthContext = createContext({
  user: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthContext.Provider value={{ user: null, signOut: async () => {} }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);