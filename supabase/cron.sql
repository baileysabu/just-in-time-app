-- Run ONCE in the Supabase SQL editor after deploying the edge functions.
-- Replace <PROJECT_REF> and <CRON_SECRET> first (same CRON_SECRET you set with `supabase secrets set`).
-- Requires the pg_cron and pg_net extensions (Database → Extensions → enable both).

select cron.schedule(
  'refresh-flights-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-flights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- To stop it later:  select cron.unschedule('refresh-flights-every-10-min');
