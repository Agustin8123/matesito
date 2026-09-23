-- Matesito 1.3.0 — PostgreSQL, esquema inicial y actualización compatible.
-- Aplicar ANTES de arrancar 1.3.0, con la aplicación detenida y un respaldo.
-- psql -X --set ON_ERROR_STOP=on --dbname matesito --file schema.sql
-- No elimina publicaciones, cuentas, mensajes ni reacciones históricas.
-- Si hay duplicados o tipos incompatibles, aborta toda la transacción.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY, username text NOT NULL, password text NOT NULL,
    image text, description text, auth_version integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS posts (
    id serial PRIMARY KEY, username text NOT NULL, content text NOT NULL,
    media text, mediatype text, sensitive boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS foros (
    id serial PRIMARY KEY, name text NOT NULL, description text NOT NULL,
    owner_id integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grupos (
    id serial PRIMARY KEY, name text NOT NULL, description text NOT NULL,
    owner_id integer NOT NULL, invite_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS participantes (
    id serial PRIMARY KEY, user_id integer NOT NULL, forum_or_group_id integer NOT NULL,
    is_group boolean NOT NULL DEFAULT false, joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seguir (
    id serial PRIMARY KEY, follower_id integer NOT NULL, followed_id integer,
    forum_id integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chats (
    id serial PRIMARY KEY, user1_id integer NOT NULL, user2_id integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS message_ids;
CREATE TABLE IF NOT EXISTS mensajes (
    id text PRIMARY KEY DEFAULT nextval('message_ids')::text,
    chat_or_group_id text NOT NULL, content text NOT NULL, sensitive boolean NOT NULL DEFAULT false,
    sender_id integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    media text, media_type text, is_private boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS notificaciones (
    id serial PRIMARY KEY, user_id integer NOT NULL, tipo text NOT NULL,
    referencia_id text NOT NULL, chat_or_group_id text NOT NULL, leido boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS reactions (
    id text NOT NULL, reaction_id integer NOT NULL, count integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_reactions (
    user_id integer NOT NULL, post_id text NOT NULL, reaction_id integer NOT NULL
);

-- Columnas añadidas en refactors previos y 1.3.0.
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
UPDATE users SET auth_version=0 WHERE auth_version IS NULL;
ALTER TABLE users ALTER COLUMN auth_version SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN auth_version SET NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mediatype text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sensitive boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS media text;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS sensitive boolean DEFAULT false;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE participantes ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();
ALTER TABLE seguir ADD COLUMN IF NOT EXISTS forum_id integer;
ALTER TABLE seguir ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE foros ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS leido boolean DEFAULT false;

-- Convierte los flags 0/1 antiguos sin confundir el texto 'false' con verdadero.
DO $$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM (VALUES ('posts','sensitive'), ('mensajes','sensitive'),
        ('mensajes','is_private'), ('participantes','is_group'), ('notificaciones','leido')) AS flags(tab, col)
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', item.tab, item.col);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE boolean USING CASE WHEN %I IS NULL THEN false ELSE %I::text::boolean END', item.tab, item.col, item.col, item.col);
        EXECUTE format('UPDATE %I SET %I = false WHERE %I IS NULL', item.tab, item.col, item.col);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT false', item.tab, item.col);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', item.tab, item.col);
    END LOOP;
END $$;

-- Los mensajes usan IDs textuales F-/C-/G-; el servidor asigna el prefijo.
ALTER TABLE mensajes ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE mensajes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE mensajes ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE mensajes ALTER COLUMN id SET DEFAULT nextval('message_ids')::text;
ALTER TABLE notificaciones ALTER COLUMN referencia_id TYPE text USING referencia_id::text;


-- Mantener posts de autores históricos: username NO lleva FK a users.
-- Los vínculos polimórficos F-/C-/G- se validan en la aplicación.
CREATE UNIQUE INDEX IF NOT EXISTS matesito_users_username_uq ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS matesito_foros_name_uq ON foros(name);
CREATE UNIQUE INDEX IF NOT EXISTS matesito_grupos_invite_uq ON grupos(invite_code);
CREATE UNIQUE INDEX IF NOT EXISTS matesito_participantes_uq ON participantes(user_id, forum_or_group_id, is_group);
CREATE UNIQUE INDEX IF NOT EXISTS matesito_seguir_user_uq ON seguir(follower_id, followed_id) WHERE followed_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS matesito_seguir_forum_uq ON seguir(follower_id, forum_id) WHERE forum_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS matesito_chat_pair_uq ON chats(LEAST(user1_id,user2_id), GREATEST(user1_id,user2_id));
CREATE UNIQUE INDEX IF NOT EXISTS matesito_reaction_count_uq ON reactions(id,reaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS matesito_user_reaction_uq ON user_reactions(user_id,post_id);

-- FKs NOT VALID conservan registros históricos huérfanos; protegen escrituras nuevas.
DO $$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM (VALUES
        ('foros','owner_id'), ('grupos','owner_id'), ('participantes','user_id'),
        ('seguir','follower_id'), ('seguir','followed_id'), ('chats','user1_id'),
        ('chats','user2_id'), ('mensajes','sender_id'), ('notificaciones','user_id'), ('user_reactions','user_id')
    ) AS refs(tab,col)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matesito_' || item.tab || '_' || item.col || '_fk') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) NOT VALID',
                item.tab, 'matesito_' || item.tab || '_' || item.col || '_fk', item.col);
        END IF;
    END LOOP;
END $$;

-- Restaurar las membresías de dueños antiguos sin duplicarlas.
INSERT INTO participantes(user_id,forum_or_group_id,is_group)
SELECT f.owner_id,f.id,false FROM foros f JOIN users u ON u.id=f.owner_id
WHERE NOT EXISTS (SELECT 1 FROM participantes p WHERE p.user_id=f.owner_id AND p.forum_or_group_id=f.id AND p.is_group=false);
INSERT INTO participantes(user_id,forum_or_group_id,is_group)
SELECT g.owner_id,g.id,true FROM grupos g JOIN users u ON u.id=g.owner_id
WHERE NOT EXISTS (SELECT 1 FROM participantes p WHERE p.user_id=g.owner_id AND p.forum_or_group_id=g.id AND p.is_group=true);

-- Fechas nulas históricas no deben desaparecer al paginar. El epoch indica fecha desconocida.
UPDATE posts SET created_at = '1970-01-01 UTC' WHERE created_at IS NULL;
UPDATE mensajes SET created_at = '1970-01-01 UTC' WHERE created_at IS NULL;
ALTER TABLE posts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE posts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE mensajes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE mensajes ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS matesito_posts_page_idx ON posts(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS matesito_posts_author_page_idx ON posts(username,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS matesito_messages_page_idx ON mensajes(chat_or_group_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS matesito_members_context_idx ON participantes(forum_or_group_id,is_group,user_id);
CREATE INDEX IF NOT EXISTS matesito_followers_idx ON seguir(followed_id,follower_id);
CREATE INDEX IF NOT EXISTS matesito_notifications_unread_idx ON notificaciones(user_id,id DESC) WHERE leido=false;
CREATE INDEX IF NOT EXISTS matesito_notifications_context_idx ON notificaciones(chat_or_group_id);
CREATE INDEX IF NOT EXISTS matesito_user_reactions_post_idx ON user_reactions(post_id,reaction_id);
CREATE INDEX IF NOT EXISTS matesito_chats_user2_idx ON chats(user2_id);

-- Ajustar secuencias serial/identity preexistentes sin retrocederlas.
DO $$
DECLARE tab text; seq text; maximum bigint; current_value bigint;
BEGIN
    FOREACH tab IN ARRAY ARRAY['users','posts','foros','grupos','participantes','seguir','chats','notificaciones'] LOOP
        seq := pg_get_serial_sequence('public.' || tab,'id');
        IF seq IS NULL THEN
            seq := 'public.matesito_' || tab || '_id_seq';
            EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s',seq);
            EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT nextval(%L)',tab,seq);
        END IF;
        EXECUTE format('SELECT COALESCE(max(id),0) FROM %I',tab) INTO maximum;
        EXECUTE format('SELECT last_value FROM %s',seq) INTO current_value;
        PERFORM setval(seq::regclass,GREATEST(maximum,current_value,1),true);
    END LOOP;
END $$;
SELECT setval('message_ids', GREATEST(
    COALESCE((SELECT max(substring(id from '[0-9]+$')::bigint) FROM mensajes), 0),
    (SELECT last_value FROM message_ids), 1), true);
COMMIT;
