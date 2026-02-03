'use client';

import { useUserStore } from '@/lib/stores/useUserStore';
import { useState } from 'react';

export default function TestZustandPage() {
  const { profile, isOnboarded, setProfile, updateProfile, clearProfile, setIsOnboarded } =
    useUserStore();
  const [renderCount, setRenderCount] = useState(0);

  const handleSetProfile = () => {
    setProfile({
      name: 'Test User',
      email: 'test@example.com',
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 75,
      activityLevel: 'moderately_active',
      goalType: 'cut',
      dietaryStyle: 'omnivore',
      mealsPerDay: 3,
    });
  };

  const handleUpdateName = () => {
    updateProfile({ name: 'Updated User' });
  };

  const handleToggleOnboarded = () => {
    setIsOnboarded(!isOnboarded);
  };

  const handleClear = () => {
    clearProfile();
  };

  const handleReRender = () => {
    setRenderCount((c) => c + 1);
  };

  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Zustand Store Test</h1>

      <div style={{ marginBottom: '1rem' }}>
        <p data-testid="render-count">Render count: {renderCount}</p>
        <p data-testid="is-onboarded">Is Onboarded: {isOnboarded ? 'true' : 'false'}</p>
        <p data-testid="profile-name">Profile Name: {profile?.name ?? 'null'}</p>
        <p data-testid="profile-email">Profile Email: {profile?.email ?? 'null'}</p>
        <p data-testid="profile-age">Profile Age: {profile?.age ?? 'null'}</p>
        <p data-testid="profile-goal">Profile Goal: {profile?.goalType ?? 'null'}</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleSetProfile}
          data-testid="btn-set-profile"
          style={{ padding: '0.5rem 1rem', background: '#f97316', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          Set Profile
        </button>
        <button
          onClick={handleUpdateName}
          data-testid="btn-update-name"
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          Update Name
        </button>
        <button
          onClick={handleToggleOnboarded}
          data-testid="btn-toggle-onboarded"
          style={{ padding: '0.5rem 1rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          Toggle Onboarded
        </button>
        <button
          onClick={handleClear}
          data-testid="btn-clear"
          style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          Clear Profile
        </button>
        <button
          onClick={handleReRender}
          data-testid="btn-rerender"
          style={{ padding: '0.5rem 1rem', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          Force Re-render
        </button>
      </div>
    </div>
  );
}
