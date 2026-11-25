-- Seasons become calendar months from 2026-12-01 (DESIGN.md §7.1): the 2026-Q4 season ends
-- the day before, so the first request on or after Dec 1 rolls players into "2026-12".
UPDATE "seasons" SET "ends_on" = '2026-11-30' WHERE "label" = '2026-Q4' AND "ends_on" > '2026-11-30';
