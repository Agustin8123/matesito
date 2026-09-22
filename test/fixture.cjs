// Isolated schema inferred from the application's SQL; never connects to production.
const { newDb, DataType } = require('pg-mem');
const jwt = require('jsonwebtoken');
function fixture() {
    process.env.JWT_SECRET = 'matesito-tests-only';
    const memory = newDb();
    // pg-mem does not model PostgreSQL locks; emulate only these scalar calls.
    memory.public.registerFunction({ name: 'hashtext', args: [DataType.text], returns: DataType.integer, implementation: () => 1 });
    memory.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.integer, implementation: () => 0 });
    memory.public.none(`
        CREATE TABLE users (id serial PRIMARY KEY, username text UNIQUE NOT NULL, password text NOT NULL, image text, description text);
        CREATE TABLE posts (id serial PRIMARY KEY, username text NOT NULL, content text, media text, mediatype text, sensitive boolean, created_at timestamptz);
        CREATE TABLE foros (id serial PRIMARY KEY, name text UNIQUE, description text, owner_id integer REFERENCES users(id), created_at timestamptz);
        CREATE TABLE grupos (id serial PRIMARY KEY, name text, description text, owner_id integer REFERENCES users(id), invite_code text UNIQUE, created_at timestamptz);
        CREATE TABLE participantes (id serial PRIMARY KEY, user_id integer REFERENCES users(id), forum_or_group_id integer, is_group boolean, joined_at timestamptz);
        CREATE TABLE seguir (id serial PRIMARY KEY, follower_id integer REFERENCES users(id), followed_id integer REFERENCES users(id), forum_id integer, created_at timestamptz);
        CREATE TABLE chats (id serial PRIMARY KEY, user1_id integer REFERENCES users(id), user2_id integer REFERENCES users(id), created_at timestamptz);
        CREATE SEQUENCE message_ids;
        CREATE TABLE mensajes (id text PRIMARY KEY DEFAULT nextval('message_ids')::text, chat_or_group_id text, content text, sensitive boolean, sender_id integer REFERENCES users(id), created_at timestamptz, media text, media_type text, is_private boolean);
        CREATE TABLE notificaciones (id serial PRIMARY KEY, user_id integer REFERENCES users(id), tipo text, referencia_id text, chat_or_group_id text, leido boolean DEFAULT false);
        CREATE TABLE reactions (id text, reaction_id integer, count integer, PRIMARY KEY (id, reaction_id));
        CREATE TABLE user_reactions (user_id integer REFERENCES users(id), post_id text, reaction_id integer, PRIMARY KEY(user_id, post_id));
        INSERT INTO users (username, password, description) VALUES ('MateUno', 'test', 'Cuenta local'), ('MateDos', 'test', ''), ('MateTres', 'test', '');
        INSERT INTO foros (name, description, owner_id) VALUES ('La ronda', 'Charlemos', 1);
        INSERT INTO grupos (name, description, owner_id, invite_code) VALUES ('Amigos', 'Grupo local', 1, 'abc123');
        INSERT INTO participantes (user_id, forum_or_group_id, is_group) VALUES (1, 1, false), (2, 1, false), (1, 1, true), (2, 1, true);
        INSERT INTO chats (user1_id, user2_id) VALUES (1, 2);
        INSERT INTO seguir (follower_id, followed_id) VALUES (1, 2), (2, 1);
    `);
    const pg = require('pg');
    const original = pg.Pool;
    pg.Pool = memory.adapters.createPg().Pool;
    delete require.cache[require.resolve('../app')];
    const app = require('../app');
    pg.Pool = original;
    const token = (id = 1, username = 'MateUno') => jwt.sign({ id, username }, process.env.JWT_SECRET);
    return { ...app, memory, token };
}
module.exports = { fixture };
