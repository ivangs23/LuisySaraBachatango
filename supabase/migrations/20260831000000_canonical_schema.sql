


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'member',
    'premium',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."video_source" AS ENUM (
    'url',
    'upload'
);


ALTER TYPE "public"."video_source" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_old_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update notifications
     set deleted_at = now()
   where is_read = true
     and created_at < now() - interval '90 days'
     and deleted_at is null;
end;
$$;


ALTER FUNCTION "public"."archive_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.course_purchases cp
    where cp.user_id = (select auth.uid())
      and cp.course_id = target_course_id
      -- Reembolso = sin acceso (2026_07_fix1_refunds.sql).
      and cp.refunded_at is null
  );
$$;


ALTER FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") IS 'True si quien llama tiene una compra no reembolsada de ese curso. SECURITY DEFINER para que la policy de lessons no arrastre la RLS de course_purchases. Usa auth.uid() internamente: el llamante no puede consultar por otro usuario.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'True si quien llama es admin. SECURITY DEFINER para que las policies RLS puedan comprobar el rol sin conceder a anon SELECT sobre profiles.role.';



CREATE OR REPLACE FUNCTION "public"."set_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_role"("target" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  admin_count int;
  target_role text;
begin
  if new_role not in ('member', 'premium', 'admin') then
    raise exception 'invalid_role';
  end if;

  if new_role <> 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin' for update;
    select role into target_role from public.profiles where id = target;
    if target_role = 'admin' and admin_count <= 1 then
      raise exception 'last_admin';
    end if;
  end if;

  update public.profiles set role = new_role where id = target;
end;
$$;


ALTER FUNCTION "public"."set_user_role"("target" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_notification"("recipient_id" "uuid", "actor_id" "uuid", "n_type" "text", "ent_type" "text", "ent_id" "uuid", "n_link" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO notifications (user_id, type, entity_type, entity_id, link, actor_ids, is_read, updated_at)
  VALUES (recipient_id, n_type, ent_type, ent_id, n_link, ARRAY[actor_id], false, now())
  ON CONFLICT (user_id, type, entity_type, entity_id)
    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
  DO UPDATE SET
    actor_ids = (
      CASE WHEN actor_id = ANY(notifications.actor_ids)
        THEN notifications.actor_ids
        ELSE array_append(notifications.actor_ids, actor_id)
      END
    ),
    is_read = false,
    updated_at = now(),
    link = EXCLUDED.link;
END;
$$;


ALTER FUNCTION "public"."upsert_notification"("recipient_id" "uuid", "actor_id" "uuid", "n_type" "text", "ent_type" "text", "ent_id" "uuid", "n_link" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_sha256" "text" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "lesson_id" "uuid",
    "parent_id" "uuid",
    CONSTRAINT "comments_post_xor_lesson" CHECK (("num_nonnulls"("post_id", "lesson_id") = 1))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "message" "text" NOT NULL,
    "inquiry_type" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "stripe_session_id" "text" NOT NULL,
    "amount_paid" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "refunded_at" timestamp with time zone,
    "stripe_payment_intent" "text"
);


ALTER TABLE "public"."course_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "month" integer,
    "year" integer,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "stripe_price_id" "text",
    "course_type" "text" DEFAULT 'membership'::"text" NOT NULL,
    "category" "text",
    "price_eur" integer
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "location" "text" NOT NULL,
    "title" "jsonb" NOT NULL,
    "description" "jsonb" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "events_dates_chk" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "events_description_es_chk" CHECK (("length"(TRIM(BOTH FROM COALESCE(("description" ->> 'es'::"text"), ''::"text"))) > 0)),
    CONSTRAINT "events_location_chk" CHECK (("length"(TRIM(BOTH FROM "location")) > 0)),
    CONSTRAINT "events_title_es_chk" CHECK (("length"(TRIM(BOTH FROM COALESCE(("title" ->> 'es'::"text"), ''::"text"))) > 0))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_events" (
    "id" bigint NOT NULL,
    "path" "text" NOT NULL,
    "visitor_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."landing_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."landing_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."landing_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."landing_events_id_seq" OWNED BY "public"."landing_events"."id";



CREATE TABLE IF NOT EXISTS "public"."landing_faq" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" "jsonb" NOT NULL,
    "answer" "jsonb" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "landing_faq_answer_es_chk" CHECK (("length"(TRIM(BOTH FROM COALESCE(("answer" ->> 'es'::"text"), ''::"text"))) > 0)),
    CONSTRAINT "landing_faq_question_es_chk" CHECK (("length"(TRIM(BOTH FROM COALESCE(("question" ->> 'es'::"text"), ''::"text"))) > 0))
);


ALTER TABLE "public"."landing_faq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_stats" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "position" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "landing_stats_key_chk" CHECK (("key" = ANY (ARRAY['years'::"text", 'students'::"text", 'countries'::"text", 'titles'::"text"]))),
    CONSTRAINT "landing_stats_value_chk" CHECK (("length"(TRIM(BOTH FROM "value")) > 0))
);


ALTER TABLE "public"."landing_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "quote" "jsonb" NOT NULL,
    "stars" integer DEFAULT 5 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "landing_testimonials_name_chk" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "landing_testimonials_quote_es_chk" CHECK (("length"(TRIM(BOTH FROM COALESCE(("quote" ->> 'es'::"text"), ''::"text"))) > 0)),
    CONSTRAINT "landing_testimonials_stars_chk" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."landing_testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_progress" (
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "is_completed" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."lesson_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "release_date" timestamp with time zone,
    "order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "duration" integer,
    "is_free" boolean DEFAULT false,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "mux_asset_id" "text",
    "mux_playback_id" "text",
    "mux_upload_id" "text",
    "mux_status" "text" DEFAULT 'pending_upload'::"text" NOT NULL,
    "parent_lesson_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lessons_mux_status_check" CHECK (("mux_status" = ANY (ARRAY['pending_upload'::"text", 'preparing'::"text", 'ready'::"text", 'errored'::"text"])))
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "subscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "consent_ip" "text",
    "consent_at" timestamp with time zone,
    "consent_source" "text"
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "message" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "type" "text" DEFAULT 'generic'::"text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "link" "text",
    "actor_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['comment_like'::"text", 'comment_reply'::"text", 'post_comment'::"text", 'post_like'::"text", 'post_comment_like'::"text", 'post_comment_reply'::"text", 'assignment_graded'::"text", 'generic'::"text"])))
);

ALTER TABLE ONLY "public"."notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone,
    "role" "public"."app_role" DEFAULT 'member'::"public"."app_role" NOT NULL,
    "instagram" "text",
    "facebook" "text",
    "tiktok" "text",
    "youtube" "text",
    "stripe_customer_id" "text",
    "country" "text",
    "city" "text",
    "date_of_birth" "date",
    "phone" "text",
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "dance_level" "text",
    "postal_code" "text",
    "terms_version" "text",
    "terms_accepted_at" timestamp with time zone,
    "marketing_consent_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."notifications_with_actor" WITH ("security_invoker"='true') AS
 SELECT "n"."id",
    "n"."user_id",
    "n"."title",
    "n"."message",
    "n"."is_read",
    "n"."created_at",
    "n"."type",
    "n"."entity_type",
    "n"."entity_id",
    "n"."link",
    "n"."actor_ids",
    "n"."updated_at",
    "p"."full_name" AS "actor_name",
    "p"."avatar_url" AS "actor_avatar",
    COALESCE("array_length"("n"."actor_ids", 1), 0) AS "actor_count"
   FROM ("public"."notifications" "n"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "n"."actor_ids"[1])))
  WHERE ("n"."deleted_at" IS NULL);


ALTER VIEW "public"."notifications_with_actor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "password_hash" "text" NOT NULL,
    "country" "text",
    "city" "text",
    "date_of_birth" "date",
    "phone" "text",
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "dance_level" "text",
    "course_id" "uuid",
    "amount_expected" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "postal_code" "text",
    "terms_version" "text",
    "terms_accepted_at" timestamp with time zone,
    "marketing_consent_at" timestamp with time zone
);


ALTER TABLE "public"."pending_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text_content" "text",
    "file_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "grade" "text",
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "plan_type" "text"
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."landing_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."landing_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_deletions"
    ADD CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_comment_id_key" UNIQUE ("user_id", "comment_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_purchases"
    ADD CONSTRAINT "course_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_purchases"
    ADD CONSTRAINT "course_purchases_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "public"."course_purchases"
    ADD CONSTRAINT "course_purchases_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_events"
    ADD CONSTRAINT "landing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_faq"
    ADD CONSTRAINT "landing_faq_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_stats"
    ADD CONSTRAINT "landing_stats_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."landing_testimonials"
    ADD CONSTRAINT "landing_testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("user_id", "lesson_id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_registrations"
    ADD CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_user_id_key" UNIQUE ("assignment_id", "user_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "assignments_lesson_id_idx" ON "public"."assignments" USING "btree" ("lesson_id");



CREATE INDEX "comment_likes_comment_id_idx" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "comments_parent_id_idx" ON "public"."comments" USING "btree" ("parent_id");



CREATE INDEX "events_published_start_idx" ON "public"."events" USING "btree" ("is_published", "start_date");



CREATE INDEX "events_start_date_idx" ON "public"."events" USING "btree" ("start_date");



CREATE INDEX "idx_account_deletions_deleted_at" ON "public"."account_deletions" USING "btree" ("deleted_at" DESC);



CREATE INDEX "idx_comments_post_created" ON "public"."comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "idx_comments_user" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_contact_submissions_created" ON "public"."contact_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_course_purchases_course" ON "public"."course_purchases" USING "btree" ("course_id");



CREATE INDEX "idx_course_purchases_pi" ON "public"."course_purchases" USING "btree" ("stripe_payment_intent");



CREATE INDEX "idx_course_purchases_user_course" ON "public"."course_purchases" USING "btree" ("user_id", "course_id");



CREATE INDEX "idx_lesson_progress_user_completed_updated" ON "public"."lesson_progress" USING "btree" ("user_id", "is_completed", "updated_at" DESC);



CREATE INDEX "idx_lessons_mux_asset" ON "public"."lessons" USING "btree" ("mux_asset_id") WHERE ("mux_asset_id" IS NOT NULL);



CREATE INDEX "idx_lessons_mux_upload" ON "public"."lessons" USING "btree" ("mux_upload_id") WHERE ("mux_upload_id" IS NOT NULL);



CREATE INDEX "idx_notifications_active" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_posts_created_at_desc" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_user" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_submissions_user" ON "public"."submissions" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_user_status" ON "public"."subscriptions" USING "btree" ("user_id", "status");



CREATE INDEX "landing_events_created_at_idx" ON "public"."landing_events" USING "btree" ("created_at" DESC);



CREATE INDEX "landing_events_path_created_idx" ON "public"."landing_events" USING "btree" ("path", "created_at" DESC);



CREATE INDEX "landing_faq_position_idx" ON "public"."landing_faq" USING "btree" ("position") WHERE "is_published";



CREATE INDEX "landing_testimonials_position_idx" ON "public"."landing_testimonials" USING "btree" ("position") WHERE "is_published";



CREATE INDEX "newsletter_subscribers_unsubscribed_idx" ON "public"."newsletter_subscribers" USING "btree" ("unsubscribed_at") WHERE ("unsubscribed_at" IS NOT NULL);



CREATE UNIQUE INDEX "notifications_dedupe_key" ON "public"."notifications" USING "btree" ("user_id", "type", "entity_type", "entity_id") WHERE (("entity_type" IS NOT NULL) AND ("entity_id" IS NOT NULL));



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "pending_registrations_created_at_idx" ON "public"."pending_registrations" USING "btree" ("created_at");



CREATE INDEX "pending_registrations_email_idx" ON "public"."pending_registrations" USING "btree" ("email");



CREATE INDEX "post_likes_post_id_idx" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email");



CREATE UNIQUE INDEX "profiles_email_lower_uniq" ON "public"."profiles" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_stripe_customer_id_key" ON "public"."profiles" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_events_updated_at"();



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_purchases"
    ADD CONSTRAINT "course_purchases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_purchases"
    ADD CONSTRAINT "course_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_parent_lesson_id_fkey" FOREIGN KEY ("parent_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete courses." ON "public"."courses" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can delete lessons." ON "public"."lessons" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can insert courses." ON "public"."courses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can insert lessons." ON "public"."lessons" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage assignments" ON "public"."assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update courses." ON "public"."courses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update lessons." ON "public"."lessons" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update submissions" ON "public"."submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all purchases" ON "public"."course_purchases" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can view all submissions" ON "public"."submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Assignments SELECT: course access required" ON "public"."assignments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."lessons" "l"
  WHERE (("l"."id" = "assignments"."lesson_id") AND (COALESCE("l"."is_free", false) = true) AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."course_purchases" "cp"
  WHERE (("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cp"."course_id" = "assignments"."course_id") AND ("cp"."refunded_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM ("public"."subscriptions" "s"
     JOIN "public"."courses" "c" ON (("c"."id" = "assignments"."course_id")))
  WHERE (("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("s"."status" = ANY (ARRAY['active'::"text", 'trialing'::"text"])) AND ("s"."current_period_start" <= (("make_date"("c"."year", "c"."month", 1) + '1 mon'::interval) - '00:00:01'::interval)) AND ("s"."current_period_end" >= "make_date"("c"."year", "c"."month", 1)))))));



CREATE POLICY "Authenticated users can create comments" ON "public"."comments" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can insert posts." ON "public"."posts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can toggle likes" ON "public"."comment_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Comments SELECT: post or accessible-lesson" ON "public"."comments" FOR SELECT USING (((("post_id" IS NOT NULL) AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL)) OR (("lesson_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lessons" "l"
  WHERE (("l"."id" = "comments"."lesson_id") AND (((COALESCE("l"."is_free", false) = true) AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL)) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
           FROM "public"."course_purchases" "cp"
          WHERE (("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cp"."course_id" = "l"."course_id") AND ("cp"."refunded_at" IS NULL)))) OR (EXISTS ( SELECT 1
           FROM ("public"."subscriptions" "s"
             JOIN "public"."courses" "c" ON (("c"."id" = "l"."course_id")))
          WHERE (("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("s"."status" = ANY (ARRAY['active'::"text", 'trialing'::"text"])) AND ("s"."current_period_start" <= (("make_date"("c"."year", "c"."month", 1) + '1 mon'::interval) - '00:00:01'::interval)) AND ("s"."current_period_end" >= "make_date"("c"."year", "c"."month", 1))))))))))));



CREATE POLICY "Courses are viewable by everyone (published or admin)." ON "public"."courses" FOR SELECT USING (((COALESCE("is_published", false) = true) OR "public"."is_admin"()));



CREATE POLICY "Lessons SELECT: free, admin, purchased or subscribed." ON "public"."lessons" FOR SELECT USING (((COALESCE("is_free", false) = true) OR "public"."is_admin"() OR "public"."has_course_purchase"("course_id") OR (EXISTS ( SELECT 1
   FROM ("public"."subscriptions" "s"
     JOIN "public"."courses" "c" ON (("c"."id" = "lessons"."course_id")))
  WHERE (("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("s"."status" = ANY (ARRAY['active'::"text", 'trialing'::"text"])) AND ("c"."year" IS NOT NULL) AND ("c"."month" IS NOT NULL) AND ("s"."current_period_start" <= (("make_date"("c"."year", "c"."month", 1) + '1 mon'::interval) - '00:00:01'::interval)) AND ("s"."current_period_end" >= "make_date"("c"."year", "c"."month", 1)))))));



CREATE POLICY "Likes are viewable by authenticated users" ON "public"."comment_likes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Likes viewable by all authenticated" ON "public"."post_likes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Posts are viewable by authenticated users." ON "public"."posts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can delete own comments." ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts." ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own progress." ON "public"."lesson_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own submissions" ON "public"."submissions" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can like posts" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove their likes" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike own" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own comments." ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications." ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own pending submissions" ON "public"."submissions" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can update own posts." ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own progress." ON "public"."lesson_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications." ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own progress." ON "public"."lesson_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own purchases" ON "public"."course_purchases" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own submissions" ON "public"."submissions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription." ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."account_deletions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_deletions admin SELECT" ON "public"."account_deletions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "account_deletions service INSERT" ON "public"."account_deletions" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_submissions admin SELECT" ON "public"."contact_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "contact_submissions service INSERT only" ON "public"."contact_submissions" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."course_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_purchases_insert_service_only" ON "public"."course_purchases" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_admin_read_all" ON "public"."events" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "events_admin_write" ON "public"."events" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "events_public_read" ON "public"."events" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."landing_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landing_events admin SELECT" ON "public"."landing_events" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "landing_events no client INSERT" ON "public"."landing_events" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."landing_faq" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landing_faq_read" ON "public"."landing_faq" FOR SELECT USING (("is_published" OR "public"."is_admin"()));



CREATE POLICY "landing_faq_write" ON "public"."landing_faq" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."landing_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landing_stats_read" ON "public"."landing_stats" FOR SELECT USING (true);



CREATE POLICY "landing_stats_write" ON "public"."landing_stats" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."landing_testimonials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landing_testimonials_read" ON "public"."landing_testimonials" FOR SELECT USING (("is_published" OR "public"."is_admin"()));



CREATE POLICY "landing_testimonials_write" ON "public"."landing_testimonials" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."lesson_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "newsletter admin SELECT" ON "public"."newsletter_subscribers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "newsletter service INSERT only" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (false);



CREATE POLICY "newsletter service UPDATE only" ON "public"."newsletter_subscribers" FOR UPDATE USING (false);



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pending_registrations_no_delete" ON "public"."pending_registrations" FOR DELETE USING (false);



CREATE POLICY "pending_registrations_no_insert" ON "public"."pending_registrations" FOR INSERT WITH CHECK (false);



CREATE POLICY "pending_registrations_no_select" ON "public"."pending_registrations" FOR SELECT USING (false);



CREATE POLICY "pending_registrations_no_update" ON "public"."pending_registrations" FOR UPDATE USING (false);



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."archive_old_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_old_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_course_purchase"("target_course_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_events_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_role"("target" "uuid", "new_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_role"("target" "uuid", "new_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_notification"("recipient_id" "uuid", "actor_id" "uuid", "n_type" "text", "ent_type" "text", "ent_id" "uuid", "n_link" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_notification"("recipient_id" "uuid", "actor_id" "uuid", "n_type" "text", "ent_type" "text", "ent_id" "uuid", "n_link" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."account_deletions" TO "anon";
GRANT ALL ON TABLE "public"."account_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."contact_submissions" TO "anon";
GRANT ALL ON TABLE "public"."contact_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."course_purchases" TO "anon";
GRANT ALL ON TABLE "public"."course_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."course_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."landing_events" TO "anon";
GRANT ALL ON TABLE "public"."landing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."landing_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."landing_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."landing_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."landing_faq" TO "anon";
GRANT ALL ON TABLE "public"."landing_faq" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_faq" TO "service_role";



GRANT ALL ON TABLE "public"."landing_stats" TO "anon";
GRANT ALL ON TABLE "public"."landing_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_stats" TO "service_role";



GRANT ALL ON TABLE "public"."landing_testimonials" TO "anon";
GRANT ALL ON TABLE "public"."landing_testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_progress" TO "anon";
GRANT ALL ON TABLE "public"."lesson_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_progress" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("avatar_url"),UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("updated_at"),UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("role") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("instagram"),UPDATE("instagram") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("instagram") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("facebook"),UPDATE("facebook") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("facebook") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("tiktok"),UPDATE("tiktok") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("tiktok") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("youtube"),UPDATE("youtube") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("youtube") ON TABLE "public"."profiles" TO "anon";



GRANT ALL ON TABLE "public"."notifications_with_actor" TO "anon";
GRANT ALL ON TABLE "public"."notifications_with_actor" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications_with_actor" TO "service_role";



GRANT ALL ON TABLE "public"."pending_registrations" TO "anon";
GRANT ALL ON TABLE "public"."pending_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submissions" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT INSERT("assignment_id"),UPDATE("assignment_id") ON TABLE "public"."submissions" TO "authenticated";



GRANT INSERT("user_id"),UPDATE("user_id") ON TABLE "public"."submissions" TO "authenticated";



GRANT INSERT("text_content"),UPDATE("text_content") ON TABLE "public"."submissions" TO "authenticated";



GRANT INSERT("file_url"),UPDATE("file_url") ON TABLE "public"."submissions" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."submissions" TO "authenticated";



GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."submissions" TO "authenticated";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































