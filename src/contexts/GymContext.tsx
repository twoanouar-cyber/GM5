import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface GymContextType {
  gymId: number;
  gymName: string;
  gymType: 'male' | 'female';
  isGymType: (type: 'male' | 'female') => boolean;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

export const useGym = () => {
  const context = useContext(GymContext);
  if (context === undefined) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
};

interface GymProviderProps {
  children: ReactNode;
}

export const GymProvider: React.FC<GymProviderProps> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    throw new Error('GymProvider must be used within an authenticated context');
  }

  const value: GymContextType = {
    gymId: user.gym_id,
    gymName: user.gym_name,
    gymType: user.gym_type,
    isGymType: (type: 'male' | 'female') => user.gym_type === type
  };

  return (
    <GymContext.Provider value={value}>
      <div className={`gym-${user.gym_type}`}>
        {children}
      </div>
    </GymContext.Provider>
  );
};