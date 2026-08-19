CREATE TABLE IF NOT EXISTS dashboard_projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'On Track',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    budget NUMERIC(12,2) NOT NULL DEFAULT 0,
    spent NUMERIC(12,2) NOT NULL DEFAULT 0,
    start_date DATE,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dashboard_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Not Started',
    owner TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_milestones (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dashboard_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT NOT NULL DEFAULT 'Upcoming',
    target_date DATE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_risks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dashboard_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    severity TEXT NOT NULL DEFAULT 'Medium',
    mitigation INTEGER NOT NULL DEFAULT 0 CHECK (mitigation >= 0 AND mitigation <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_updates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES dashboard_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    owner_initials TEXT,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_updates_project_id ON updates(project_id);
