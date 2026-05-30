/**
 * @file RoleProvider.tsx
 * @description Provides a global React context for tracking and updating the user's active role (Supplier vs Investor).
 */

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Role = "supplier" | "investor";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: "supplier",
  setRole: () => {},
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("supplier");

  useEffect(() => {
    const saved = localStorage.getItem("arbitra_role");
    if (saved === "supplier" || saved === "investor") {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("arbitra_role", newRole);
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}
