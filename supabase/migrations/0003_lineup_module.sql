-- The module ("modulo", e.g. 4-3-1-2) of a team's lineup for a matchday, shown next to the team
-- name on the match page. Stored on the lineup rows (same value on the 11 slots). Optional.

alter table lineups
  add column module text check (module is null or module ~ '^[0-9](-[0-9]){1,4}$');
