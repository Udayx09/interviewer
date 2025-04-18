// src/context/UserProfileContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';

// 1. Add otherSkills to the interface
interface UserProfile {
  role: string;
  experience: string;
  skills: string; // Core skills
  practiceLanguages: string[];
  otherSkills?: string; // Optional field for related tech/languages
}

// 2. Update Context Type
interface UserProfileContextType {
  profile: UserProfile;
  setProfileDetails: (details: UserProfile) => void;
  hasProfile: boolean;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  // 3. Add to initial state
  const [profile, setProfile] = useState<UserProfile>({
    role: '',
    experience: '',
    skills: '',
    practiceLanguages: [],
    otherSkills: '', // Initialize as empty string
  });
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  const setProfileDetails = (details: UserProfile) => {
    const validDetails = {
      ...details,
      practiceLanguages: Array.isArray(details.practiceLanguages) ? details.practiceLanguages : [],
      // Ensure otherSkills is a string, default to empty if not provided
      otherSkills: typeof details.otherSkills === 'string' ? details.otherSkills : '',
    };
    setProfile(validDetails);
    // Profile considered set if core details + at least one language are chosen
    setHasProfile(!!(validDetails.role && validDetails.experience && validDetails.skills && validDetails.practiceLanguages.length > 0));
    console.log("UserProfileContext: Profile details updated", validDetails);
  };

  return (
    <UserProfileContext.Provider value={{ profile, setProfileDetails, hasProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};