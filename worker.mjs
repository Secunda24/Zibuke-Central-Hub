import app from './.open-next/worker.js';
import {runTrainingNotifications} from './src/modules/training/notifications.ts';
import {promoteDueAnnouncements,promoteBirthdayAnnouncements} from './src/modules/announcements/server.ts';
export * from './.open-next/worker.js';
export default {
 ...app,
 async scheduled(_event,env,ctx){
  ctx.waitUntil(Promise.all([runTrainingNotifications(env.DB),promoteDueAnnouncements(env.DB),promoteBirthdayAnnouncements(env.DB)]));
 }
};
