-- Aivoke 0007: badges and starter rewards catalog. Point costs are placeholders: tune before launch.
insert into public.badges (slug, name, description, icon) values
  ('first-visit',        'First visit',         'Explored your first tool through Aivoke.', 'compass'),
  ('streak-7',           '7-day streak',        'Explored tools seven days in a row.', 'flame'),
  ('reviewer',           'Reviewer',            'Wrote your first review.', 'message-square'),
  ('collector',          'Collector',           'Saved tools to a collection.', 'bookmark'),
  ('community-favorite', 'Community favorite',  'Reached 25 followers.', 'heart'),
  ('early-member',       'Early member',        'Joined during the early days of Aivoke.', 'sparkles')
on conflict (slug) do nothing;

insert into public.rewards_catalog (slug, name, description, cost_points, kind, needs_admin_review, payload) values
  ('profile-highlight-7d', 'Profile highlight (1 week)', 'Your public profile is highlighted in People search for seven days.', 150, 'profile_highlight', false, '{"days":7}'),
  ('extra-ai-questions',   'More daily AI questions',    '10 extra Assistant questions per day for seven days.', 100, 'extra_ai_questions', false, '{"extra_per_day":10,"days":7}'),
  ('priority-listing',     'Priority review of a suggested tool', 'Your next tool submission is reviewed first.', 300, 'priority_listing', true, '{}'),
  ('early-access',         'Early access to new features', 'Try new Aivoke features before everyone else.', 250, 'early_access', true, '{}'),
  ('pro-discount-20',      '20% off a future Pro plan', 'A discount code for the Pro plan once it launches. Codes are issued by the team after review.', 500, 'pro_discount', true, '{"percent":20}')
on conflict (slug) do nothing;
