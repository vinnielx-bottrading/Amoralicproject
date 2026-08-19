const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Set it in Render Environment Variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
});

async function getProjectId(req) {
  if (req.query.projectId) return Number(req.query.projectId);
  const result = await pool.query("SELECT id FROM dashboard_projects ORDER BY id LIMIT 1");
  return result.rows[0]?.id || null;
}

app.get("/api/dashboard", async (req, res) => {
  try {
    const projectId = await getProjectId(req);

    if (!projectId) {
      return res.json({
        project: null, tasks: [], milestones: [], risks: [], updates: []
      });
    }

    const [project, tasks, milestones, risks, updates] = await Promise.all([
      pool.query("SELECT * FROM dashboard_projects WHERE id=$1", [projectId]),
      pool.query("SELECT * FROM dashboard_tasks WHERE project_id=$1 ORDER BY id DESC", [projectId]),
      pool.query("SELECT * FROM dashboard_milestones WHERE project_id=$1 ORDER BY sort_order, id", [projectId]),
      pool.query("SELECT * FROM dashboard_risks WHERE project_id=$1 ORDER BY CASE severity WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, id DESC", [projectId]),
      pool.query("SELECT * FROM dashboard_updates WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20", [projectId])
    ]);

    res.json({
      project: project.rows[0] || null,
      tasks: tasks.rows,
      milestones: milestones.rows,
      risks: risks.rows,
      updates: updates.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

app.post("/api/projects", async (req, res) => {
  const { name, goal, status, progress, budget, spent, start_date, target_date } = req.body;
  if (!name) return res.status(400).json({ error: "Project name is required" });

  try {
    const result = await pool.query(
      `INSERT INTO dashboard_projects
       (name, goal, status, progress, budget, spent, start_date, target_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        name, goal || "", status || "On Track",
        Number(progress || 0), Number(budget || 0), Number(spent || 0),
        start_date || null, target_date || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  const { name, goal, status, progress, budget, spent, start_date, target_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE dashboard_projects
       SET name=$1, goal=$2, status=$3, progress=$4, budget=$5, spent=$6,
           start_date=$7, target_date=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        name, goal || "", status || "On Track",
        Number(progress || 0), Number(budget || 0), Number(spent || 0),
        start_date || null, target_date || null, req.params.id
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Project not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM dashboard_projects WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { project_id, title, status, owner, due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: "project_id and title are required" });
  try {
    const result = await pool.query(
      `INSERT INTO dashboard_tasks (project_id,title,status,owner,due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [project_id, title, status || "Not Started", owner || "", due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const { title, status, owner, due_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE dashboard_tasks SET title=$1,status=$2,owner=$3,due_date=$4
       WHERE id=$5 RETURNING *`,
      [title, status, owner || "", due_date || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM dashboard_tasks WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

app.post("/api/risks", async (req, res) => {
  const { project_id, title, description, owner, severity, mitigation } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: "project_id and title are required" });
  try {
    const result = await pool.query(
      `INSERT INTO dashboard_risks (project_id,title,description,owner,severity,mitigation)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [project_id, title, description || "", owner || "", severity || "Medium", Number(mitigation || 0)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create risk" });
  }
});

app.put("/api/risks/:id", async (req, res) => {
  const { title, description, owner, severity, mitigation } = req.body;
  try {
    const result = await pool.query(
      `UPDATE dashboard_risks SET title=$1,description=$2,owner=$3,severity=$4,mitigation=$5
       WHERE id=$6 RETURNING *`,
      [title, description || "", owner || "", severity || "Medium", Number(mitigation || 0), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Risk not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update risk" });
  }
});

app.delete("/api/risks/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM dashboard_risks WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete risk" });
  }
});

app.post("/api/updates", async (req, res) => {
  const { project_id, title, description, owner_initials, status } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: "project_id and title are required" });
  try {
    const result = await pool.query(
      `INSERT INTO dashboard_updates (project_id,title,description,owner_initials,status)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [project_id, title, description || "", owner_initials || "", status || ""]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create update" });
  }
});

app.delete("/api/updates/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM dashboard_updates WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete update" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Project dashboard running on port ${PORT}`);
});
