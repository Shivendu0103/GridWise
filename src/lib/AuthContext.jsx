// src/lib/AuthContext.jsx
// Provides auth state (user, userProfile, loading) and logout to the whole app.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, logOut, fetchUserProfile } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);          // undefined = resolving
  const [userProfile, setUserProfile] = useState(null); // RTDB profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth(async (firebaseUser) => {
      setUser(firebaseUser || null);
      if (firebaseUser && !firebaseUser.isAnonymous) {
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else if (firebaseUser && firebaseUser.isAnonymous) {
        // Anonymous users are treated as citizens in guest mode
        setUserProfile({ role: 'citizen', name: 'Guest', energy_coins: 0, isGuest: true });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = async () => {
    await logOut();
    setUser(null);
    setUserProfile(null);
  };

  /** Call this after writing a new profile to RTDB, to refresh context state. */
  const refreshProfile = async (explicitUid = null) => {
    const targetUid = explicitUid || (user && !user.isAnonymous ? user.uid : null);
    if (!targetUid) return;
    const profile = await fetchUserProfile(targetUid);
    setUserProfile(profile);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
