'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const COMPANIES = [
  'ALL',
  'CRAZE',
  'Craze Iberia SL',
  'Craze UK',
  'CRAZE Group AG',
  'Craze Entertainment'
];

type CompanyContextType = {
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompanyState] = useState<string>(COMPANIES[0]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem('craze_selected_company');
    if (stored && COMPANIES.includes(stored)) {
      setSelectedCompanyState(stored);
      document.cookie = `craze_selected_company=${encodeURIComponent(stored)}; path=/; max-age=31536000`;
    } else {
      document.cookie = `craze_selected_company=${encodeURIComponent(COMPANIES[0])}; path=/; max-age=31536000`;
    }
  }, []);

  const setSelectedCompany = (company: string) => {
    setSelectedCompanyState(company);
    localStorage.setItem('craze_selected_company', company);
    document.cookie = `craze_selected_company=${encodeURIComponent(company)}; path=/; max-age=31536000`;
  };

  if (!isMounted) {
    return null; // or a loading spinner, to avoid hydration mismatch
  }

  return (
    <CompanyContext.Provider value={{ selectedCompany, setSelectedCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
