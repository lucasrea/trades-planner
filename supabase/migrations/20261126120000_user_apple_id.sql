-- Sign in with Apple: Apple's stable user id ("sub"), set when an Apple sign-in first matches an
-- account by its verified email. One Apple id belongs to at most one user; NULLs do not collide.
ALTER TABLE users ADD COLUMN apple_id text;

CREATE UNIQUE INDEX users_apple_id_idx ON users (apple_id);
