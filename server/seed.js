/**
 * Seed script — populates the database with realistic demo data.
 * Dates are computed relative to the current date so the app always feels alive.
 */
const bcrypt = require('bcryptjs');
const { db, isFresh } = require('./db');

// Deterministic PRNG so re-seeds look the same
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const daysAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
const now = new Date();
const monthStr = (offset) => {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const PASSWORD = 'demo123';

function seed() {
  if (!isFresh()) {
    console.log('Database already seeded — skipping.');
    return;
  }
  console.log('Seeding Lumina Studios demo data…');
  const rnd = mulberry32(20260810);
  const hash = bcrypt.hashSync(PASSWORD, 10);

  const insertUser = db.prepare(`INSERT INTO users
    (name, email, password_hash, role, department, position, phone, location, bio, skills, salary, hire_date, status, avatar_hue)
    VALUES (@name, @email, @password_hash, @role, @department, @position, @phone, @location, @bio, @skills, @salary, @hire_date, @status, @avatar_hue)`);
  const insertClient = db.prepare(`INSERT INTO clients
    (name, company, email, phone, industry, status, notes, hue)
    VALUES (@name, @company, @email, @phone, @industry, @status, @notes, @hue)`);
  const insertProject = db.prepare(`INSERT INTO projects
    (name, client_id, type, status, priority, budget, spent, start_date, deadline, manager_id, description, progress)
    VALUES (@name, @client_id, @type, @status, @priority, @budget, @spent, @start_date, @deadline, @manager_id, @description, @progress)`);
  const insertTask = db.prepare(`INSERT INTO tasks
    (title, description, project_id, assignee_id, status, priority, due_date, estimated_hours, completed_at)
    VALUES (@title, @description, @project_id, @assignee_id, @status, @priority, @due_date, @estimated_hours, @completed_at)`);
  const insertAsset = db.prepare(`INSERT INTO assets
    (name, type, project_id, uploaded_by, size_mb, hue, tags, description, url)
    VALUES (@name, @type, @project_id, @uploaded_by, @size_mb, @hue, @tags, @description, @url)`);
  const insertTimesheet = db.prepare(`INSERT INTO timesheets
    (user_id, project_id, date, hours, description, status)
    VALUES (@user_id, @project_id, @date, @hours, @description, @status)`);
  const insertAttendance = db.prepare(`INSERT INTO attendance
    (user_id, date, check_in, check_out, status)
    VALUES (@user_id, @date, @check_in, @check_out, @status)`);
  const insertPayroll = db.prepare(`INSERT INTO payroll
    (user_id, month, base_salary, bonus, deductions, net, status, paid_at)
    VALUES (@user_id, @month, @base_salary, @bonus, @deductions, @net, @status, @paid_at)`);
  const insertActivity = db.prepare(`INSERT INTO activity
    (user_id, action, target_type, target_id, details)
    VALUES (@user_id, @action, @target_type, @target_id, @details)`);

  // ---------- EMPLOYEES ----------
  const users = [
    { name: 'Arjun Mehta', email: 'owner@lumina.studio', role: 'owner', department: 'Management', position: 'CEO & Founder', phone: '+91 98450 11223', location: 'Hyderabad', bio: 'Founder of Lumina Studios. Loves great storytelling and long shoots.', skills: 'Leadership, Strategy, Client Relations', salary: 420000, hire_date: '2018-04-02', hue: 262 },
    { name: 'Kavya Reddy', email: 'admin@lumina.studio', role: 'admin', department: 'Management', position: 'Operations Director', phone: '+91 98850 44112', location: 'Hyderabad', bio: 'Keeps the studio running — schedules, vendors, and everything in between.', skills: 'Operations, Vendor Management, Budgeting', salary: 260000, hire_date: '2019-07-15', hue: 210 },
    { name: 'Rahul Sharma', email: 'manager@lumina.studio', role: 'manager', department: 'Production', position: 'Production Manager', phone: '+91 90000 77812', location: 'Hyderabad', bio: 'Production lead across video, photo and design. Your deadline is my deadline.', skills: 'Production, Scheduling, QA', salary: 180000, hire_date: '2020-01-20', hue: 150 },
    { name: 'Ananya Iyer', email: 'hr@lumina.studio', role: 'hr', department: 'Human Resources', position: 'HR Manager', phone: '+91 99850 33421', location: 'Hyderabad', bio: 'People ops, hiring, and keeping the culture warm and weird (in a good way).', skills: 'Recruiting, Onboarding, Culture', salary: 140000, hire_date: '2021-03-08', hue: 330 },
    { name: 'Vikram Nair', email: 'finance@lumina.studio', role: 'finance', department: 'Finance', position: 'Finance Lead', phone: '+91 98950 55621', location: 'Hyderabad', bio: 'Invoices, payroll, and the numbers behind every beautiful frame.', skills: 'Accounting, Payroll, Forecasting', salary: 150000, hire_date: '2020-11-02', hue: 200 },
    { name: 'Priya Patel', email: 'priya@lumina.studio', role: 'staff', department: 'Design', position: 'Senior UX/UI Designer', phone: '+91 97010 88912', location: 'Hyderabad', bio: 'Designs interfaces people actually enjoy using.', skills: 'Figma, UX Research, Prototyping', salary: 95000, hire_date: '2021-08-16', hue: 280 },
    { name: 'Sanjay Verma', email: 'sanjay@lumina.studio', role: 'staff', department: 'Video Production', position: 'Senior Video Editor', phone: '+91 98220 44512', location: 'Hyderabad', bio: 'Cutting stories frame by frame since 2016. Premiere & DaVinci wizard.', skills: 'Premiere Pro, DaVinci, Color Grading', salary: 105000, hire_date: '2020-06-01', hue: 20 },
    { name: 'Sneha Kulkarni', email: 'sneha@lumina.studio', role: 'staff', department: 'Photography', position: 'Studio Photographer', phone: '+91 96760 22134', location: 'Hyderabad', bio: 'Chases natural light and the perfect candid.', skills: 'Studio Lighting, Retouching, Fashion', salary: 82000, hire_date: '2022-02-14', hue: 45 },
    { name: 'Aditya Rao', email: 'aditya@lumina.studio', role: 'staff', department: 'Marketing', position: 'Digital Marketing Specialist', phone: '+91 99510 99231', location: 'Hyderabad', bio: 'Turns campaigns into results across paid & organic.', skills: 'Meta Ads, Google Ads, SEO', salary: 88000, hire_date: '2022-05-30', hue: 180 },
    { name: 'Farhan Ali', email: 'farhan@lumina.studio', role: 'staff', department: 'Design', position: 'Motion & 3D Artist', phone: '+91 90100 77634', location: 'Hyderabad', bio: 'Makes things move. Blender, C4D and After Effects.', skills: 'Blender, Cinema 4D, After Effects', salary: 92000, hire_date: '2021-11-22', hue: 320 },
    { name: 'Meera Nambiar', email: 'meera@lumina.studio', role: 'staff', department: 'Design', position: 'Graphic Designer', phone: '+91 94470 12340', location: 'Hyderabad', bio: 'Illustration, print and social graphics with a bold point of view.', skills: 'Illustrator, Photoshop, Branding', salary: 72000, hire_date: '2023-01-09', hue: 340 },
    { name: 'Rohit Menon', email: 'rohit@lumina.studio', role: 'staff', department: 'Video Production', position: 'Junior Video Editor', phone: '+91 86080 44556', location: 'Hyderabad', bio: 'Quick cuts, meme edits and cleanup work — loves every second.', skills: 'Premiere Pro, After Effects', salary: 58000, hire_date: '2023-06-19', hue: 200 },
    { name: 'Ishita Gupta', email: 'ishita@lumina.studio', role: 'staff', department: 'Marketing', position: 'Social Media Manager', phone: '+91 98100 88776', location: 'Hyderabad', bio: 'Runs the feeds. Reels, stories, captions that convert.', skills: 'Content Strategy, Reels, Community', salary: 78000, hire_date: '2023-09-04', hue: 155 },
    { name: 'Arnav Singh', email: 'arnav@lumina.studio', role: 'staff', department: 'Photography', position: 'Cinematographer', phone: '+91 99090 33421', location: 'Hyderabad', bio: 'Behind the camera on every big shoot. Drones welcome.', skills: 'Cinematography, Drone, Lighting', salary: 86000, hire_date: '2022-09-12', hue: 25 },
    { name: 'Kabir Khan', email: 'kabir@lumina.studio', role: 'staff', department: 'Design', position: 'Brand Designer', phone: '+91 97000 55678', location: 'Hyderabad', bio: 'Logos, identity systems and the brand books that hold them.', skills: 'Brand Identity, Typography, Logo', salary: 80000, hire_date: '2023-04-24', hue: 250 },
    { name: 'Divya Krishnan', email: 'divya@lumina.studio', role: 'staff', department: 'Marketing', position: 'Content Writer', phone: '+91 90900 11234', location: 'Hyderabad', bio: 'Words that sell without sounding like they are selling.', skills: 'Copywriting, Scripts, SEO', salary: 65000, hire_date: '2024-01-15', hue: 285 },
  ];

  const userIds = {};
  users.forEach((u, i) => {
    const { hue, ...rest } = u;
    const r = insertUser.run({ ...rest, password_hash: hash, status: 'active', avatar_hue: hue });
    userIds[u.name] = Number(r.lastInsertRowid);
  });

  // ---------- CLIENTS ----------
  const clients = [
    { name: 'Zenith Motors', company: 'Zenith Automotive Pvt Ltd', email: 'marketing@zenithmotors.in', phone: '+91 40 4444 5566', industry: 'Automotive', status: 'active', notes: 'Flagship automotive client. Quarterly launch films.', hue: 210 },
    { name: 'FreshLeaf Organics', company: 'FreshLeaf Foods', email: 'hello@freshleaf.co', phone: '+91 80 2222 8899', industry: 'FMCG', status: 'active', notes: 'Organic foods brand. Seasonal campaign cycles.', hue: 130 },
    { name: 'TechNova Solutions', company: 'TechNova Inc.', email: 'brand@technova.io', phone: '+91 33 4000 1122', industry: 'SaaS / Technology', status: 'active', notes: 'B2B SaaS. Website, explainers, product marketing.', hue: 260 },
    { name: 'Aroma Café Chain', company: 'Aroma Hospitality Ltd', email: 'pr@aromacafe.com', phone: '+91 44 2777 3344', industry: 'Hospitality', status: 'active', notes: 'Premium café chain. Seasonal menus & identity.', hue: 30 },
    { name: 'FitCore Gym', company: 'FitCore Fitness Pvt Ltd', email: 'team@fitcore.fit', phone: '+91 22 6666 7788', industry: 'Fitness', status: 'active', notes: 'Gym chain expanding across South India.', hue: 190 },
    { name: 'Veda Jewels', company: 'Veda Jewels LLP', email: 'creative@vedajewels.com', phone: '+91 44 4555 6677', industry: 'Luxury Retail', status: 'inactive', notes: 'Luxury jewellery. Festive campaign pending.', hue: 320 },
    { name: 'Skyline Realty', company: 'Skyline Developers', email: 'marketing@skylinerealty.in', phone: '+91 40 3222 1100', industry: 'Real Estate', status: 'active', notes: 'Premium residential projects. Drone portfolio.', hue: 160 },
  ];
  const clientIds = {};
  clients.forEach((c) => {
    const r = insertClient.run({ ...c, hue: c.hue });
    clientIds[c.name] = Number(r.lastInsertRowid);
  });

  // ---------- PROJECTS ----------
  const projects = [
    { name: "Zenith Motors — 'Driven' Launch Film", client: 'Zenith Motors', type: 'video', status: 'in_progress', priority: 'high', budget: 850000, spent: 512000, start_date: daysAgo(90), deadline: daysAhead(18), manager: 'Rahul Sharma', progress: 62, description: 'Hero launch film for the new Z-7 crossover — TVC cut, 60s and 30s versions, plus CGI integration.' },
    { name: 'FreshLeaf Organics Summer Campaign', client: 'FreshLeaf Organics', type: 'marketing', status: 'in_progress', priority: 'medium', budget: 420000, spent: 238000, start_date: daysAgo(70), deadline: daysAhead(10), manager: 'Rahul Sharma', progress: 55, description: 'Multi-channel summer campaign: 3 films, static & animated social ads, influencer kit.' },
    { name: 'TechNova SaaS Website Rebrand', client: 'TechNova Solutions', type: 'web', status: 'review', priority: 'high', budget: 610000, spent: 545000, start_date: daysAgo(127), deadline: daysAhead(5), manager: 'Kavya Reddy', progress: 88, description: 'Full website redesign and brand refresh. Final client review round in progress.' },
    { name: 'Aroma Café — Brand Identity Refresh', client: 'Aroma Café Chain', type: 'design', status: 'completed', priority: 'low', budget: 180000, spent: 180000, start_date: daysAgo(161), deadline: daysAgo(72), manager: 'Kavya Reddy', progress: 100, description: 'New logo, packaging and in-store signage system for the café chain.' },
    { name: 'FitCore Gym — 360° Studio Tour', client: 'FitCore Gym', type: 'photography', status: 'in_progress', priority: 'medium', budget: 260000, spent: 140000, start_date: daysAgo(40), deadline: daysAhead(12), manager: 'Rahul Sharma', progress: 48, description: '360° virtual tour and ambience gallery for three FitCore locations.' },
    { name: 'Veda Jewels Festive Collection Film', client: 'Veda Jewels', type: 'video', status: 'planning', priority: 'high', budget: 720000, spent: 45000, start_date: daysAgo(9), deadline: daysAhead(46), manager: 'Rahul Sharma', progress: 8, description: 'Festive collection film with jewelry macro cinematography and VFX sparkle.' },
    { name: 'Skyline Realty — Aerial Portfolio', client: 'Skyline Realty', type: 'photography', status: 'on_hold', priority: 'low', budget: 300000, spent: 95000, start_date: daysAgo(82), deadline: daysAhead(31), manager: 'Kavya Reddy', progress: 35, description: 'Drone photography for six residential projects. On hold pending monsoon clearance.' },
    { name: "Zenith Motors — Social Cutdowns", client: 'Zenith Motors', type: 'video', status: 'review', priority: 'medium', budget: 240000, spent: 215000, start_date: daysAgo(56), deadline: daysAhead(2), manager: 'Rahul Sharma', progress: 90, description: '9:16 cutdowns and vertical versions of the launch film for social channels.' },
    { name: 'TechNova Product Explainer Video', client: 'TechNova Solutions', type: 'motion', status: 'in_progress', priority: 'high', budget: 380000, spent: 276000, start_date: daysAgo(31), deadline: daysAhead(15), manager: 'Rahul Sharma', progress: 64, description: '2.5D animated explainer for the TechNova analytics platform, 90 seconds.' },
    { name: 'FreshLeaf — Packaging Design System', client: 'FreshLeaf Organics', type: 'design', status: 'completed', priority: 'medium', budget: 200000, spent: 200000, start_date: daysAgo(181), deadline: daysAgo(114), manager: 'Kavya Reddy', progress: 100, description: 'Packaging design system across 24 SKUs with shelf-ready specs.' },
    { name: 'FitCore — Annual Brand Film', client: 'FitCore Gym', type: 'video', status: 'planning', priority: 'medium', budget: 560000, spent: 12000, start_date: daysAgo(5), deadline: daysAhead(53), manager: 'Rahul Sharma', progress: 5, description: 'Annual brand film for FitCore — members stories and transformation arcs.' },
    { name: 'Aroma Café — Seasonal Menu Shoot', client: 'Aroma Café Chain', type: 'photography', status: 'completed', priority: 'low', budget: 150000, spent: 150000, start_date: daysAgo(101), deadline: daysAgo(51), manager: 'Kavya Reddy', progress: 100, description: 'Summer menu photography — 40 dishes, two locations.' },
  ];
  const projectIds = {};
  projects.forEach((p) => {
    const r = insertProject.run({
      name: p.name, client_id: clientIds[p.client], type: p.type, status: p.status,
      priority: p.priority, budget: p.budget, spent: p.spent, start_date: p.start_date,
      deadline: p.deadline, manager_id: userIds[p.manager], description: p.description, progress: p.progress,
    });
    projectIds[p.name] = Number(r.lastInsertRowid);
  });

  // ---------- TASKS ----------
  const tasks = [
    { title: 'Finalize shooting script & storyboard', desc: 'Beat sheet for the hero film with client approvals.', project: "Zenith Motors — 'Driven' Launch Film", assignee: 'Arnav Singh', status: 'done', priority: 'high', due: daysAgo(30), hours: 18, done: daysAgo(12) },
    { title: 'Edit master cut — v3 (60s)', desc: 'Address client notes from v2: pacing + music cue at 0:38.', project: "Zenith Motors — 'Driven' Launch Film", assignee: 'Sanjay Verma', status: 'in_progress', priority: 'high', due: daysAhead(6), hours: 24, done: null },
    { title: 'CGI car integration shots', desc: 'Final render pass for the night driving sequence.', project: "Zenith Motors — 'Driven' Launch Film", assignee: 'Farhan Ali', status: 'in_progress', priority: 'high', due: daysAhead(9), hours: 30, done: null },
    { title: 'Color grade — hero film', desc: 'Rec.709 + cinema LUT pass, match references.', project: "Zenith Motors — 'Driven' Launch Film", assignee: 'Sanjay Verma', status: 'todo', priority: 'medium', due: daysAhead(14), hours: 12, done: null },
    { title: 'Summer campaign: 3 film treatments', desc: 'Creative treatments for the three seasonal films.', project: 'FreshLeaf Organics Summer Campaign', assignee: 'Arnav Singh', status: 'done', priority: 'medium', due: daysAgo(35), hours: 14, done: daysAgo(20) },
    { title: 'Shoot day — farmer & kitchen stories', desc: 'On-location shoot, two units.', project: 'FreshLeaf Organics Summer Campaign', assignee: 'Sneha Kulkarni', status: 'in_progress', priority: 'medium', due: daysAhead(4), hours: 16, done: null },
    { title: 'Edit reels (3× 15s)', desc: 'Vertical edits for Instagram & YouTube Shorts.', project: 'FreshLeaf Organics Summer Campaign', assignee: 'Rohit Menon', status: 'in_progress', priority: 'medium', due: daysAhead(8), hours: 10, done: null },
    { title: 'Paid ad creative set', desc: 'Static + animated ad sets for Meta and Google.', project: 'FreshLeaf Organics Summer Campaign', assignee: 'Meera Nambiar', status: 'review', priority: 'medium', due: daysAhead(3), hours: 12, done: null },
    { title: 'Design system audit & token pass', desc: 'Align color/type tokens with the new brand.', project: 'TechNova SaaS Website Rebrand', assignee: 'Priya Patel', status: 'done', priority: 'high', due: daysAgo(22), hours: 20, done: daysAgo(9) },
    { title: 'Homepage hero redesign', desc: 'New hero with product mockups + animated gradient.', project: 'TechNova SaaS Website Rebrand', assignee: 'Priya Patel', status: 'review', priority: 'high', due: daysAhead(2), hours: 16, done: null },
    { title: 'Implement responsive breakpoints', desc: 'Tablet and mobile passes across 12 key pages.', project: 'TechNova SaaS Website Rebrand', assignee: 'Farhan Ali', status: 'in_progress', priority: 'high', due: daysAhead(7), hours: 22, done: null },
    { title: 'Client feedback round — copy', desc: 'Collect and integrate copy notes from TechNova.', project: 'TechNova SaaS Website Rebrand', assignee: 'Divya Krishnan', status: 'done', priority: 'medium', due: daysAgo(15), hours: 8, done: daysAgo(8) },
    { title: 'Logo lockup & brand book v2', desc: 'Updated brand book with usage rules.', project: 'Aroma Café — Brand Identity Refresh', assignee: 'Kabir Khan', status: 'done', priority: 'low', due: daysAgo(90), hours: 26, done: daysAgo(75) },
    { title: 'Menu & packaging artwork finalize', desc: 'Print-ready artwork for all menu collateral.', project: 'Aroma Café — Brand Identity Refresh', assignee: 'Meera Nambiar', status: 'done', priority: 'low', due: daysAgo(80), hours: 20, done: daysAgo(73) },
    { title: '360° shoot — location 1 & 2', desc: 'Capture panos and ambience at two gym locations.', project: 'FitCore Gym — 360° Studio Tour', assignee: 'Arnav Singh', status: 'done', priority: 'medium', due: daysAgo(6), hours: 12, done: daysAgo(4) },
    { title: '360° shoot — location 3', desc: 'Third location capture with drone exteriors.', project: 'FitCore Gym — 360° Studio Tour', assignee: 'Arnav Singh', status: 'in_progress', priority: 'medium', due: daysAhead(2), hours: 10, done: null },
    { title: 'Retouch & stitch panoramas', desc: 'Retouch floor plans and stitch the 360 tours.', project: 'FitCore Gym — 360° Studio Tour', assignee: 'Sneha Kulkarni', status: 'todo', priority: 'medium', due: daysAhead(9), hours: 14, done: null },
    { title: 'Moodboard & treatment deck', desc: 'Creative direction deck for the festive film.', project: 'Veda Jewels Festive Collection Film', assignee: 'Kabir Khan', status: 'todo', priority: 'high', due: daysAhead(12), hours: 10, done: null },
    { title: 'Casting & location scouting', desc: 'Shortlist models and heritage locations.', project: 'Veda Jewels Festive Collection Film', assignee: 'Arnav Singh', status: 'todo', priority: 'high', due: daysAhead(15), hours: 12, done: null },
    { title: 'Macro jewelry test shots', desc: 'Test lighting rig on high-reflect jewelry.', project: 'Veda Jewels Festive Collection Film', assignee: 'Sneha Kulkarni', status: 'in_progress', priority: 'high', due: daysAhead(5), hours: 8, done: null },
    { title: 'Drone flight plan — pending clearance', desc: 'Awaiting no-fly zone clearance for project sites.', project: 'Skyline Realty — Aerial Portfolio', assignee: 'Arnav Singh', status: 'todo', priority: 'low', due: daysAhead(30), hours: 6, done: null },
    { title: 'Cutdowns 9:16 — v1 review', desc: 'Vertical cutdowns of the hero film.', project: "Zenith Motors — Social Cutdowns", assignee: 'Rohit Menon', status: 'review', priority: 'medium', due: daysAhead(2), hours: 9, done: null },
    { title: 'Thumbnail & caption set', desc: 'YouTube thumbnails and social captions.', project: "Zenith Motors — Social Cutdowns", assignee: 'Ishita Gupta', status: 'done', priority: 'medium', due: daysAgo(10), hours: 6, done: daysAgo(3) },
    { title: 'Explainer script & voiceover cast', desc: 'Final script + VO talent shortlist.', project: 'TechNova Product Explainer Video', assignee: 'Divya Krishnan', status: 'done', priority: 'high', due: daysAgo(14), hours: 10, done: daysAgo(11) },
    { title: '2.5D animation — scene 1-3', desc: 'First half of the explainer animation.', project: 'TechNova Product Explainer Video', assignee: 'Farhan Ali', status: 'in_progress', priority: 'high', due: daysAhead(5), hours: 28, done: null },
    { title: 'Sound design & mix', desc: 'Final mix pass with music bed.', project: 'TechNova Product Explainer Video', assignee: 'Sanjay Verma', status: 'todo', priority: 'medium', due: daysAhead(12), hours: 8, done: null },
    { title: 'Packaging system — shelf render', desc: 'Shelf-ready render across 24 SKUs.', project: 'FreshLeaf — Packaging Design System', assignee: 'Kabir Khan', status: 'done', priority: 'medium', due: daysAgo(120), hours: 34, done: daysAgo(116) },
    { title: 'Member story interviews', desc: 'Interviews with 4 FitCore members.', project: 'FitCore — Annual Brand Film', assignee: 'Arnav Singh', status: 'todo', priority: 'medium', due: daysAhead(20), hours: 16, done: null },
    { title: 'Menu shoot — batch 1', desc: 'Dish photography for the summer menu.', project: 'Aroma Café — Seasonal Menu Shoot', assignee: 'Sneha Kulkarni', status: 'done', priority: 'low', due: daysAgo(60), hours: 18, done: daysAgo(55) },
    { title: 'Set up project tracker & folders', desc: 'Internal kickoff housekeeping.', project: 'FitCore — Annual Brand Film', assignee: 'Rohit Menon', status: 'done', priority: 'low', due: daysAgo(3), hours: 4, done: daysAgo(2) },
  ];
  tasks.forEach((t) => {
    insertTask.run({
      title: t.title, description: t.desc, project_id: projectIds[t.project],
      assignee_id: userIds[t.assignee], status: t.status, priority: t.priority,
      due_date: t.due, estimated_hours: t.hours, completed_at: t.done,
    });
  });

  // ---------- ASSETS ----------
  const assets = [
    { name: 'Driven_LaunchFilm_MasterCut_v3.mp4', type: 'video', project: "Zenith Motors — 'Driven' Launch Film", uploader: 'Sanjay Verma', size: 4820, hue: 210, tags: 'master, hero, 4k', desc: 'Master cut 60s — v3 with client notes applied.', url: '/media/films/driven-v3.mp4' },
    { name: 'Driven_B-Roll_Day2.mp4', type: 'video', project: "Zenith Motors — 'Driven' Launch Film", uploader: 'Arnav Singh', size: 12400, hue: 205, tags: 'broll, raw', desc: 'Raw B-roll from day 2 — highway chase.', url: '/media/films/broll-day2.mp4' },
    { name: 'Z7_Studio_Beauty_Shots.png', type: 'image', project: "Zenith Motors — 'Driven' Launch Film", uploader: 'Sneha Kulkarni', size: 240, hue: 220, tags: 'studio, car', desc: 'Beauty shots of the Z-7 in studio.', url: '/media/stills/z7-beauty.png' },
    { name: 'Summer_Campaign_Treatment.pdf', type: 'document', project: 'FreshLeaf Organics Summer Campaign', uploader: 'Arnav Singh', size: 18, hue: 130, tags: 'treatment, deck', desc: 'Creative treatment deck v1.', url: '/media/docs/summer-treatment.pdf' },
    { name: 'Farm_Stories_Interview_01.mp4', type: 'video', project: 'FreshLeaf Organics Summer Campaign', uploader: 'Arnav Singh', size: 8900, hue: 135, tags: 'interview, raw', desc: 'Farmer interview — unit A.', url: '/media/films/farm-int-01.mp4' },
    { name: 'Kitchen_Story_Behind_Scenes.jpg', type: 'image', project: 'FreshLeaf Organics Summer Campaign', uploader: 'Sneha Kulkarni', size: 12, hue: 140, tags: 'bts, kitchen', desc: 'BTS from the kitchen shoot.', url: '/media/stills/kitchen-bts.jpg' },
    { name: 'TechNova_Homepage_Hero_v2.fig', type: 'design', project: 'TechNova SaaS Website Rebrand', uploader: 'Priya Patel', size: 34, hue: 260, tags: 'figma, hero', desc: 'Homepage hero design — v2 with gradient animation.', url: '/media/design/technova-hero-v2.fig' },
    { name: 'Technova_Brand_Tokens.json', type: 'document', project: 'TechNova SaaS Website Rebrand', uploader: 'Priya Patel', size: 1, hue: 265, tags: 'tokens, system', desc: 'Design tokens for the new design system.', url: '/media/docs/technova-tokens.json' },
    { name: 'Aroma_Logo_Final.ai', type: 'design', project: 'Aroma Café — Brand Identity Refresh', uploader: 'Kabir Khan', size: 22, hue: 30, tags: 'logo, vector', desc: 'Final logo lockup — horizontal + stacked.', url: '/media/design/aroma-logo.ai' },
    { name: 'Aroma_Menu_Photography_01.jpg', type: 'image', project: 'Aroma Café — Seasonal Menu Shoot', uploader: 'Sneha Kulkarni', size: 18, hue: 35, tags: 'menu, food', desc: 'Hero dish shot for the summer menu.', url: '/media/stills/aroma-menu-01.jpg' },
    { name: 'FitCore_Tour_Pano_Location1.jpg', type: 'image', project: 'FitCore Gym — 360° Studio Tour', uploader: 'Arnav Singh', size: 64, hue: 190, tags: '360, pano', desc: '360° pano — location 1 main floor.', url: '/media/stills/fitcore-pano-1.jpg' },
    { name: 'FitCore_Gym_Ambience_Reel.mp4', type: 'video', project: 'FitCore Gym — 360° Studio Tour', uploader: 'Arnav Singh', size: 3100, hue: 195, tags: 'ambience, preview', desc: 'Ambience preview reel for client review.', url: '/media/films/fitcore-ambience.mp4' },
    { name: 'Veda_Macro_Test_Lighting.mp4', type: 'video', project: 'Veda Jewels Festive Collection Film', uploader: 'Sneha Kulkarni', size: 450, hue: 320, tags: 'test, jewelry', desc: 'Macro test shots — lighting rig check.', url: '/media/films/veda-macro-test.mp4' },
    { name: 'Veda_Moodboard_Deck.pdf', type: 'document', project: 'Veda Jewels Festive Collection Film', uploader: 'Kabir Khan', size: 26, hue: 325, tags: 'moodboard', desc: 'Festive collection moodboard & treatment.', url: '/media/docs/veda-moodboard.pdf' },
    { name: 'Skyline_Drone_Test_Footage.mp4', type: 'video', project: 'Skyline Realty — Aerial Portfolio', uploader: 'Arnav Singh', size: 2100, hue: 160, tags: 'drone, test', desc: 'Test flight footage — site 4.', url: '/media/films/skyline-drone-test.mp4' },
    { name: 'Explainer_Storyboard_Final.pdf', type: 'document', project: 'TechNova Product Explainer Video', uploader: 'Divya Krishnan', size: 32, hue: 270, tags: 'storyboard, script', desc: 'Final storyboard with VO script.', url: '/media/docs/explainer-storyboard.pdf' },
    { name: 'Explainer_Scene1-3_Animation.mp4', type: 'video', project: 'TechNova Product Explainer Video', uploader: 'Farhan Ali', size: 1250, hue: 275, tags: 'animation, preview', desc: '2.5D animation preview — scenes 1 to 3.', url: '/media/films/explainer-scenes1-3.mp4' },
    { name: 'FreshLeaf_Packaging_Shelf.png', type: 'image', project: 'FreshLeaf — Packaging Design System', uploader: 'Kabir Khan', size: 88, hue: 140, tags: 'packaging, shelf', desc: 'Shelf-ready render — 24 SKUs.', url: '/media/stills/freshleaf-shelf.png' },
    { name: 'Launch_Social_Thumbnails.zip', type: 'design', project: "Zenith Motors — Social Cutdowns", uploader: 'Ishita Gupta', size: 210, hue: 215, tags: 'thumbnails, social', desc: 'Thumbnail set for all social platforms.', url: '/media/design/launch-thumbnails.zip' },
    { name: 'Campaign_Music_Bed.wav', type: 'audio', project: 'FreshLeaf Organics Summer Campaign', uploader: 'Sanjay Verma', size: 310, hue: 135, tags: 'music, audio', desc: 'Licensed music bed — summer campaign.', url: '/media/audio/campaign-music.wav' },
  ];
  assets.forEach((a) => {
    insertAsset.run({
      name: a.name, type: a.type, project_id: projectIds[a.project], uploaded_by: userIds[a.uploader],
      size_mb: a.size, hue: a.hue, tags: a.tags, description: a.desc, url: a.url,
    });
  });

  // ---------- TIMESHEETS ----------
  const staffForTimesheets = ['Priya Patel', 'Sanjay Verma', 'Sneha Kulkarni', 'Aditya Rao', 'Farhan Ali', 'Meera Nambiar', 'Rohit Menon', 'Ishita Gupta', 'Arnav Singh', 'Kabir Khan', 'Divya Krishnan'];
  const projectForUser = {
    'Priya Patel': 'TechNova SaaS Website Rebrand', 'Sanjay Verma': "Zenith Motors — 'Driven' Launch Film",
    'Sneha Kulkarni': 'FitCore Gym — 360° Studio Tour', 'Aditya Rao': 'FreshLeaf Organics Summer Campaign',
    'Farhan Ali': 'TechNova Product Explainer Video', 'Meera Nambiar': 'FreshLeaf Organics Summer Campaign',
    'Rohit Menon': "Zenith Motors — Social Cutdowns", 'Ishita Gupta': 'FreshLeaf Organics Summer Campaign',
    'Arnav Singh': 'FitCore Gym — 360° Studio Tour', 'Kabir Khan': 'Veda Jewels Festive Collection Film',
    'Divya Krishnan': 'TechNova Product Explainer Video',
  };
  for (let i = 0; i < 12; i++) {
    staffForTimesheets.forEach((name) => {
      const date = new Date(); date.setDate(date.getDate() - (i + 1));
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return; // skip weekends
      const hours = Math.round((6 + rnd() * 3.5) * 2) / 2;
      const status = i >= 4 ? 'approved' : (rnd() > 0.3 ? 'pending' : 'rejected');
      insertTimesheet.run({
        user_id: userIds[name], project_id: projectIds[projectForUser[name]],
        date: fmt(date), hours, status,
        description: status === 'pending' ? 'Ongoing project work — see task board.' : 'Project work as per task board.',
      });
    });
  }

  // ---------- ATTENDANCE (previous 14 calendar days; today is left free so users can demo check-in) ----------
  const attendeeNames = ['Priya Patel', 'Sanjay Verma', 'Sneha Kulkarni', 'Aditya Rao', 'Farhan Ali', 'Meera Nambiar', 'Rohit Menon', 'Ishita Gupta', 'Arnav Singh', 'Kabir Khan', 'Divya Krishnan', 'Rahul Sharma', 'Ananya Iyer', 'Vikram Nair'];
  for (let i = 1; i <= 14; i++) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    attendeeNames.forEach((name) => {
      const roll = rnd();
      let status = 'present', checkIn = `${9 + Math.floor(rnd() * 2)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
      if (roll > 0.88) status = 'late', checkIn = `10:${String(10 + Math.floor(rnd() * 40)).padStart(2, '0')}`;
      else if (roll > 0.82) status = 'wfh';
      else if (roll > 0.78) status = 'half_day';
      const checkOut = status === 'half_day' ? '13:30' : `18:${String(Math.floor(rnd() * 50)).padStart(2, '0')}`;
      insertAttendance.run({
        user_id: userIds[name], date: fmt(date), status,
        check_in: status === 'wfh' ? null : checkIn, check_out: status === 'wfh' ? null : checkOut,
      });
    });
  }

  // ---------- PAYROLL ----------
  const months = [monthStr(2), monthStr(1), monthStr(0)];
  months.forEach((m, idx) => {
    users.forEach((u) => {
      if (u.role === 'owner') return; // owner pays themselves, not in payroll
      const bonus = rnd() > 0.6 ? Math.round(u.salary * (0.05 + rnd() * 0.1)) : 0;
      const deductions = rnd() > 0.75 ? Math.round(u.salary * 0.05) : 0;
      const net = u.salary + bonus - deductions;
      insertPayroll.run({
        user_id: userIds[u.name], month: m, base_salary: u.salary, bonus, deductions, net,
        status: idx < 2 ? 'paid' : 'draft',
        paid_at: idx < 2 ? `${m}-05 10:00:00` : null,
      });
    });
  });

  // ---------- ACTIVITY ----------
  const activities = [
    { user: 'Rahul Sharma', action: 'created', target: 'project', id: null, details: "Created project 'FitCore — Annual Brand Film'" },
    { user: 'Sanjay Verma', action: 'updated', target: 'task', id: null, details: "Moved 'Edit master cut — v3 (60s)' to In Progress" },
    { user: 'Ishita Gupta', action: 'completed', target: 'task', id: null, details: "Completed 'Thumbnail & caption set'" },
    { user: 'Kavya Reddy', action: 'approved', target: 'timesheet', id: null, details: 'Approved 4 timesheet entries' },
    { user: 'Arnav Singh', action: 'uploaded', target: 'asset', id: null, details: 'Uploaded FitCore_Gym_Ambience_Reel.mp4' },
    { user: 'Ananya Iyer', action: 'added', target: 'employee', id: null, details: 'Added Divya Krishnan as Content Writer' },
    { user: 'Priya Patel', action: 'completed', target: 'task', id: null, details: "Completed 'Design system audit & token pass'" },
    { user: 'Rahul Sharma', action: 'updated', target: 'project', id: null, details: "Updated budget on 'Zenith Motors — Social Cutdowns'" },
    { user: 'Vikram Nair', action: 'processed', target: 'payroll', id: null, details: 'Marked July payroll as paid' },
    { user: 'Farhan Ali', action: 'uploaded', target: 'asset', id: null, details: 'Uploaded Explainer_Scene1-3_Animation.mp4' },
    { user: 'Kavya Reddy', action: 'created', target: 'client', id: null, details: 'Added client Skyline Realty' },
    { user: 'Sneha Kulkarni', action: 'completed', target: 'task', id: null, details: "Completed '360° shoot — location 1 & 2'" },
    { user: 'Aditya Rao', action: 'updated', target: 'task', id: null, details: "Moved 'Paid ad creative set' to Review" },
    { user: 'Arjun Mehta', action: 'updated', target: 'project', id: null, details: "Changed priority on 'Veda Jewels Festive Collection Film'" },
  ];
  const ago = (h) => { const d = new Date(); d.setHours(d.getHours() - h); return d.toISOString().slice(0, 19).replace('T', ' '); };
  activities.forEach((a, i) => {
    const r = insertActivity.run({
      user_id: userIds[a.user], action: a.action, target_type: a.target, target_id: a.id, details: a.details,
    });
    // backdate the activity timestamps for a natural feed
    const rowId = Number(r.lastInsertRowid);
    db.prepare('UPDATE activity SET created_at = ? WHERE id = ?').run(ago(i * 5 + 2), rowId);
  });

  console.log(`Seeded: ${users.length} employees, ${clients.length} clients, ${projects.length} projects, ${tasks.length} tasks, ${assets.length} assets, ${staffForTimesheets.length * 10} timesheets, ${months.length} payroll months.`);
  console.log('Demo login: owner@lumina.studio / demo123 (and other roles)');
}

seed();
