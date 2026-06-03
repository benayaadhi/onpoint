import {
  Tournament,
  Match,
  Court,
  MatchStatus,
  Group,
} from '../types/tournament';

export interface CourtAssignmentResult {
  success: boolean;
  message: string;
  assignedCourtId?: string;
}

export interface MatchScheduleInfo {
  matchId: string;
  courtId: string;
  scheduledTime: Date;
  estimatedEndTime: Date;
}

// Get available courts for a tournament
export function getAvailableCourts(tournament: Tournament): Court[] {
  return tournament.courts.filter(
    (court) => court.isAvailable && !court.currentMatch
  );
}

// Get courts that are currently in use
export function getCourtsInUse(tournament: Tournament): Court[] {
  return tournament.courts.filter((court) => court.currentMatch);
}

// Find the next available court
export function findNextAvailableCourt(tournament: Tournament): Court | null {
  const availableCourts = getAvailableCourts(tournament);
  return availableCourts.length > 0 ? availableCourts[0] : null;
}

// Find preferred court for a group match
export function findPreferredCourtForGroup(
  tournament: Tournament,
  groupId: string
): Court | null {
  if (!tournament.groups) return null;

  const group = tournament.groups.find((g) => g.id === groupId);
  if (!group || !group.preferredCourtId) return null;

  const preferredCourt = tournament.courts.find(
    (c) => c.id === group.preferredCourtId
  );
  if (
    preferredCourt &&
    preferredCourt.isAvailable &&
    !preferredCourt.currentMatch
  ) {
    return preferredCourt;
  }

  return null;
}

// Assign a court to a match with group preference
export function assignCourtToMatch(
  tournament: Tournament,
  matchId: string,
  preferredCourtId?: string
): CourtAssignmentResult {
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) {
    return { success: false, message: 'Match not found' };
  }

  if (match.status === 'completed') {
    return {
      success: false,
      message: 'Cannot assign court to completed match',
    };
  }

  if (match.courtId) {
    return { success: false, message: 'Match already has a court assigned' };
  }

  if (match.groupId && tournament.format === 'group-knockout') {
    const groupPreferredCourt = findPreferredCourtForGroup(
      tournament,
      match.groupId
    );
    if (groupPreferredCourt) {
      return {
        success: true,
        message: 'Group preferred court assigned successfully',
        assignedCourtId: groupPreferredCourt.id,
      };
    }
  }

  if (preferredCourtId) {
    const preferredCourt = tournament.courts.find(
      (c) => c.id === preferredCourtId
    );
    if (
      preferredCourt &&
      preferredCourt.isAvailable &&
      !preferredCourt.currentMatch
    ) {
      return {
        success: true,
        message: 'Court assigned successfully',
        assignedCourtId: preferredCourtId,
      };
    }
  }

  const availableCourt = findNextAvailableCourt(tournament);
  if (!availableCourt) {
    return { success: false, message: 'No available courts' };
  }

  return {
    success: true,
    message: 'Court assigned successfully',
    assignedCourtId: availableCourt.id,
  };
}

// Auto-assign courts with group-aware smart scheduling
export function autoAssignCourts(tournament: Tournament): {
  tournament: Tournament;
  assignedMatches: string[];
  scheduledMatches: string[];
  totalScheduled: number;
} {
  const updatedTournament = { ...tournament };
  const assignedMatches: string[] = [];
  const scheduledMatches: string[] = [];
  const availableCourts = getAvailableCourts(updatedTournament);

  if (availableCourts.length === 0) {
    return {
      tournament: updatedTournament,
      assignedMatches: [],
      scheduledMatches: [],
      totalScheduled: 0,
    };
  }

  if (tournament.groupStage && tournament.groups) {
    // --- LOGIKA FASE GRUP: 1 GRUP = 1 LAPANGAN ---
    tournament.groups.forEach((group, groupIndex) => {
      if (groupIndex >= availableCourts.length) {
        return;
      }
      const assignedCourt = availableCourts[groupIndex];

      const groupMatchesToAssign = updatedTournament.matches.filter(
        (match) =>
          match.groupId === group.id &&
          !match.courtId &&
          match.status === 'scheduled' &&
          match.team1.name !== 'TBD' &&
          match.team2.name !== 'TBD'
      );

      if (groupMatchesToAssign.length > 0) {
        const timeSlots = generateTimeSlots(
          new Date(),
          updatedTournament.matchDuration,
          updatedTournament.breakBetweenMatches
        );

        groupMatchesToAssign.forEach((match, matchIndexInGroup) => {
          if (matchIndexInGroup < timeSlots.length) {
            const currentSlot = timeSlots[matchIndexInGroup];
            const tournamentMatchIndex = updatedTournament.matches.findIndex(
              (m) => m.id === match.id
            );

            if (tournamentMatchIndex !== -1) {
              updatedTournament.matches[tournamentMatchIndex] = {
                ...updatedTournament.matches[tournamentMatchIndex],
                courtId: assignedCourt.id,
                schedule: {
                  ...updatedTournament.matches[tournamentMatchIndex].schedule,
                  scheduledTime: currentSlot.startTime.toISOString(),
                  estimatedDuration: updatedTournament.matchDuration,
                },
              };

              if (matchIndexInGroup === 0) {
                assignedMatches.push(match.id);
              } else {
                scheduledMatches.push(match.id);
              }
            }
          }
        });
      }
    });
  } else {
    // --- LOGIKA FASE GUGUR (KNOCKOUT) ATAU FORMAT LAIN ---
    const matchesToAssign = updatedTournament.matches
      .filter(
        (match) =>
          !match.courtId &&
          match.status === 'scheduled' &&
          !match.groupId &&
          match.team1.name !== 'TBD' &&
          match.team2.name !== 'TBD'
      )
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.position - b.position;
      });

    const schedulingLimit = availableCourts.length * 5;
    const limitedMatches = matchesToAssign.slice(0, schedulingLimit);

    let courtIndex = 0;
    limitedMatches.forEach((match) => {
      const assignedCourt = availableCourts[courtIndex];
      const nextSlot = getNextAvailableSlot(
        updatedTournament,
        assignedCourt.id
      );

      const tournamentMatchIndex = updatedTournament.matches.findIndex(
        (m) => m.id === match.id
      );

      if (tournamentMatchIndex !== -1 && nextSlot) {
        updatedTournament.matches[tournamentMatchIndex] = {
          ...updatedTournament.matches[tournamentMatchIndex],
          courtId: assignedCourt.id,
          schedule: {
            ...updatedTournament.matches[tournamentMatchIndex].schedule,
            scheduledTime: nextSlot.toISOString(),
          },
        };

        const now = new Date();
        if (nextSlot.getTime() <= now.getTime() + 1000 * 60 * 5) {
          assignedMatches.push(match.id);
        } else {
          scheduledMatches.push(match.id);
        }

        courtIndex = (courtIndex + 1) % availableCourts.length;
      }
    });
  }

  return {
    tournament: updatedTournament,
    assignedMatches,
    scheduledMatches,
    totalScheduled: assignedMatches.length + scheduledMatches.length,
  };
}

function generateTimeSlots(
  startTime: Date,
  matchDuration: number,
  breakBetween: number
): Array<{
  startTime: Date;
  endTime: Date;
  slotIndex: number;
}> {
  const slots = [];
  const slotDuration = matchDuration + breakBetween;

  for (let i = 0; i < 20; i++) {
    const slotStart = new Date(startTime.getTime() + i * slotDuration * 60000);
    const slotEnd = new Date(slotStart.getTime() + matchDuration * 60000);

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      slotIndex: i,
    });
  }

  return slots;
}

export function startMatchOnCourt(
  tournament: Tournament,
  matchId: string
): Tournament {
  const updatedTournament = { ...tournament };

  const matchIndex = updatedTournament.matches.findIndex(
    (m) => m.id === matchId
  );
  const match = updatedTournament.matches[matchIndex];

  if (!match || !match.courtId) {
    return tournament;
  }

  // Reset any other in-progress match on the same court that has no score yet.
  // This handles the case where admin accidentally opened the wrong match first.
  updatedTournament.matches = updatedTournament.matches.map((m) => {
    if (
      m.id !== matchId &&
      m.courtId === match.courtId &&
      m.status === 'in-progress' &&
      !m.completed
    ) {
      const hasScore =
        (m.team1RaceScore ?? 0) > 0 ||
        (m.team2RaceScore ?? 0) > 0 ||
        m.team1Score.games > 0 ||
        m.team2Score.games > 0 ||
        m.team1Score.sets > 0 ||
        m.team2Score.sets > 0;

      if (!hasScore) {
        return { ...m, status: 'scheduled', schedule: { ...m.schedule, startTime: undefined } };
      }
    }
    return m;
  });

  const updatedMatchIndex = updatedTournament.matches.findIndex(
    (m) => m.id === matchId
  );
  updatedTournament.matches[updatedMatchIndex] = {
    ...updatedTournament.matches[updatedMatchIndex],
    status: 'in-progress',
    schedule: {
      ...match.schedule,
      startTime: new Date().toISOString(),
    },
  };

  const courtIndex = updatedTournament.courts.findIndex(
    (c) => c.id === match.courtId
  );
  if (courtIndex !== -1) {
    updatedTournament.courts[courtIndex] = {
      ...updatedTournament.courts[courtIndex],
      currentMatch: matchId,
    };
  }

  return updatedTournament;
}

export function completeMatchAndFreeCourt(
  tournament: Tournament,
  matchId: string
): Tournament {
  const updatedTournament = { ...tournament };

  const matchIndex = updatedTournament.matches.findIndex(
    (m) => m.id === matchId
  );
  const match = updatedTournament.matches[matchIndex];

  if (!match || !match.courtId) {
    return tournament;
  }

  updatedTournament.matches[matchIndex] = {
    ...match,
    status: 'completed',
    schedule: {
      ...match.schedule,
      endTime: new Date().toISOString(),
    },
  };

  const courtIndex = updatedTournament.courts.findIndex(
    (c) => c.id === match.courtId
  );
  if (courtIndex !== -1) {
    updatedTournament.courts[courtIndex] = {
      ...updatedTournament.courts[courtIndex],
      currentMatch: undefined,
    };
  }

  return updatedTournament;
}

export function getCourtName(tournament: Tournament, courtId: string): string {
  const court = tournament.courts.find((c) => c.id === courtId);
  return court ? court.name : 'Unknown Court';
}

export function getCourtSchedule(
  tournament: Tournament,
  courtId: string
): MatchScheduleInfo[] {
  return tournament.matches
    .filter((match) => match.courtId === courtId)
    .map((match) => {
      const scheduledTime = match.schedule.scheduledTime
        ? new Date(match.schedule.scheduledTime)
        : new Date();
      const estimatedEndTime = new Date(
        scheduledTime.getTime() + tournament.matchDuration * 60000
      );

      return {
        matchId: match.id,
        courtId,
        scheduledTime,
        estimatedEndTime,
      };
    })
    .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
}

export function formatScheduledTime(scheduledTime: string): string {
  const date = new Date(scheduledTime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (matchDate.getTime() === today.getTime()) {
    return `Today ${timeStr}`;
  } else if (matchDate.getTime() === today.getTime() + 86400000) {
    return `Tomorrow ${timeStr}`;
  } else {
    return `${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} ${timeStr}`;
  }
}

export function getNextAvailableSlot(
  tournament: Tournament,
  courtId: string
): Date | null {
  const courtSchedule = getCourtSchedule(tournament, courtId);
  const now = new Date();

  if (courtSchedule.length === 0) {
    const court = tournament.courts.find((c) => c.id === courtId);
    if (court?.currentMatch) {
      const currentMatch = tournament.matches.find(
        (m) => m.id === court.currentMatch
      );
      const startTime = new Date(currentMatch?.schedule.startTime || now);
      const endTime = new Date(
        startTime.getTime() + tournament.matchDuration * 60000
      );
      return new Date(
        endTime.getTime() + tournament.breakBetweenMatches * 60000
      );
    }
    return now;
  }

  const latestEndTime = courtSchedule.reduce((latest, match) => {
    return match.estimatedEndTime > latest ? match.estimatedEndTime : latest;
  }, new Date(0));

  const nextAvailableTime = new Date(
    latestEndTime.getTime() + tournament.breakBetweenMatches * 60000
  );

  return nextAvailableTime > now ? nextAvailableTime : now;
}

export function getTournamentScheduleOverview(tournament: Tournament): {
  totalMatches: number;
  scheduledMatches: number;
  completedMatches: number;
  inProgressMatches: number;
  unscheduledMatches: number;
  groupMatches: number;
  knockoutMatches: number;
  estimatedCompletionTime: Date | null;
} {
  const allMatches = tournament.matches.filter(
    (m) => m.team1.name !== 'TBD' && m.team2.name !== 'TBD'
  );
  const totalMatches = allMatches.length;

  const completedMatches = tournament.matches.filter(
    (m) => m.status === 'completed'
  ).length;
  const inProgressMatches = tournament.matches.filter(
    (m) => m.status === 'in-progress'
  ).length;
  const scheduledMatches = tournament.matches.filter(
    (m) => m.status === 'scheduled' && m.courtId
  ).length;
  const unscheduledMatches =
    totalMatches - (completedMatches + inProgressMatches + scheduledMatches);

  const groupMatches = allMatches.filter((m) => m.groupId).length;
  const knockoutMatches = allMatches.filter((m) => !m.groupId).length;

  let estimatedCompletionTime: Date | null = null;
  const scheduledMatchTimes = tournament.matches
    .filter((m) => m.schedule.scheduledTime)
    .map(
      (m) =>
        new Date(m.schedule.scheduledTime!).getTime() +
        tournament.matchDuration * 60000
    );

  if (scheduledMatchTimes.length > 0) {
    estimatedCompletionTime = new Date(Math.max(...scheduledMatchTimes));
  }

  return {
    totalMatches,
    scheduledMatches,
    completedMatches,
    inProgressMatches,
    unscheduledMatches,
    groupMatches,
    knockoutMatches,
    estimatedCompletionTime,
  };
}

export function validateCourtCapacity(tournament: Tournament): {
  isValid: boolean;
  message: string;
  recommendedCourts: number;
} {
  const availableCourts = getAvailableCourts(tournament).length;
  const pendingMatches = tournament.matches.filter(
    (m) =>
      m.status === 'scheduled' &&
      !m.courtId &&
      m.team1.name !== 'TBD' &&
      m.team2.name !== 'TBD'
  ).length;

  if (availableCourts === 0 && pendingMatches > 0) {
    return {
      isValid: false,
      message: 'No courts available for matches',
      recommendedCourts: Math.max(1, Math.ceil(pendingMatches / 4)),
    };
  }

  if (tournament.format === 'group-knockout' && tournament.groups) {
    const numberOfGroups = tournament.groups.length;
    if (availableCourts < numberOfGroups) {
      return {
        isValid: false,
        message: `Group-knockout format needs at least ${numberOfGroups} courts for parallel group play`,
        recommendedCourts: numberOfGroups,
      };
    }
  }

  if (pendingMatches > availableCourts * 10) {
    return {
      isValid: false,
      message: 'Not enough courts for efficient tournament flow',
      recommendedCourts: Math.ceil(pendingMatches / 10),
    };
  }

  return {
    isValid: true,
    message: 'Court capacity is adequate',
    recommendedCourts: availableCourts,
  };
}

export function getGroupCourtAssignments(
  tournament: Tournament
): Map<string, string> {
  const assignments = new Map<string, string>();

  if (tournament.groups) {
    tournament.groups.forEach((group) => {
      if (group.preferredCourtId) {
        assignments.set(group.id, group.preferredCourtId);
      }
    });
  }

  return assignments;
}

export function updateGroupPreferredCourt(
  tournament: Tournament,
  groupId: string,
  courtId: string
): Tournament {
  const updatedTournament = { ...tournament };

  if (updatedTournament.groups) {
    const groupIndex = updatedTournament.groups.findIndex(
      (g) => g.id === groupId
    );
    if (groupIndex !== -1) {
      updatedTournament.groups[groupIndex] = {
        ...updatedTournament.groups[groupIndex],
        preferredCourtId: courtId,
      };
    }
  }

  return updatedTournament;
}
