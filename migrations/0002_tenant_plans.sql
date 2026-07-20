ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro'));
ALTER TABLE tenants ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('active', 'pending', 'past_due', 'cancelled'));
ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
ALTER TABLE tenants ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (onboarding_status IN ('incomplete', 'complete'));
ALTER TABLE tenants ADD COLUMN logo_url TEXT;
ALTER TABLE tenants ADD COLUMN limit_overrides_json TEXT NOT NULL DEFAULT '{}';

UPDATE tenants
SET plan = 'pro',
    billing_status = 'active',
    status = 'active',
    onboarding_status = 'complete'
WHERE id IN ('melati', 'ayu');
