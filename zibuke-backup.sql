PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  department TEXT NOT NULL, -- Tracks which team they belong to
  id_document_path TEXT NOT NULL, -- THE COMPULSORY ID REQUIREMENT
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2_sha256' CHECK (password_algorithm = 'pbkdf2_sha256'),
  password_iterations INTEGER NOT NULL,
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, date_of_birth TEXT, otp TEXT, otp_expiry DATETIME, last_name TEXT, avatar_url TEXT, phone TEXT, job_title TEXT);
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('862343dd-5f5a-4c35-9566-70964dd89f09','founder@zibukeafrica.co.za','Nyeka','admin','Zibuke Africa Office','LEGACY_EXEMPT','a2fbdb760ae05cec52e98a6efb499b5c7f4a412f39beadc44d157fdf9d373da2d97752a6ca993e454c35c70df850efd5e2749dfd2b7d1a7e89f7eb0aef047f9e','8f15acb668356914ba1be4d29be90fce','pbkdf2_sha256',100000,'2026-09-17 11:40:28',NULL,NULL,'2026-09-17 11:40:28','2026-09-17 11:40:28',NULL,NULL,NULL,'Mawabo null',NULL,NULL,'Founder');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('f618290f-a455-47e7-8f21-489be2b55caf','anjageldenhuys@zibukeafrica.co.za','Anja','admin','Zibuke Africa Office','LEGACY_EXEMPT','5885a1a440d1f5af0446720a77b417288b7dbf8ed03a9f78fcbcbc2d64175cf29b22543326fd8a8302851701529be67f24fc7fae2b7707b5496ccb9e836f46d5','09c35de69a5b2cc75560fdb2e775e669','pbkdf2_sha256',100000,'2026-09-17 11:40:28',NULL,NULL,'2026-09-17 11:40:28','2026-09-17 11:40:28',NULL,NULL,NULL,'Geldenhuys null',NULL,NULL,'Head of People & Systems');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('b77fcd3d-67a1-417f-84af-571fb02b54cb','arehonembadaliga@zibukeafrica.co.za','Arehone','admin','Zibuke Africa Office','LEGACY_EXEMPT','3659c35bf87f4eb057fcf743b99f588afd09574bb029db77d0634a80c85b59421336aa3198fe92302dff96665af4c729776ade24b006d7e4ede0c847aeedbc7a','2e4dd811541f2f1fa95dc4de8263fad1','pbkdf2_sha256',100000,'2026-09-17 11:40:28',NULL,NULL,'2026-09-17 11:40:28','2026-09-17 11:40:28','2026-09-17',NULL,NULL,'Mbadaliga','avatar_b77fcd3d-67a1-417f-84af-571fb02b54cb_1789722698797.jpg','+27761714986','Software Developer');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('6a3af7ad-fe64-4386-9abc-526c99abea9c','nthabisengramalepe@zibukeafrica.co.za','Nthabiseng','admin','Zibuke Africa Office','LEGACY_EXEMPT','ZibukeWelcome2026!','','pbkdf2_sha256',100000,'2026-09-17 13:23:13',NULL,NULL,'2026-09-17 11:40:29','2026-09-17 11:40:29',NULL,NULL,NULL,'Ramalepe null',NULL,NULL,'Software Developer');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('b95281bb-b8da-4064-b4c3-fecd88b8a6bb','jayjacobs@zibukeafrica.co.za','Angel','admin','Zibuke Africa Office','LEGACY_EXEMPT','0cf298005038fbb395ab63682483cf4eb55acff0890b7870a349c03a78eb140d3f15bbfae433252411bb90ce44a112ec7394d605357fd14061745e1f618a6c6a','abf36503b5164fe037c8b245e324301d','pbkdf2_sha256',100000,'2026-09-22 13:28:44',NULL,NULL,'2026-09-17 11:40:29','2026-09-17 11:40:29','2026-09-24',NULL,NULL,'Jacobs','avatar_b95281bb-b8da-4064-b4c3-fecd88b8a6bb_1789693610126.png','+27825292885','Software Developer');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('88516efa-35fa-4dda-9f43-848aee78dec2','Ithandilemagade@gmail.com','Ithandile','employee','Zibuke Africa Office','LEGACY_EXEMPT','e664187bd5f40bc7fba969f001ce7dd5c7f8575d9ebc7d38f0c7d9f5b51550fabe1591e2fd475bfd89377eeb58a6079780333e82346ac0fc440eee46d73db4a1','1808b99a6d5e9efff79ae25be2d5f987','pbkdf2_sha256',100000,'2026-09-17 11:40:29',NULL,NULL,'2026-09-17 11:40:29','2026-09-17 11:40:29',NULL,NULL,NULL,'null',NULL,NULL,'Employee');
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('a97cb7e8-4067-4978-b861-7e8c98f06634','sebelo@zibukeafrica.co.za','Sebelo','admin','Zibuke Africa Sales','LEGACY_EXEMPT','dc2a2f780c6e1be914293048e99328c66844638014fb4fc0a64873011b84e33aa93fc7ad5fc1840bcc3d25894d3bb13f3897d60e78a3b881974556f8dce05fe6','2ec4ade2cd0812e653dd4823d2e3c0a4','pbkdf2_sha256',100000,'2026-09-17 11:40:29',NULL,NULL,'2026-09-17 11:40:29','2026-09-17 11:40:29',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "users" ("id","email","first_name","role","department","id_document_path","password_hash","password_salt","password_algorithm","password_iterations","password_updated_at","email_verified_at","last_login_at","created_at","updated_at","date_of_birth","otp","otp_expiry","last_name","avatar_url","phone","job_title") VALUES('930d322d-4e36-4674-990c-6e4285dc0681','angeljacobs32@gmail.com','Jay','employee','Zibuke Africa Office','/secure-uploads/ids/930d322d-4e36-4674-990c-6e4285dc0681-Angel Jacobs.png','ZibukeWelcome2026!','','pbkdf2_sha256',0,'2026-09-22 07:30:03',NULL,NULL,'2026-09-22 07:30:03','2026-09-22 07:30:03',NULL,NULL,NULL,'Test',NULL,NULL,'Employee');
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "posts" ("id","author_id","content","created_at") VALUES('993909af-6591-4670-a9bc-51aca51098a1','b77fcd3d-67a1-417f-84af-571fb02b54cb','This is a test announcement/Update, I hope you see it.','2026-09-17 14:31:09');
INSERT INTO "posts" ("id","author_id","content","created_at") VALUES('1c4e7321-0e92-4053-a0a5-76238d6a24f8','b77fcd3d-67a1-417f-84af-571fb02b54cb','Update','2026-09-17 14:44:48');
INSERT INTO "posts" ("id","author_id","content","created_at") VALUES('70258b88-c0bb-4718-b96d-32553b8ce258','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Hi everyone','2026-09-18 03:36:36');
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  organizer_id TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, event_type TEXT NOT NULL DEFAULT 'meeting', channel_id TEXT, online INTEGER NOT NULL DEFAULT 1, recording_url TEXT, recording_duration_seconds INTEGER, cancelled_at DATETIME, meeting_provider TEXT DEFAULT 'jitsi', meeting_room TEXT,
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('31d54dd5-7d18-413c-8595-18ebde8c3af1','Testing event','This is just for test','2026-09-17T17:56','2026-09-17T16:56','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke Africa Office','2026-09-17 14:56:51','meeting',NULL,1,NULL,NULL,NULL,'jitsi','zc-de1273252418f506');
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('413724ee-4c24-4e80-8828-e819ce2f57c2','Scheduled Meeting','Meeting to discuss progress on Zibuke Central','2026-09-23T15:01','2026-09-23T16:00','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Zibuke Africa Office','2026-09-23 08:19:45','meeting',NULL,1,NULL,NULL,NULL,'jitsi','zc-d475fed3935a412f9d5a');
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('ceb49095-d347-4cf3-be94-5c13a6be5d5e','Weekly review','','2026-09-23T14:30','2026-09-23T15:00','6a3af7ad-fe64-4386-9abc-526c99abea9c','Zibuke Africa Office','2026-09-23 12:26:04','meeting',NULL,1,NULL,NULL,'2026-09-24 13:50:41','jitsi','zc-0f612c4cc7e5423c92de');
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('29d19616-ffe6-41c6-b11e-db83ca0f92c3','Update','Scheduled meeting for General department.','2026-09-25T13:42:00.000Z','2026-09-25T14:42:00.000Z','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Zibuke Africa Office','2026-09-24 12:42:42','meeting',NULL,1,NULL,NULL,'2026-09-24 13:19:52','jitsi','zc-892d37f9654a4a539b9c');
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('f682cef6-79b2-4bc2-b55d-daa3fe02afa0','update 2','','2026-09-25T15:30','2026-09-25T16:00','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Zibuke Africa Office','2026-09-24 13:20:54','meeting',NULL,1,NULL,NULL,'2026-09-24 13:34:46','jitsi','zc-21d5f5a6cc4f4506b064');
INSERT INTO "events" ("id","title","description","start_time","end_time","organizer_id","department","created_at","event_type","channel_id","online","recording_url","recording_duration_seconds","cancelled_at","meeting_provider","meeting_room") VALUES('7c13e36e-96e7-4090-b705-e7b70a5043ee','Update 3','','2026-09-24T16:00','2026-09-24T16:30','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Zibuke Africa Office','2026-09-24 13:35:17','meeting',NULL,1,NULL,NULL,'2026-09-24 13:35:53','jitsi','zc-39fbc692c1854eed971e');
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, reply_to_id TEXT, edited_at DATETIME, deleted_at DATETIME,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('ea0ed7a3-a1d2-4f9a-beb4-f7b8292e6fbf','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','test','2026-09-18 02:52:16',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('94c7f304-77f1-4c6d-afda-fb5345237459','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b77fcd3d-67a1-417f-84af-571fb02b54cb','Test 18/09/04:52','2026-09-18 02:53:05',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('3b5a89ca-b933-4bd2-a04e-c4a411215567','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b77fcd3d-67a1-417f-84af-571fb02b54cb','Test 18/09/05:15','2026-09-18 03:15:41',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('255ad7a4-3459-468a-beb8-8e1d04e4f44f','b77fcd3d-67a1-417f-84af-571fb02b54cb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Hi Jay, I hope you received this test message','2026-09-18 09:12:47',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('a03a947d-aa2f-4d06-ba12-8989c4bcbd84','b77fcd3d-67a1-417f-84af-571fb02b54cb','6a3af7ad-fe64-4386-9abc-526c99abea9c','Hi Nthabiseng, I hope you receive this test message','2026-09-18 09:14:13',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('6c5cf18e-8bef-4c0e-85f4-aa547512f121','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b77fcd3d-67a1-417f-84af-571fb02b54cb','I did...','2026-09-18 11:01:50',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('e3a3496b-0432-4ae9-8653-4864a30598fd','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','6a3af7ad-fe64-4386-9abc-526c99abea9c','Testing the instant notification','2026-09-22 07:20:54',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('a002085f-6b0a-46ea-8e0c-63eb3ad40c2b','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','test','2026-09-22 08:25:30',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('0209b9b4-4ae2-4f7d-90e5-f7d18cf28943','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','hello','2026-09-22 08:39:35',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('3e7ec3a5-461a-4300-bfa7-da810cebe2a7','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','test','2026-09-22 09:08:08',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('540ebda8-90d7-462f-8d4b-9f54f0072cb5','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','test','2026-09-22 09:19:17',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('687b1b42-537f-4f78-837c-4050d7fa5e51','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','test :','2026-09-22 09:53:29',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('c000246a-9a0d-49e4-8903-1f2bca6dd11a','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','test :','2026-09-22 09:56:30',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('457bdca5-7117-4569-b1f8-d95cf0cd2078','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','123','2026-09-22 14:11:20',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('67f85acc-69e9-4cb9-8392-58fa4348b0d7','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','test','2026-09-23 06:15:42',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('543875c9-7cdc-4938-ad07-7a68dde05ebd','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','test','2026-09-23 06:15:53',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('b824f650-cf5e-4307-bba3-031e1c20d4f5','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','test','2026-09-23 06:19:24',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('e2848f51-6502-463b-b636-f881c6b6dbd3','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','test','2026-09-23 06:19:28',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('48b6d8ad-7b6e-426b-9faa-677fb812c74d','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','321','2026-09-23 06:29:36',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('be86b3d9-7cc7-45b6-9f78-c1065f991101','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','456','2026-09-23 06:40:29',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('8d905fe0-7f9a-4ef3-9d66-9332428e225d','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','987','2026-09-23 06:41:26',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('734ca4f8-bbd3-4a21-8fc1-80e3d5037288','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','000','2026-09-23 06:56:27',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('39a6e8a9-3948-4714-acad-9951ec5ec3f6','6a3af7ad-fe64-4386-9abc-526c99abea9c','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Working','2026-09-23 12:33:54',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('3c1e8c48-bea0-49b8-ab49-b449080e4e64','6a3af7ad-fe64-4386-9abc-526c99abea9c','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','','2026-09-23 12:34:33',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('f9e4295f-48cf-4703-a1ad-31cde86f3535','6a3af7ad-fe64-4386-9abc-526c99abea9c','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Message deleted','2026-09-23 12:40:33',NULL,NULL,'2026-09-23 12:40:47');
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('45031b11-c066-467c-98df-98f8bff0db26','b77fcd3d-67a1-417f-84af-571fb02b54cb','6a3af7ad-fe64-4386-9abc-526c99abea9c','HI','2026-09-23 12:41:16',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('a290d5f8-cac3-4f45-b77e-f97826faefd3','6a3af7ad-fe64-4386-9abc-526c99abea9c','b77fcd3d-67a1-417f-84af-571fb02b54cb','Hi','2026-09-23 12:44:09',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('007ede8c-12cc-492e-a458-282596ab6817','6a3af7ad-fe64-4386-9abc-526c99abea9c','b77fcd3d-67a1-417f-84af-571fb02b54cb','time still behind','2026-09-23 12:44:18',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('82f48dbf-3d7d-4b00-b013-16884b720316','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','6a3af7ad-fe64-4386-9abc-526c99abea9c','Received','2026-09-23 12:47:50',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('f3646a0e-539b-41cc-998e-206f1af00c14','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','0101','2026-09-24 10:36:26',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('e0ad64c3-ee7b-4ed5-83bf-9defb00e1b3f','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','999','2026-09-24 10:52:47',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('3396e90f-91d9-487b-ac28-63ed2bb3bccc','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','666','2026-09-24 11:02:47',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('a7d5ad3b-c508-4ec6-963d-ebc4d3a5694c','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','000','2026-09-24 11:19:39',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('45551c6e-92da-4895-9e61-78fc4c323e46','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','888','2026-09-24 11:27:17',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('f1106717-e1c2-463a-b05a-a96954af7329','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','777','2026-09-24 11:34:15',NULL,NULL,NULL);
INSERT INTO "messages" ("id","sender_id","receiver_id","content","created_at","reply_to_id","edited_at","deleted_at") VALUES('b8466495-5684-4fec-b0fc-22748b6ea641','930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','444','2026-09-24 11:53:38',NULL,NULL,NULL);
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, visibility TEXT NOT NULL DEFAULT 'company', archived_at DATETIME,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, reply_to_id TEXT, message_type TEXT NOT NULL DEFAULT 'message', event_id TEXT, metadata_json TEXT, edited_at DATETIME, deleted_at DATETIME,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  department TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, category TEXT NOT NULL DEFAULT 'general', status TEXT NOT NULL DEFAULT 'published', audience_type TEXT NOT NULL DEFAULT 'company', audience_value TEXT, scheduled_at DATETIME, published_at DATETIME, pinned INTEGER NOT NULL DEFAULT 0, reactions_enabled INTEGER NOT NULL DEFAULT 1, require_acknowledgement INTEGER NOT NULL DEFAULT 0, archived_at DATETIME, updated_at DATETIME,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, link TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, kind TEXT NOT NULL DEFAULT 'general', entity_type TEXT, entity_id TEXT, actor_id TEXT, metadata_json TEXT, read_at DATETIME);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-999','930d322d-4e36-4674-990c-6e4285dc0681','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',1,'2026-09-22 09:04:41','incoming_call','call','test-room',NULL,NULL,'2026-09-22 09:17:38');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-6a3af7ad-fe64-4386-9abc-526c99abea9c','6a3af7ad-fe64-4386-9abc-526c99abea9c','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',1,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,'2026-09-22 10:25:18');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-862343dd-5f5a-4c35-9566-70964dd89f09','862343dd-5f5a-4c35-9566-70964dd89f09','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',0,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-88516efa-35fa-4dda-9f43-848aee78dec2','88516efa-35fa-4dda-9f43-848aee78dec2','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',0,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',1,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,'2026-09-22 09:26:27');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-a97cb7e8-4067-4978-b861-7e8c98f06634','a97cb7e8-4067-4978-b861-7e8c98f06634','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',0,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',0,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',1,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,'2026-09-22 09:26:16');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('test-call-f618290f-a455-47e7-8f21-489be2b55caf','f618290f-a455-47e7-8f21-489be2b55caf','call','Incoming Video Call from Jay','/dashboard/call/room/test-room',0,'2026-09-22 09:26:05','incoming_call','call','test-room',NULL,NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:48b6d8ad-7b6e-426b-9faa-677fb812c74d:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 321','/dashboard',1,'2026-09-23 06:29:37','direct_message','direct_message','48b6d8ad-7b6e-426b-9faa-677fb812c74d','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-23 06:41:00');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:be86b3d9-7cc7-45b6-9f78-c1065f991101:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','direct_message','New direct message: 456','/dashboard',1,'2026-09-23 06:40:29','direct_message','direct_message','be86b3d9-7cc7-45b6-9f78-c1065f991101','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}','2026-09-23 06:41:06');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:8d905fe0-7f9a-4ef3-9d66-9332428e225d:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 987','/dashboard',1,'2026-09-23 06:41:26','direct_message','direct_message','8d905fe0-7f9a-4ef3-9d66-9332428e225d','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-23 06:56:22');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:734ca4f8-bbd3-4a21-8fc1-80e3d5037288:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','direct_message','New direct message: 000','/dashboard',1,'2026-09-23 06:56:28','direct_message','direct_message','734ca4f8-bbd3-4a21-8fc1-80e3d5037288','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}','2026-09-23 06:56:38');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-invite:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','event_invite','Calendar invite: Weekly review','/dashboard',1,'2026-09-23 12:26:04','event_invite','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"startTime":"2026-09-23T14:30","endTime":"2026-09-23T15:00","eventType":"meeting"}','2026-09-23 12:48:12');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-invite:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','event_invite','Calendar invite: Weekly review','/dashboard',0,'2026-09-23 12:26:05','event_invite','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"startTime":"2026-09-23T14:30","endTime":"2026-09-23T15:00","eventType":"meeting"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:39a6e8a9-3948-4714-acad-9951ec5ec3f6:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: Working','/dashboard',1,'2026-09-23 12:33:54','direct_message','direct_message','39a6e8a9-3948-4714-acad-9951ec5ec3f6','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"senderId":"6a3af7ad-fe64-4386-9abc-526c99abea9c"}','2026-09-23 12:48:07');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:3c1e8c48-bea0-49b8-ab49-b449080e4e64:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message with an attachment','/dashboard',1,'2026-09-23 12:34:33','direct_message','direct_message','3c1e8c48-bea0-49b8-ab49-b449080e4e64','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"senderId":"6a3af7ad-fe64-4386-9abc-526c99abea9c"}','2026-09-23 12:48:00');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:f9e4295f-48cf-4703-a1ad-31cde86f3535:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 🙂','/dashboard',1,'2026-09-23 12:40:33','direct_message','direct_message','f9e4295f-48cf-4703-a1ad-31cde86f3535','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"senderId":"6a3af7ad-fe64-4386-9abc-526c99abea9c"}','2026-09-23 12:47:42');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:45031b11-c066-467c-98df-98f8bff0db26:6a3af7ad-fe64-4386-9abc-526c99abea9c','6a3af7ad-fe64-4386-9abc-526c99abea9c','direct_message','New direct message: HI','/dashboard',1,'2026-09-23 12:41:16','direct_message','direct_message','45031b11-c066-467c-98df-98f8bff0db26','b77fcd3d-67a1-417f-84af-571fb02b54cb','{"senderId":"b77fcd3d-67a1-417f-84af-571fb02b54cb"}','2026-09-23 12:43:46');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:a290d5f8-cac3-4f45-b77e-f97826faefd3:b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','direct_message','New direct message: Hi','/dashboard',0,'2026-09-23 12:44:09','direct_message','direct_message','a290d5f8-cac3-4f45-b77e-f97826faefd3','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"senderId":"6a3af7ad-fe64-4386-9abc-526c99abea9c"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:007ede8c-12cc-492e-a458-282596ab6817:b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','direct_message','New direct message: time still behind','/dashboard',0,'2026-09-23 12:44:18','direct_message','direct_message','007ede8c-12cc-492e-a458-282596ab6817','6a3af7ad-fe64-4386-9abc-526c99abea9c','{"senderId":"6a3af7ad-fe64-4386-9abc-526c99abea9c"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:82f48dbf-3d7d-4b00-b013-16884b720316:6a3af7ad-fe64-4386-9abc-526c99abea9c','6a3af7ad-fe64-4386-9abc-526c99abea9c','direct_message','New direct message: Received','/dashboard',0,'2026-09-23 12:47:51','direct_message','direct_message','82f48dbf-3d7d-4b00-b013-16884b720316','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-reminder:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','event_reminder','Reminder: Weekly review starts soon','/dashboard',1,'2026-09-23 13:30:00','event_reminder','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e',NULL,'{"startTime":"2026-09-23T14:30"}','2026-09-23 13:53:44');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-reminder:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','event_reminder','Reminder: Weekly review starts soon','/dashboard',0,'2026-09-23 13:30:32','event_reminder','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e',NULL,'{"startTime":"2026-09-23T14:30"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-reminder:413724ee-4c24-4e80-8828-e819ce2f57c2:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','event_reminder','Reminder: Scheduled Meeting starts soon','/dashboard',1,'2026-09-23 14:01:02','event_reminder','event','413724ee-4c24-4e80-8828-e819ce2f57c2',NULL,'{"startTime":"2026-09-23T15:01"}','2026-09-23 14:06:23');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:f3646a0e-539b-41cc-998e-206f1af00c14:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','direct_message','New direct message: 0101','/dashboard',1,'2026-09-24 10:36:27','direct_message','direct_message','f3646a0e-539b-41cc-998e-206f1af00c14','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}','2026-09-24 10:39:16');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:e0ad64c3-ee7b-4ed5-83bf-9defb00e1b3f:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 999','/dashboard',1,'2026-09-24 10:52:47','direct_message','direct_message','e0ad64c3-ee7b-4ed5-83bf-9defb00e1b3f','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-24 12:33:20');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('cffbc13d-ea77-4461-aeca-f270f876522d','6a3af7ad-fe64-4386-9abc-526c99abea9c','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('d4804521-cdcf-44bb-88af-77e846aa6694','862343dd-5f5a-4c35-9566-70964dd89f09','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('bb36c59d-9d8f-410e-83e2-edf2ecd1d88a','88516efa-35fa-4dda-9f43-848aee78dec2','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('80c1e70c-5e46-416b-9de4-b69a9720a0d3','930d322d-4e36-4674-990c-6e4285dc0681','announcement','New announcement: Test','/dashboard',1,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}','2026-09-24 11:10:27');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('61a742ce-8a5b-4d96-a533-d6e8d6397a6b','a97cb7e8-4067-4978-b861-7e8c98f06634','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('f4f33a0a-1c86-4ae6-a82b-ff5ab90ec83b','b77fcd3d-67a1-417f-84af-571fb02b54cb','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:20','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('c7a5eaab-4049-4822-8b00-4a8b1beec990','f618290f-a455-47e7-8f21-489be2b55caf','announcement','New announcement: Test','/dashboard',0,'2026-09-24 10:55:21','announcement','announcement','dbeee89c-f88e-413d-b607-e494ef0cf414','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"title":"Test"}',NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:3396e90f-91d9-487b-ac28-63ed2bb3bccc:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','direct_message','New direct message: 666','/dashboard',1,'2026-09-24 11:02:47','direct_message','direct_message','3396e90f-91d9-487b-ac28-63ed2bb3bccc','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}','2026-09-24 11:10:19');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:a7d5ad3b-c508-4ec6-963d-ebc4d3a5694c:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 000','/dashboard',1,'2026-09-24 11:19:40','direct_message','direct_message','a7d5ad3b-c508-4ec6-963d-ebc4d3a5694c','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-24 12:33:18');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:45551c6e-92da-4895-9e61-78fc4c323e46:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','direct_message','New direct message: 888','/dashboard',1,'2026-09-24 11:27:17','direct_message','direct_message','45551c6e-92da-4895-9e61-78fc4c323e46','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"senderId":"b95281bb-b8da-4064-b4c3-fecd88b8a6bb"}','2026-09-24 13:32:07');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:f1106717-e1c2-463a-b05a-a96954af7329:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 777','/dashboard',1,'2026-09-24 11:34:16','direct_message','direct_message','f1106717-e1c2-463a-b05a-a96954af7329','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-24 12:33:15');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('direct-message:b8466495-5684-4fec-b0fc-22748b6ea641:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','direct_message','New direct message: 444','/dashboard',1,'2026-09-24 11:53:38','direct_message','direct_message','b8466495-5684-4fec-b0fc-22748b6ea641','930d322d-4e36-4674-990c-6e4285dc0681','{"senderId":"930d322d-4e36-4674-990c-6e4285dc0681"}','2026-09-24 12:33:06');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-invite:7c13e36e-96e7-4090-b705-e7b70a5043ee:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','event_invite','Calendar invite: Update 3','/dashboard',1,'2026-09-24 13:35:18','event_invite','event','7c13e36e-96e7-4090-b705-e7b70a5043ee','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','{"startTime":"2026-09-24T16:00","endTime":"2026-09-24T16:30","eventType":"meeting"}','2026-09-24 14:13:46');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-response:7c13e36e-96e7-4090-b705-e7b70a5043ee:930d322d-4e36-4674-990c-6e4285dc0681:accepted','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','event_response','Jay Test responded accepted to your calendar invite','/dashboard',1,'2026-09-24 13:35:37','event_response','event','7c13e36e-96e7-4090-b705-e7b70a5043ee','930d322d-4e36-4674-990c-6e4285dc0681','{"response":"accepted"}','2026-09-24 14:02:05');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-cancelled:7c13e36e-96e7-4090-b705-e7b70a5043ee:930d322d-4e36-4674-990c-6e4285dc0681','930d322d-4e36-4674-990c-6e4285dc0681','event_cancelled','Meeting cancelled: Update 3','/dashboard',1,'2026-09-24 13:35:53','event_cancelled','event','7c13e36e-96e7-4090-b705-e7b70a5043ee','b95281bb-b8da-4064-b4c3-fecd88b8a6bb',NULL,'2026-09-24 14:13:52');
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-cancelled:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b77fcd3d-67a1-417f-84af-571fb02b54cb','b77fcd3d-67a1-417f-84af-571fb02b54cb','event_cancelled','Meeting cancelled: Weekly review','/dashboard',0,'2026-09-24 13:50:41','event_cancelled','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e','b95281bb-b8da-4064-b4c3-fecd88b8a6bb',NULL,NULL);
INSERT INTO "notifications" ("id","user_id","type","text","link","is_read","created_at","kind","entity_type","entity_id","actor_id","metadata_json","read_at") VALUES('event-cancelled:ceb49095-d347-4cf3-be94-5c13a6be5d5e:b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','event_cancelled','Meeting cancelled: Weekly review','/dashboard',1,'2026-09-24 13:50:41','event_cancelled','event','ceb49095-d347-4cf3-be94-5c13a6be5d5e','b95281bb-b8da-4064-b4c3-fecd88b8a6bb',NULL,'2026-09-24 14:03:42');
CREATE TABLE updates (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "updates" ("id","author_id","content","created_at") VALUES('56a1d017-0f31-4891-8049-2aa0a1f38e31','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Hi team, this is to welcome everyone','2026-09-18 03:49:08');
INSERT INTO "updates" ("id","author_id","content","created_at") VALUES('b8c08a94-1c20-406b-a4b6-019e4402f365','b77fcd3d-67a1-417f-84af-571fb02b54cb','Testing update','2026-09-21 08:21:53');
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'001_collaboration_upgrade.sql','2026-09-21 08:47:24');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'002_announcements_upgrade.sql','2026-09-21 08:47:25');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'003_backend_foundation.sql','2026-09-21 08:47:25');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'004_message_lifecycle.sql','2026-09-21 08:47:26');
CREATE TABLE event_attendees (
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending','accepted','tentative','declined')),
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "event_attendees" ("event_id","user_id","response","invited_at","responded_at") VALUES('ceb49095-d347-4cf3-be94-5c13a6be5d5e','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','pending','2026-09-23 12:26:04',NULL);
INSERT INTO "event_attendees" ("event_id","user_id","response","invited_at","responded_at") VALUES('ceb49095-d347-4cf3-be94-5c13a6be5d5e','b77fcd3d-67a1-417f-84af-571fb02b54cb','pending','2026-09-23 12:26:05',NULL);
INSERT INTO "event_attendees" ("event_id","user_id","response","invited_at","responded_at") VALUES('7c13e36e-96e7-4090-b705-e7b70a5043ee','930d322d-4e36-4674-990c-6e4285dc0681','accepted','2026-09-24 13:35:18','2026-09-24 13:35:37');
CREATE TABLE message_reactions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('direct','channel')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (target_type, target_id, user_id, emoji)
);
INSERT INTO "message_reactions" ("id","target_type","target_id","user_id","emoji","created_at") VALUES('1ae62746-3a7f-435d-9f67-874fbc760677','direct','a002085f-6b0a-46ea-8e0c-63eb3ad40c2b','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','❤️','2026-09-22 08:25:48');
INSERT INTO "message_reactions" ("id","target_type","target_id","user_id","emoji","created_at") VALUES('ac1910d5-e1e5-40a8-8520-38d345ff2a51','direct','6c5cf18e-8bef-4c0e-85f4-aa547512f121','b77fcd3d-67a1-417f-84af-571fb02b54cb','👍','2026-09-22 15:52:46');
INSERT INTO "message_reactions" ("id","target_type","target_id","user_id","emoji","created_at") VALUES('5e93fb65-15e8-4e2b-9f9a-e8666e3fd580','direct','e3a3496b-0432-4ae9-8653-4864a30598fd','6a3af7ad-fe64-4386-9abc-526c99abea9c','✅','2026-09-23 12:33:47');
INSERT INTO "message_reactions" ("id","target_type","target_id","user_id","emoji","created_at") VALUES('14e925c7-9b54-421e-9265-9ca6ce42bac1','direct','a03a947d-aa2f-4d06-ba12-8989c4bcbd84','6a3af7ad-fe64-4386-9abc-526c99abea9c','✅','2026-09-23 12:43:56');
CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('direct','channel')),
  target_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document','image','video','audio','link')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT,
  external_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "message_attachments" ("id","target_type","target_id","uploaded_by","kind","filename","mime_type","size_bytes","storage_key","external_url","created_at") VALUES('7209b183-fdb5-4209-a6f6-10c0757548bf','direct','3c1e8c48-bea0-49b8-ab49-b449080e4e64','6a3af7ad-fe64-4386-9abc-526c99abea9c','document','Connecting Zibuke Platform Creation Guidelines (1).docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',24587,'collaboration/6a3af7ad-fe64-4386-9abc-526c99abea9c/7209b183-fdb5-4209-a6f6-10c0757548bf-Connecting-Zibuke-Platform-Creation-Guidelines-1-.docx',NULL,'2026-09-23 12:34:33');
CREATE TABLE announcement_attachments (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','document')),
  slot TEXT NOT NULL DEFAULT 'attachment' CHECK (slot IN ('cover','attachment')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE announcement_reactions (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (announcement_id, user_id, emoji)
);
CREATE TABLE announcement_acknowledgements (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner','member')),
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_at DATETIME,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE direct_read_state (
  user_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  last_read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, peer_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (peer_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b77fcd3d-67a1-417f-84af-571fb02b54cb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','2026-09-23 12:35:59');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b77fcd3d-67a1-417f-84af-571fb02b54cb','2026-09-22 07:20:35');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b95281bb-b8da-4064-b4c3-fecd88b8a6bb','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','2026-09-22 07:20:08');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b95281bb-b8da-4064-b4c3-fecd88b8a6bb','6a3af7ad-fe64-4386-9abc-526c99abea9c','2026-09-24 10:02:59');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b95281bb-b8da-4064-b4c3-fecd88b8a6bb','930d322d-4e36-4674-990c-6e4285dc0681','2026-09-24 12:38:55');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('930d322d-4e36-4674-990c-6e4285dc0681','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','2026-09-24 13:32:12');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('6a3af7ad-fe64-4386-9abc-526c99abea9c','930d322d-4e36-4674-990c-6e4285dc0681','2026-09-22 10:29:53');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('6a3af7ad-fe64-4386-9abc-526c99abea9c','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','2026-09-23 12:43:25');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('b77fcd3d-67a1-417f-84af-571fb02b54cb','6a3af7ad-fe64-4386-9abc-526c99abea9c','2026-09-23 12:41:18');
INSERT INTO "direct_read_state" ("user_id","peer_id","last_read_at") VALUES('6a3af7ad-fe64-4386-9abc-526c99abea9c','b77fcd3d-67a1-417f-84af-571fb02b54cb','2026-09-23 12:46:31');
CREATE TABLE announcement_views (
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  first_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE call_signals (id TEXT PRIMARY KEY, caller_id TEXT, caller_name TEXT, target_user_id TEXT, room_name TEXT, status TEXT DEFAULT 'ringing', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('9cb8786d-3301-41a0-a04e-e2d153db102e',NULL,'Angel Jacobs','930d322d-4e36-4674-990c-6e4285dc0681','Zibuke-Direct-930d322d-4e36-4674-990c-6e4285dc0681-2026-09-22','ringing','2026-09-22 15:39:22');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('67e87d46-2260-4113-b4b5-2bd9f2af4a7b',NULL,'Jay Test','b95281bb-b8da-4064-b4c3-fecd88b8a6bb','Zibuke-Direct-b95281bb-b8da-4064-b4c3-fecd88b8a6bb-2026-09-22','answered','2026-09-22 15:45:51');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('0ef849e5-32bd-4343-bb8b-c2e1a481a1c6',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','ringing','2026-09-22 15:47:08');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('240f741e-4ad0-46bc-824d-848658d6a357',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 15:49:46');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('9567fec5-8247-4254-a956-c54061e9e192',NULL,'Jay Test','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 15:51:18');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('58107565-d0c5-42fe-b94b-005840023f08',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 16:00:40');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('23aa08c7-13e6-4d23-b8c1-bc0b6acb34b9',NULL,'Angel Jacobs','930d322d-4e36-4674-990c-6e4285dc0681','Zibuke-Direct-930d322d-4e36-4674-990c-6e4285dc0681-2026-09-22','answered','2026-09-22 16:07:02');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('4cdce8f7-9df7-48b2-ab29-1bf410b6da79',NULL,'Angel Jacobs','930d322d-4e36-4674-990c-6e4285dc0681','Zibuke-Direct-930d322d-4e36-4674-990c-6e4285dc0681-2026-09-22','answered','2026-09-22 16:15:25');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('6014236a-578e-4342-9dd6-234b54cbbf4b',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 16:17:36');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('9c8e9fdb-03b3-4e3c-a8c3-d29530e2de58',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 16:20:52');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('90b91a7a-9b95-45c6-90cc-048732384ec3',NULL,'Angel Jacobs','b77fcd3d-67a1-417f-84af-571fb02b54cb','Zibuke-Direct-b77fcd3d-67a1-417f-84af-571fb02b54cb-2026-09-22','answered','2026-09-22 16:25:05');
INSERT INTO "call_signals" ("id","caller_id","caller_name","target_user_id","room_name","status","created_at") VALUES('c1d8400d-b794-43ab-8ef3-30bb59d31b65',NULL,'Angel Jacobs','930d322d-4e36-4674-990c-6e4285dc0681','Zibuke-Direct-930d322d-4e36-4674-990c-6e4285dc0681-2026-09-24','declined','2026-09-24 10:36:49');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',4);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX idx_messages_participants ON messages (sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX idx_channel_messages_channel ON channel_messages (channel_id);
CREATE INDEX idx_event_attendees_user ON event_attendees (user_id, event_id);
CREATE INDEX idx_events_channel ON events (channel_id, start_time);
CREATE INDEX idx_events_active ON events (cancelled_at, start_time);
CREATE INDEX idx_channel_messages_event ON channel_messages (event_id);
CREATE INDEX idx_message_reactions_target ON message_reactions (target_type, target_id);
CREATE INDEX idx_message_attachments_target ON message_attachments (target_type, target_id);
CREATE INDEX idx_announcement_attachments_announcement ON announcement_attachments (announcement_id, created_at);
CREATE INDEX idx_announcement_reactions_announcement ON announcement_reactions (announcement_id);
CREATE INDEX idx_announcement_ack_user ON announcement_acknowledgements (user_id, announcement_id);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_announcements_status ON announcements (status, published_at, scheduled_at);
CREATE INDEX idx_announcements_audience ON announcements (audience_type, audience_value);
CREATE INDEX idx_channel_members_user ON channel_members (user_id, channel_id);
CREATE INDEX idx_announcement_views_announcement ON announcement_views (announcement_id, last_viewed_at DESC);
CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id);
CREATE UNIQUE INDEX idx_events_meeting_room ON events (meeting_room) WHERE meeting_room IS NOT NULL;
CREATE INDEX idx_messages_reply_to ON messages (reply_to_id);
CREATE INDEX idx_messages_deleted_at ON messages (deleted_at);
CREATE INDEX idx_channel_messages_deleted_at ON channel_messages (deleted_at);
