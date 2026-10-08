// Re-export all API functions from modular files
// This maintains backward compatibility while enabling tree-shaking

// Import from all modules
import * as users from './api/users.js';
import * as auth from './api/auth.js';
import * as sessions from './api/sessions.js';
import * as phaseMissions from './api/phaseMissions.js';
import * as pushMissions from './api/pushMissions.js';
import * as staff from './api/staff.js';
import * as bank from './api/bank.js';
import * as awards from './api/awards.js';

// Assemble the neonApi object with all functions
export const neonApi = {
  // Users
  getUsers: users.getUsers,
  getUserPassphrase: users.getUserPassphrase,
  createUser: users.createUser,
  updateUser: users.updateUser,
  
  // Auth
  signInByName: auth.signInByName,
  signInByAlias: auth.signInByAlias,

  // Staff (hosts and bankers)
  staffLogin: staff.staffLogin,
  getStaffSession: staff.getStaffSession,
  staffLogout: staff.staffLogout,
  setStaffPin: staff.setStaffPin,

  // Bank
  getStatement: bank.getStatement,
  getBalances: bank.getBalances,
  recordTransaction: bank.recordTransaction,
  undoTransaction: bank.undoTransaction,

  // Awards
  getAwards: awards.getAwards,
  
  // Sessions
  getAllSessions: sessions.getAllSessions,
  getActiveSession: sessions.getActiveSession,
  createSession: sessions.createSession,
  updateSession: sessions.updateSession,
  startSession: sessions.startSession,
  pauseSession: sessions.pauseSession,
  resumeSession: sessions.resumeSession,
  endSession: sessions.endSession,
  resetSession: sessions.resetSession,
  addPlayerToSession: sessions.addPlayerToSession,

  // Phase Missions
  createPhaseMission: phaseMissions.createPhaseMission,
  getPhaseMissions: phaseMissions.getPhaseMissions,
  updatePhaseMission: phaseMissions.updatePhaseMission,
  deletePhaseMission: phaseMissions.deletePhaseMission,
  getPlayerMissions: phaseMissions.getPlayerMissions,
  completePhaseMission: phaseMissions.completePhaseMission,
  signOffMission: phaseMissions.signOffMission,
  adminCompletePhaseMission: phaseMissions.adminCompletePhaseMission,
  getAllPlayerMissionsForSession: phaseMissions.getAllPlayerMissionsForSession,

  // Sessions (new)
  advancePhase: sessions.advancePhase,

  // Push Missions
  createPushMission: pushMissions.createPushMission,
  getPendingPushMissions: pushMissions.getPendingPushMissions,
  getCompletedUnseenPushMissions: pushMissions.getCompletedUnseenPushMissions,
  getAcknowledgedPushMissions: pushMissions.getAcknowledgedPushMissions,
  acknowledgePushMission: pushMissions.acknowledgePushMission,
  completePushMission: pushMissions.completePushMission,
  markCompletionSeen: pushMissions.markCompletionSeen,
  getAllPushMissionsForSession: pushMissions.getAllPushMissionsForSession,
};
