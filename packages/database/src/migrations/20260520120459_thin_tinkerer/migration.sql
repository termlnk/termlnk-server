CREATE TABLE "collab_invites" (
	"user_id" uuid,
	"invite_id" text,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"capability_hash" text NOT NULL,
	"capability_version" bigint NOT NULL,
	"eph_pub_b64" text NOT NULL,
	"exp" bigint NOT NULL,
	"single_use" boolean NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "collab_invites_pkey" PRIMARY KEY("user_id","invite_id")
);
--> statement-breakpoint
CREATE TABLE "multiplayer_announcements" (
	"user_id" uuid,
	"device_id" text,
	"session_id" text,
	"title" text NOT NULL,
	"cols" integer NOT NULL,
	"rows" integer NOT NULL,
	"announced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_clock" bigint NOT NULL,
	CONSTRAINT "multiplayer_announcements_pkey" PRIMARY KEY("user_id","device_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"user_id" uuid,
	"device_token" text,
	"platform" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_pkey" PRIMARY KEY("user_id","device_token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"jti" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"device_name" text,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srp_credentials" (
	"user_id" uuid PRIMARY KEY,
	"argon2_salt_b64" text NOT NULL,
	"srp_salt" text NOT NULL,
	"srp_verifier" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_clients" (
	"user_id" uuid,
	"client_id" text,
	"last_mutation_id" bigint DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_clients_pkey" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "sync_global_version" (
	"user_id" uuid PRIMARY KEY,
	"current" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_objects" (
	"user_id" uuid,
	"resource" text,
	"entity_id" text,
	"payload" bytea,
	"version" bigint NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_objects_pkey" PRIMARY KEY("user_id","resource","entity_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collab_invites_user_created_idx" ON "collab_invites" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "collab_invites_status_exp_idx" ON "collab_invites" ("status","exp");--> statement-breakpoint
CREATE INDEX "multiplayer_announcements_user_heartbeat_idx" ON "multiplayer_announcements" ("user_id","last_heartbeat_at");--> statement-breakpoint
CREATE INDEX "multiplayer_announcements_heartbeat_idx" ON "multiplayer_announcements" ("last_heartbeat_at");--> statement-breakpoint
CREATE INDEX "push_tokens_user_platform_idx" ON "push_tokens" ("user_id","platform");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "sync_objects_pull_idx" ON "sync_objects" ("user_id","resource","version");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");--> statement-breakpoint
ALTER TABLE "collab_invites" ADD CONSTRAINT "collab_invites_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "multiplayer_announcements" ADD CONSTRAINT "multiplayer_announcements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "srp_credentials" ADD CONSTRAINT "srp_credentials_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_clients" ADD CONSTRAINT "sync_clients_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_global_version" ADD CONSTRAINT "sync_global_version_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_objects" ADD CONSTRAINT "sync_objects_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;