CREATE TABLE "reading_progress" (
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"scene_index" integer NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reading_progress_user_id_slug_pk" PRIMARY KEY("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "saved_stories" (
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "saved_stories_user_id_slug_pk" PRIMARY KEY("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" text NOT NULL,
	"name" text,
	"email" text,
	"picture" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_sub_unique" UNIQUE("sub")
);
--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_stories" ADD CONSTRAINT "saved_stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_progress_user_id_read_at_idx" ON "reading_progress" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "saved_stories_user_id_saved_at_idx" ON "saved_stories" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");