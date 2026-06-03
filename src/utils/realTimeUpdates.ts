import { Match } from '../types/tournament';

// Event types for real-time updates
export const REAL_TIME_EVENTS = {
  MATCH_UPDATED: 'match_updated',
  POINT_SCORED: 'point_scored',
  SERVE_SWITCHED: 'serve_switched',
  MATCH_COMPLETED: 'match_completed'
} as const;

export type RealTimeEvent = typeof REAL_TIME_EVENTS[keyof typeof REAL_TIME_EVENTS];

export interface MatchUpdateData {
  match: Match;
  action: string;
  timestamp: number;
  eventType: RealTimeEvent;
}

class RealTimeUpdateManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<(data: MatchUpdateData) => void>> = new Map();

  constructor() {
    // Initialize BroadcastChannel if supported
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('padel-match-updates');
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcastMessage(event.data);
      };
    }

    // Fallback to storage events for cross-tab communication
    window.addEventListener('storage', this.handleStorageChange.bind(this));
  }

  private handleBroadcastMessage(data: MatchUpdateData) {
    this.notifyListeners(data.match.id, data);
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'padel-match-update' && event.newValue) {
      try {
        const data: MatchUpdateData = JSON.parse(event.newValue);
        this.notifyListeners(data.match.id, data);
        // Clean up the storage event
        setTimeout(() => localStorage.removeItem('padel-match-update'), 100);
      } catch (error) {
        console.error('Error parsing match update from storage:', error);
      }
    }
  }

  private notifyListeners(matchId: string, data: MatchUpdateData) {
    const matchListeners = this.listeners.get(matchId);
    if (matchListeners) {
      matchListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in match update listener:', error);
        }
      });
    }
  }

  // Broadcast match update to all tabs/windows
  broadcastMatchUpdate(match: Match, action: string, eventType: RealTimeEvent) {
    const updateData: MatchUpdateData = {
      match: { ...match }, // Clone to prevent mutation
      action,
      timestamp: Date.now(),
      eventType
    };

    // Use BroadcastChannel if available
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(updateData);
    }

    // Fallback to localStorage for cross-tab communication
    try {
      localStorage.setItem('padel-match-update', JSON.stringify(updateData));
      // Trigger storage event manually for same tab
      this.notifyListeners(match.id, updateData);
    } catch (error) {
      console.error('Error broadcasting match update:', error);
    }
  }

  // Subscribe to match updates for a specific match
  subscribeToMatch(matchId: string, callback: (data: MatchUpdateData) => void): () => void {
    if (!this.listeners.has(matchId)) {
      this.listeners.set(matchId, new Set());
    }

    const matchListeners = this.listeners.get(matchId)!;
    matchListeners.add(callback);

    // Return unsubscribe function
    return () => {
      matchListeners.delete(callback);
      if (matchListeners.size === 0) {
        this.listeners.delete(matchId);
      }
    };
  }

  // Get current match data from storage
  getCurrentMatchData(matchId: string): Match | null {
    try {
      const data = localStorage.getItem(`match-${matchId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting current match data:', error);
      return null;
    }
  }

  // Save current match data to storage
  saveCurrentMatchData(match: Match) {
    try {
      localStorage.setItem(`match-${match.id}`, JSON.stringify(match));
    } catch (error) {
      console.error('Error saving current match data:', error);
    }
  }

  // Clean up resources
  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
    this.listeners.clear();
  }
}

// Singleton instance
export const realTimeUpdates = new RealTimeUpdateManager();

// React hook for easier integration
export function useRealTimeMatch(matchId: string | null) {
  const [currentMatch, setCurrentMatch] = React.useState<Match | null>(null);

  React.useEffect(() => {
    if (!matchId) return;

    // Get initial match data
    const initialMatch = realTimeUpdates.getCurrentMatchData(matchId);
    if (initialMatch) {
      setCurrentMatch(initialMatch);
    }

    // Subscribe to updates
    const unsubscribe = realTimeUpdates.subscribeToMatch(matchId, (data) => {
      setCurrentMatch(data.match);
    });

    return unsubscribe;
  }, [matchId]);

  return currentMatch;
}

// Import React for the hook
import React from 'react';