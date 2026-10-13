import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, CheckCheck, CircleCheck, ClipboardList,
  Clock3, Edit3, Flag, LayoutDashboard, ListTodo, Plus,
  Search, Sparkles, Trash2, X, LogOut, LockKeyhole,
} from 'lucide-react';

import { supabase, isConfigured } from './lib/supabase.js';

const PRIORITIES = {
  high: { label: 'Haute', className: 'high' },
  medium: { label: 'Moyenne', className: 'medium' },
  low: { label: 'Basse', className: 'low' },
};

const todayISO = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function formatDueDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });
}

function SidebarButton({ active, icon: Icon, label, count, onClick }) {
  return (
    <button type="button" className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={19} strokeWidth={1.9} />
      <span>{label}</span>
      <span className="nav-count">{count}</span>
    </button>
  );
}

function TaskRow({ task, onToggle, onDelete, onEdit, isEditing, onSave, onCancel }) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate || '');

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
      setEditPriority(task.priority);
      setEditDueDate(task.dueDate || '');
    }
  }, [isEditing, task.title, task.priority, task.dueDate]);

  const isOverdue = Boolean(task.dueDate && !task.completed && task.dueDate < todayISO());

  function handleSave(event) {
    event.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    onSave(task.id, { title: trimmed, priority: editPriority, dueDate: editDueDate });
  }

  if (isEditing) {
    return (
      <form className="task-row editing" onSubmit={handleSave}>
        <div className="edit-fields">
          <input className="edit-title" aria-label="Modifier le titre" autoFocus maxLength={160} value={editTitle} onChange={event => setEditTitle(event.target.value)} required />
          <div className="edit-options">
            <select aria-label="Modifier la priorité" value={editPriority} onChange={event => setEditPriority(event.target.value)}>
              <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
            </select>
            <input aria-label="Modifier la date" type="date" value={editDueDate} onChange={event => setEditDueDate(event.target.value)} />
          </div>
        </div>
        <div className="row-actions visible">
          <button title="Enregistrer" aria-label="Enregistrer" className="icon-button save" type="submit"><Check size={18} /></button>
          <button title="Annuler" aria-label="Annuler" className="icon-button" type="button" onClick={onCancel}><X size={18} /></button>
        </div>
      </form>
    );
  }

  return (
    <div className={`task-row ${task.completed ? 'completed' : ''}`}>
      <button className={`task-checkbox ${task.completed ? 'checked' : ''}`} title={task.completed ? 'Marquer à faire' : 'Marquer terminée'} aria-label={`${task.completed ? 'Marquer à faire' : 'Terminer'} : ${task.title}`} aria-pressed={task.completed} type="button" onClick={() => onToggle(task.id)}>
        {task.completed && <Check size={15} strokeWidth={3} />}
      </button>
      <div className="task-content">
        <p className="task-title">{task.title}</p>
        <div className="task-meta">
          <span className={`priority-label ${PRIORITIES[task.priority]?.className || 'medium'}`}><span className="priority-dot" />{PRIORITIES[task.priority]?.label || 'Moyenne'}</span>
          {task.dueDate && <span className={`due-label ${isOverdue ? 'overdue' : ''}`}><CalendarDays size={13} />{formatDueDate(task.dueDate)}{isOverdue && ' · En retard'}</span>}
        </div>
      </div>
      <div className="row-actions">
        <button title="Modifier" aria-label={`Modifier ${task.title}`} className="icon-button" onClick={() => onEdit(task.id)} type="button"><Edit3 size={17} /></button>
        <button title="Supprimer" aria-label={`Supprimer ${task.title}`} className="icon-button danger" onClick={() => onDelete(task.id)} type="button"><Trash2 size={17} /></button>
      </div>
    </div>
  );
}

function TaskDashboard({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [legacyCount, setLegacyCount] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('taskflow:tasks:v1') || 'null');
      return Array.isArray(data) ? data.filter(task => typeof task.title === 'string' && task.title.trim()).length : 0;
    } catch { return 0; }
  });

  function normalizeTask(row) {
    return {
      id: row.id,
      title: row.title,
      priority: row.priority,
      dueDate: row.due_date || '',
      completed: row.completed,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async function fetchTasks() {
    const { data, error } = await supabase.from('tasks')
      .select('id,title,priority,due_date,completed,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(normalizeTask);
  }

  async function refreshTasks() {
    setTasks(await fetchTasks());
  }

  useEffect(() => {
    let active = true;
    fetchTasks().then(data => {
      if (active) setTasks(data);
    }).catch(error => {
      if (active) setActionError(`Chargement impossible : ${error.message}`);
    }).finally(() => {
      if (active) setLoadingTasks(false);
    });
    return () => { active = false; };
  }, [user.id]);

  async function runAction(operation) {
    if (busy) return;
    setActionError('');
    setBusy(true);
    try {
      await operation();
      await refreshTasks();
    } catch (error) {
      setActionError(error.message || 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  const finished = tasks.filter(task => task.completed).length;
  const pending = tasks.length - finished;
  const progress = tasks.length ? Math.round((finished / tasks.length) * 100) : 0;
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr-FR');
    return tasks
      .filter(task => filter === 'all' || (filter === 'pending' ? !task.completed : task.completed))
      .filter(task => task.title.toLocaleLowerCase('fr-FR').includes(term))
      .sort((a, b) => Number(a.completed) - Number(b.completed) || Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }, [tasks, filter, search]);

  function addTask(event) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    runAction(async () => {
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: value,
        priority,
        due_date: dueDate || null,
        completed: false,
      });
      if (error) throw error;
      setTitle('');
      setPriority('medium');
      setDueDate('');
      setFilter('all');
      setSearch('');
    });
  }

  function updateTask(id, changes) {
    runAction(async () => {
      const { error } = await supabase.from('tasks').update({
        title: changes.title,
        priority: changes.priority,
        due_date: changes.dueDate || null,
      }).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setEditingId(null);
    });
  }

  function toggleTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    runAction(async () => {
      const { error } = await supabase.from('tasks')
        .update({ completed: !task.completed })
        .eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    });
  }

  function deleteTask(id) {
    runAction(async () => {
      const { error } = await supabase.from('tasks')
        .delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setEditingId(null);
    });
  }

  function clearCompleted() {
    if (!finished || !window.confirm(`Supprimer ${finished} tâche(s) terminée(s) ?`)) return;
    runAction(async () => {
      const { error } = await supabase.from('tasks')
        .delete().eq('user_id', user.id).eq('completed', true);
      if (error) throw error;
      setEditingId(null);
    });
  }

  function importLocalTasks() {
    if (!legacyCount || !window.confirm(`Importer ${legacyCount} tâche(s) de cet appareil dans ton compte ? Cette action peut créer des doublons si tu les as déjà importées.`)) return;
    runAction(async () => {
      const oldTasks = JSON.parse(localStorage.getItem('taskflow:tasks:v1') || '[]');
      const payload = oldTasks.filter(task => typeof task.title === 'string' && task.title.trim()).map(task => ({
        user_id: user.id,
        title: task.title.trim().slice(0, 160),
        priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '') ? task.dueDate : null,
        completed: Boolean(task.completed),
      }));
      if (!payload.length) return;
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;
      localStorage.removeItem('taskflow:tasks:v1');
      setLegacyCount(0);
    });
  }

  async function signOut() {
    setActionError('');
    const { error } = await supabase.auth.signOut();
    if (error) setActionError(error.message);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><CheckCheck size={24} strokeWidth={2.4} /></div><span>task<span className="brand-accent">flow</span><span className="brand-period">.</span></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="navigation" aria-label="Navigation des tâches">
          <SidebarButton active={filter === 'all'} icon={LayoutDashboard} label="Vue générale" count={tasks.length} onClick={() => setFilter('all')} />
          <SidebarButton active={filter === 'pending'} icon={ListTodo} label="À faire" count={pending} onClick={() => setFilter('pending')} />
          <SidebarButton active={filter === 'done'} icon={CircleCheck} label="Terminées" count={finished} onClick={() => setFilter('done')} />
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-icon"><Sparkles size={18} /></div>
          <strong>Un pas à la fois.</strong>
          <p>Les grandes choses commencent par une petite tâche.</p>
          <span className="storage-note"><span /> Synchronisé dans Supabase</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><span className="mobile-mark"><CheckCheck size={21} /></span><span className="breadcrumb">Mon espace <span>/</span> Tableau de bord</span></div><div className="topbar-account"><span title={user.email} className="account-email">{user.email}</span><button type="button" className="logout-button" onClick={signOut}><LogOut size={16} /> Déconnexion</button></div></header>
        <div className="content-inner">
          <div className="intro-line"><span className="eyebrow"><span className="eyebrow-dot" /> TON ESPACE PRODUCTIVITÉ</span><div className="mini-avatar" title={user.email} aria-hidden="true">{user.email?.charAt(0).toUpperCase() || "T"}</div></div>
          <h1>Organise ta journée<span className="heading-period">.</span></h1>
          <p className="intro-subtitle">Moins de stress, plus de progrès. Garde le cap sur ce qui compte vraiment.</p>

          <section className="stat-grid" aria-label="Statistiques des tâches">
            <div className="stat-card"><div className="stat-icon purple"><ClipboardList size={20} /></div><span className="stat-label">Toutes les tâches</span><div className="stat-value">{tasks.length}<span className="stat-unit">au total</span></div></div>
            <div className="stat-card"><div className="stat-icon orange"><Clock3 size={20} /></div><span className="stat-label">En cours</span><div className="stat-value">{pending}<span className="stat-unit">à terminer</span></div></div>
            <div className="stat-card"><div className="stat-icon green"><CircleCheck size={20} /></div><span className="stat-label">Terminées</span><div className="stat-value">{finished}<span className="stat-unit">bravo !</span></div></div>
          </section>

          <section className="progress-panel" aria-label="Progression">
            <div className="progress-head"><div><span className="progress-star"><Sparkles size={16} /></span><strong>Ta progression</strong><span className="progress-description">Continue comme ça, tu avances !</span></div><span className="progress-percent">{progress}%</span></div>
            <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Progression des tâches"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </section>

          <section className="task-section" aria-label="Gestion des tâches">
            <div className="section-heading"><div><h2>Mes tâches <span className="task-count">{tasks.length}</span></h2><p>Tout ce que tu dois faire, au même endroit.</p></div></div>
            <form className="add-form" onSubmit={addTask}>
              <div className="add-main"><div className="add-plus"><Plus size={21} /></div><input aria-label="Nouvelle tâche" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} placeholder="Ajouter une nouvelle tâche..." required /></div>
              <div className="add-options"><label className="form-option"><Flag size={17} /><select aria-label="Priorité" value={priority} onChange={event => setPriority(event.target.value)}><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option></select></label><label className="form-option"><CalendarDays size={17} /><input aria-label="Date limite" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><button className="add-button" type="submit" disabled={busy}><Plus size={18} />Ajouter <span className="desktop-only">la tâche</span></button></div>
            </form>

            {legacyCount > 0 && <div className="import-notice"><span>{legacyCount} ancienne(s) tâche(s) enregistrée(s) dans ce navigateur.</span><button disabled={busy} onClick={importLocalTasks} type="button">Importer dans mon compte</button></div>}
            {actionError && <div className="error-banner" role="alert">{actionError} <button type="button" onClick={() => refreshTasks().then(() => setActionError('')).catch(error => setActionError(error.message))}>Réessayer</button></div>}
            {busy && <p className="sync-notice" role="status">Synchronisation en cours...</p>}
            <div className="list-toolbar"><div className="tab-list" role="group" aria-label="Filtrer les tâches"><button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Toutes</button><button type="button" className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>À faire</button><button type="button" className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Terminées</button></div><div className="search-box"><Search size={17} /><input aria-label="Rechercher une tâche" value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher..." /></div></div>
            <div className="task-list">
              {loadingTasks ? <div className="empty-state">Chargement des tâches...</div> : filtered.length ? filtered.map(task => (
                <TaskRow key={task.id} task={task} isEditing={editingId === task.id} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditingId} onCancel={() => setEditingId(null)} onSave={updateTask} />
              )) : <div className="empty-state"><div className="empty-icon"><CheckCheck size={28} /></div><strong>{tasks.length === 0 ? 'Tout commence ici !' : 'Aucune tâche trouvée'}</strong><p>{tasks.length === 0 ? 'Ajoute ta première tâche pour démarrer.' : 'Essaie un autre filtre ou une autre recherche.'}</p></div>}
            </div>
            <div className="list-footer"><span>{pending} tâche{pending !== 1 ? 's' : ''} restante{pending !== 1 ? 's' : ''}</span><button type="button" disabled={!finished || busy} onClick={clearCompleted}><Trash2 size={15} /> Effacer les terminées</button></div>
          </section>
          <footer className="page-footer">Fait pour avancer, un jour à la fois. <span>✦</span> TaskFlow</footer>
        </div>
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setErrorMessage('');
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Compte demandé ! Vérifie ton email pour confirmer ton inscription (si la confirmation est activée).');
        } else {
          setMessage('Compte créé. Connexion en cours...');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setErrorMessage(error.message || 'Authentification impossible.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setErrorMessage('');
    setMessage('');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-icon"><CheckCheck size={25} /></span><span>task<span className="brand-accent">flow</span><span className="brand-period">.</span></span></div>
        <div className="auth-lock"><LockKeyhole size={23}/></div>
        <h1>{mode === 'login' ? 'Bon retour !' : 'Créer ton espace'}</h1>
        <p className="auth-description">{mode === 'login' ? 'Connecte-toi pour retrouver tes tâches sur tous tes appareils.' : 'Tes tâches restent privées et synchronisées.'}</p>
        <div className="auth-tabs"><button className={mode === 'login' ? 'selected' : ''} type="button" onClick={() => changeMode('login')}>Connexion</button><button className={mode === 'register' ? 'selected' : ''} type="button" onClick={() => changeMode('register')}>Inscription</button></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" autoComplete="email" required placeholder="toi@exemple.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Mot de passe<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} placeholder="6 caractères minimum" value={password} onChange={event => setPassword(event.target.value)} /></label>
          {errorMessage && <p role="alert" className="auth-error">{errorMessage}</p>}
          {message && <p role="status" className="auth-success">{message}</p>}
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Un instant...' : mode === 'login' ? 'Se connecter' : "Créer mon compte"}</button>
        </form>
        <p className="auth-footer">Propulsé par Supabase Auth + PostgreSQL + RLS.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn("Session Supabase :", error.message);
      setSession(data.session);
    }).catch(error => {
      if (mounted) console.warn("Session Supabase :", error.message);
    }).finally(() => {
      if (mounted) setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setCheckingSession(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (!isConfigured) {
    return <div className="auth-page"><div className="auth-card"><h1>Configurer Supabase</h1><p className="auth-description">Copie <code>.env.example</code> vers <code>.env.local</code>, ajoute l'URL et la clé publishable de ton projet, puis redémarre Vite.</p><p className="auth-footer">Ne colle jamais une clé secrète dans le frontend.</p></div></div>;
  }
  if (checkingSession) return <div className="auth-page"><p>Chargement de ton espace...</p></div>;
  if (!session?.user) return <AuthScreen />;
  return <TaskDashboard key={session.user.id} user={session.user} />;
}
