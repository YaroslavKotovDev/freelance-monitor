-- Switch Freelancer.com from ?jobs= (broken) to ?keyword= (working)
-- Add reddit-slavelabour as additional freelance gig source
update app_settings
set active_sources = '[
  "freelancer-react",
  "freelancer-typescript",
  "freelancer-vue",
  "freelancer-nextjs",
  "freelancer-nodejs",
  "reddit-forhire",
  "reddit-slavelabour"
]'::jsonb
where id = 1;
