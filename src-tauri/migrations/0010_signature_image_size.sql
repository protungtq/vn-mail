-- Version 10: a signature picture's stored size, so sent mail can state it
-- and every mail program shows the banner at its intended size. Old
-- signatures keep NULL here and fall back to the previous capped size.

ALTER TABLE signatures ADD COLUMN image_width INTEGER;
ALTER TABLE signatures ADD COLUMN image_height INTEGER;
