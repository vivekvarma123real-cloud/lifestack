"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// --- Types ---
type OnboardingData = {
  goal: string;
  tracks: string[];
  company: string;
  role: string;
  deadline: string;
  dailyHours: number;
};

type Task = {
  id: string;
  name: string;
  track: string;
  duration: number;
  date: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'done' | 'skipped' | 'rescheduled';
};

type Project = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  github: string;
  demo: string;
  status: 'Not Started' | 'In Progress' | 'Done';
  complexity: 'Easy' | 'Medium' | 'Hard';
};

type Question = {
  id: string;
  text: string;
  difficulty: string;
  practiced: boolean;
  track?: string;
  category: 'hr' | 'technical' | 'company';
  company?: string;
};

type Resource = {
  id: string;
  title: string;
  type: 'Video' | 'Article' | 'Course' | 'Tool';
  link: string;
  track: string;
  bookmarked: boolean;
};

type Store = {
  onboarding: OnboardingData | null;
  tasks: Task[];
  projects: Project[];
  questions: Question[];
  resources: Resource[];
  streak: number;
  lastActive: string | null;
  dsaCount: number;
};

const DEFAULT_STORE: Store = {
  onboarding: null,
  tasks: [],
  projects: [],
  questions: [
    { id: 'q1', text: 'Tell me about yourself', difficulty: 'Easy', practiced: false, category: 'hr' },
    { id: 'q2', text: 'Reverse a Linked List', difficulty: 'Easy', practiced: false, track: 'DSA/Problem Solving', category: 'technical' },
    { id: 'q3', text: 'Design a URL Shortener', difficulty: 'Hard', practiced: false, track: 'System Design', category: 'technical' },
  ],
  resources: [
    { id: 'r1', title: 'NeetCode 150', type: 'Tool', link: 'https://neetcode.io/', track: 'DSA/Problem Solving', bookmarked: false },
    { id: 'r2', title: 'System Design Primer', type: 'Course', link: 'https://github.com/donnemartin/system-design-primer', track: 'System Design', bookmarked: false },
  ],
  streak: 0,
  lastActive: null,
  dsaCount: 0,
};

const TRACK_COLORS: Record<string, string> = {
  'DSA/Problem Solving': '#3B82F6', // Blue
  'Web Development': '#10B981', // Green
  'Data Science/ML': 'var(--color-teal-light)', // Purple
  'System Design': '#F59E0B', // Orange
  'DevOps/Cloud': '#14B8A6', // Teal
  'Android/iOS': '#EC4899', // Pink
  'Core CS Subjects': '#64748B', // Slate
};

const UID = () => Math.random().toString(36).substr(2, 9);
const localDateString = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = () => localDateString();

function JobPrepLockScreen() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Poppins',sans-serif",
      padding: "24px",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", marginBottom: 12 }}>
          Job Prep Planner
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", marginBottom: 20 }}>
          Coming soon. We are polishing this feature for a better experience.
        </p>
        <button
          onClick={() => { router.push("/choose"); }}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 16px",
            cursor: "pointer",
            fontFamily: "'Poppins',sans-serif",
            fontWeight: 600,
          }}
        >
          Back to Choose
        </button>
      </div>
    </div>
  );
}


export default function JobPrepPlanner({ onSwitchMode }: { onSwitchMode: () => void }) {
  const isProduction = process.env.NODE_ENV === "production";
  const [store, setStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'projects' | 'interview' | 'resources' | 'progress'>('dashboard');
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('job-prep-store');
    if (saved) {
      try {
        setStore(JSON.parse(saved));
      } catch (e) {
        setStore(DEFAULT_STORE);
      }
    } else {
      setStore(DEFAULT_STORE);
    }
  }, []);

  const updateStore = (updater: (s: Store) => Store) => {
    setStore(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      localStorage.setItem('job-prep-store', JSON.stringify(next));
      return next;
    });
  };

  if (isProduction) return <JobPrepLockScreen />;

  if (!store) return <div style={{ height: '100vh', background: '#060A17' }} />;

  if (!store.onboarding) {
    return <Onboarding onComplete={(data) => updateStore(s => ({ ...s, onboarding: data }))} onCancel={onSwitchMode} />;
  }

  // Calculate quick stats
  const todayTasks = store.tasks.filter(t => t.date === TODAY());
  const completedToday = todayTasks.filter(t => t.status === 'done').length;
  const projectDoneCount = store.projects.filter(p => p.status === 'Done').length;
  const daysLeft = store.onboarding.deadline ? Math.max(0, Math.ceil((new Date(store.onboarding.deadline).getTime() - Date.now()) / 86400000)) : 0;
  
  // Track readiness
  const readiness = Math.min(100, Math.round(
    (store.tasks.filter(t => t.status === 'done').length * 2) + 
    (store.projects.filter(p => p.status === 'Done').length * 10) + 
    (store.questions.filter(q => q.practiced).length * 1)
  ));

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#E2E8F0', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'row' }}>
      {/* Background ambient glows */}
      <div style={{position:'fixed',top:'-10%',left:'-5%',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(var(--color-teal-rgb),0.08),transparent 70%)',filter:'blur(60px)',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'fixed',bottom:'-10%',right:'-5%',width:700,height:700,borderRadius:'50%',background:'radial-gradient(circle,rgba(236,72,153,0.06),transparent 70%)',filter:'blur(60px)',pointerEvents:'none',zIndex:0}}/>
      <style>{`
        @keyframes jpFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes jpSlideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes jpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--color-teal-light-rgb),0.4); } 50% { box-shadow: 0 0 0 10px rgba(var(--color-teal-light-rgb),0); } }
        @keyframes jpGlow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes jpFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes jpShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes jpBorderGlow { 0%,100% { border-color: rgba(var(--color-teal-light-rgb),0.2); } 50% { border-color: rgba(236,72,153,0.4); } }
        .jp-sidebar { width: 68px; min-height: 100vh; background: rgba(6,10,23,0.95); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 4px; position: sticky; top: 0; z-index: 50; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        .jp-sidebar-item { width: 44px; height: 44px; border-radius: 14px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); display: flex; align-items: center; justify-content: center; color: #475569; position: relative; border: 1px solid transparent; }
        .jp-sidebar-item:hover { background: rgba(var(--color-teal-light-rgb),0.08); color: #A78BFA; transform: scale(1.08); border-color: rgba(var(--color-teal-light-rgb),0.15); }
        .jp-sidebar-item.active { background: linear-gradient(135deg, rgba(var(--color-teal-light-rgb),0.2), rgba(236,72,153,0.12)); color: #A78BFA; border-color: rgba(var(--color-teal-light-rgb),0.35); box-shadow: 0 0 20px rgba(var(--color-teal-light-rgb),0.15), inset 0 0 12px rgba(var(--color-teal-light-rgb),0.05); }
        .jp-sidebar-item.active::before { content: ''; position: absolute; left: -10px; top: 50%; transform: translateY(-50%); width: 3px; height: 24px; background: linear-gradient(180deg, var(--color-teal-light), #EC4899); border-radius: 0 3px 3px 0; }
        .jp-sidebar-item .jp-tooltip { position: absolute; left: 58px; background: rgba(15,23,42,0.95); border: 1px solid rgba(var(--color-teal-light-rgb),0.3); color: #E2E8F0; padding: 6px 12px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; pointer-events: none; opacity: 0; transform: translateX(-8px); transition: all 0.2s ease; z-index: 100; letter-spacing: 0.02em; }
        .jp-sidebar-item:hover .jp-tooltip { opacity: 1; transform: translateX(0); }
        .jp-card { background: rgba(10,15,36,0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 24px; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); animation: jpFadeIn 0.4s ease both; }
        .jp-card:hover { border-color: rgba(var(--color-teal-light-rgb),0.2); box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(var(--color-teal-light-rgb),0.05); }
        .jp-stat-card { background: rgba(10,15,36,0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 24px; position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); animation: jpFadeIn 0.35s ease both; }
        .jp-stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 20px 20px 0 0; }
        .jp-stat-card:hover { transform: translateY(-4px); border-color: rgba(var(--color-teal-light-rgb),0.2); box-shadow: 0 16px 48px rgba(0,0,0,0.3), 0 0 24px rgba(var(--color-teal-light-rgb),0.08); }
        .jp-input { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #E2E8F0; padding: 12px 16px; font-family: var(--font); font-size: 0.88rem; width: 100%; outline: none; transition: all 0.25s ease; box-sizing: border-box; }
        .jp-input:focus { border-color: var(--color-teal-light); box-shadow: 0 0 0 3px rgba(var(--color-teal-light-rgb),0.12); }
        .jp-input::placeholder { color: #475569; }
        .jp-btn { background: linear-gradient(135deg, var(--color-teal-light), var(--color-teal)); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.25s ease; letter-spacing: 0.02em; }
        .jp-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(var(--color-teal-light-rgb),0.35); }
        .jp-badge { font-size: 0.68rem; padding: 4px 10px; border-radius: 100px; font-weight: 700; letter-spacing: 0.02em; }
        .jp-section-title { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 800; margin-bottom: 20px; letter-spacing: -0.01em; }
        .jp-task-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: rgba(255,255,255,0.02); border-radius: 14px; border: 1px solid rgba(255,255,255,0.04); transition: all 0.25s ease; }
        .jp-task-row:hover { background: rgba(var(--color-teal-light-rgb),0.04); border-color: rgba(var(--color-teal-light-rgb),0.12); transform: translateX(2px); }
        .jp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; animation: jpFadeIn 0.2s ease; }
        .jp-modal { background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(10,15,36,0.98)); border: 1px solid rgba(var(--color-teal-light-rgb),0.2); border-radius: 24px; padding: 32px; width: 100%; max-width: 480px; animation: jpFadeIn 0.25s ease both; position: relative; overflow: hidden; }
        .jp-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--modal-accent, linear-gradient(90deg,var(--color-teal-light),#EC4899)); }
        .jp-modal h3 { font-size: 1.3rem; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.02em; }
        .jp-shimmer { background: linear-gradient(90deg, var(--color-teal-light), #EC4899, #06B6D4, var(--color-teal-light)); background-size: 300% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: jpShimmer 4s linear infinite; }
        @media (max-width: 768px) {
          .jp-sidebar { position: fixed; bottom: 0; left: 0; right: 0; width: 100% !important; min-height: auto !important; height: 64px; flex-direction: row; justify-content: space-around; border-right: none; border-top: 1px solid rgba(255,255,255,0.06); padding: 0 8px; z-index: 100; }
          .jp-sidebar-item { width: 40px; height: 40px; }
          .jp-sidebar-item .jp-tooltip { display: none; }
          .jp-sidebar-item.active::before { display: none; }
          .jp-main { padding: 16px 16px 80px 16px !important; }
          .jp-grid { grid-template-columns: 1fr !important; }
          .jp-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>



      {/* ── Vertical Sidebar Navigation ── */}
      <nav className="jp-sidebar">
        <div style={{cursor:'pointer',marginBottom:8}} onClick={onSwitchMode}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,var(--color-teal-light),#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(var(--color-teal-light-rgb),0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </div>
        </div>
        <div style={{width:32,height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0 8px'}}/>
        {([
          { key: 'dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>, label: 'Dashboard' },
          { key: 'planner', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: 'Planner' },
          { key: 'projects', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>, label: 'Projects' },
          { key: 'interview', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: 'Interview' },
          { key: 'resources', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, label: 'Resources' },
          { key: 'progress', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, label: 'Progress' },
        ] as { key: typeof activeTab; icon: React.ReactNode; label: string }[]).map(item => (
          <div key={item.key} className={`jp-sidebar-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
            {item.icon}
            <span className="jp-tooltip">{item.label}</span>
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(var(--color-teal-light-rgb),0.15),rgba(236,72,153,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#A78BFA', border: '1px solid rgba(var(--color-teal-light-rgb),0.2)' }}>
          {store.onboarding.goal.charAt(0)}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="jp-main" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        
        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>{
              activeTab === 'dashboard' ? <><span className="jp-shimmer">{'Preparing for ' + store.onboarding.role}</span></> :
              activeTab === 'planner' ? 'Study Planner' :
              activeTab === 'projects' ? 'Project Portfolio' :
              activeTab === 'interview' ? 'Interview Prep' :
              activeTab === 'resources' ? 'Learning Resources' : 'Progress Analytics'
            }</h1>
            <p style={{ color: '#64748B', fontSize: '0.82rem' }}>{
              activeTab === 'dashboard' ? `Target: ${store.onboarding.company} \u2022 ${daysLeft} days left` : 'Job Prep Planner'
            }</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(236,72,153,0.08))', border: '1px solid rgba(245,158,11,0.25)', padding: '6px 14px', borderRadius: 100, color: '#F59E0B', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔥 {store.streak}
            </div>
          </div>
        </header>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gap: 20 }}>

            {/* Greeting Banner */}
            <div style={{marginBottom:4}}>
              <h2 style={{fontSize:'1.6rem',fontWeight:800,letterSpacing:'-0.02em',marginBottom:6}}>
                {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'} — let's get you ready for <span style={{background:'linear-gradient(90deg,var(--color-teal-light),#EC4899)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{store.onboarding.role}</span> at <span style={{color:'#10B981'}}>{store.onboarding.company}</span>
              </h2>
              <p style={{color:'#64748B',fontSize:'0.88rem'}}>{todayTasks.length} task{todayTasks.length!==1?'s':''} on your plate today.</p>
            </div>

            <div className="jp-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <div style={{background:'linear-gradient(135deg,var(--color-teal-light),var(--color-teal))',borderRadius:16,padding:'22px 24px',position:'relative',overflow:'hidden',boxShadow:'0 8px 32px rgba(var(--color-teal-light-rgb),0.25)'}}>
                <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.08)',transform:'translate(20px,-20px)'}}/>
                <div style={{position:'absolute',bottom:-20,left:-20,width:60,height:60,borderRadius:'50%',background:'rgba(236,72,153,0.15)'}}/>
                <div style={{fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(255,255,255,0.7)',marginBottom:8}}>Overall</div>
                <div style={{fontSize:'2rem',fontWeight:900,color:'white'}}>{readiness}%</div>
              </div>
              <div className="jp-stat-card">
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'#10B981',borderRadius:'20px 20px 0 0'}}/>
                <div style={{fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#64748B',marginBottom:8}}>DSA Solved</div>
                <div style={{fontSize:'2rem',fontWeight:900,color:'#E2E8F0'}}>{store.dsaCount}</div>
              </div>
              <div className="jp-stat-card">
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'var(--color-teal-light)',borderRadius:'20px 20px 0 0'}}/>
                <div style={{fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#64748B',marginBottom:8}}>Projects Done</div>
                <div style={{fontSize:'2rem',fontWeight:900,color:'#E2E8F0'}}>{projectDoneCount}</div>
              </div>
              <div className="jp-stat-card">
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'#F59E0B',borderRadius:'20px 20px 0 0'}}/>
                <div style={{fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#64748B',marginBottom:8}}>Days to Deadline</div>
                <div style={{fontSize:'2rem',fontWeight:900,color:'#E2E8F0'}}>{daysLeft}</div>
              </div>
            </div>

            {/* Today's Tasks + Tip of the Day */}
            <div className="jp-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div className="jp-card">
                <h3 style={{fontSize:'1.1rem',fontWeight:700,marginBottom:16}}>Today's tasks</h3>
                {todayTasks.length === 0 ? (
                  <div style={{textAlign:'center',padding:'40px 20px',color:'#475569'}}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5" style={{display:'block',margin:'0 auto 12px'}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    No tasks yet. <button onClick={() => setActiveTab('planner')} style={{background:'none',border:'none',color:'#3B82F6',cursor:'pointer',fontWeight:600}}>Open planner â†’</button>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {todayTasks.map(task => (
                      <div key={task.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:task.status==='done'?'rgba(16,185,129,0.04)':'rgba(255,255,255,0.02)',borderRadius:12,border:`1px solid ${task.status==='done'?'rgba(16,185,129,0.1)':'rgba(255,255,255,0.05)'}`,transition:'all 0.2s'}}>
                        <input type="checkbox" checked={task.status === 'done'} onChange={(e) => {
                          updateStore(s => ({...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: e.target.checked ? 'done' : 'todo' } : t)}));
                        }} style={{width:18,height:18,cursor:'pointer',accentColor:'#10B981',flexShrink:0}} />
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:'0.92rem',textDecoration:task.status==='done'?'line-through':'none',color:task.status==='done'?'#64748B':'#E2E8F0'}}>{task.name}</div>
                        </div>
                        <span className="jp-badge" style={{background:`${TRACK_COLORS[task.track]||'#3B82F6'}18`,color:TRACK_COLORS[task.track]||'#3B82F6',border:`1px solid ${TRACK_COLORS[task.track]||'#3B82F6'}30`}}>{task.track}</span>
                        <span style={{fontSize:'0.78rem',color:'#475569',fontWeight:600,whiteSpace:'nowrap'}}>{task.duration}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="jp-card" style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <span style={{fontSize:'1.2rem'}}>💡</span>
                  <h3 style={{fontSize:'1.05rem',fontWeight:700}}>Tip of the day</h3>
                </div>
                <p style={{color:'#94A3B8',fontSize:'0.88rem',lineHeight:1.6}}>
                  {['Be able to explain every line on your resume.','Practice mock interviews with a friend weekly.','Solve at least 2 DSA problems daily for consistency.','Build projects that solve real problems, not just tutorials.','Research the company culture before every interview.','Focus on understanding patterns, not memorizing solutions.','Write clean code in interviews - variable names matter.'][new Date().getDay()]}
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="jp-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
              <div className="jp-card">
                <div className="jp-section-title" style={{marginBottom:16,fontSize:'0.95rem'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Weekly Tasks</div>
                {(() => {
                  const now = new Date(); const dayOfWeek = now.getDay();
                  const monday = new Date(now); monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                  const days = Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
                  const dayLabels = ['M','T','W','T','F','S','S'];
                  const barData = days.map(d => { const ds = localDateString(d); return store.tasks.filter(t => t.date === ds && t.status === 'done').length; });
                  const maxVal = Math.max(...barData, 1);
                  const chartH = 90; const barW = 22; const gap = 10; const totalW = 7 * barW + 6 * gap;
                  return (
                    <svg width="100%" viewBox={`-2 -8 ${totalW + 4} ${chartH + 26}`} style={{overflow:'visible'}}>
                      {barData.map((val, i) => { const h = Math.max(3, (val / maxVal) * chartH); const x = i * (barW + gap); const isToday = i === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                        return (<g key={i}><rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill={isToday ? '#3B82F6' : 'rgba(59,130,246,0.25)'} />{val > 0 && <text x={x + barW/2} y={chartH - h - 4} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="700">{val}</text>}<text x={x + barW/2} y={chartH + 14} textAnchor="middle" fontSize="9" fill={isToday ? '#3B82F6' : '#475569'} fontWeight={isToday ? '800' : '600'}>{dayLabels[i]}</text></g>);
                      })}
                    </svg>
                  );
                })()}
              </div>
              <div className="jp-card">
                <div className="jp-section-title" style={{marginBottom:16,fontSize:'0.95rem'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Monthly Tasks</div>
                {(() => {
                  const now = new Date(); const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  const monthData = Array.from({length: daysInMonth}, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), i + 1); return store.tasks.filter(t => t.date === localDateString(d) && t.status === 'done').length; });
                  const maxT = Math.max(...monthData, 1); const chartW = 220; const chartH = 80; const stepX = chartW / (daysInMonth - 1);
                  const points = monthData.map((v, i) => `${i * stepX},${chartH - (v / maxT) * chartH}`).join(' ');
                  return (
                    <svg width="100%" viewBox={`-2 -8 ${chartW + 4} ${chartH + 22}`} style={{overflow:'visible'}}>
                      <defs><linearGradient id="ag4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.2"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
                      <polygon points={`0,${chartH} ${points} ${(daysInMonth-1)*stepX},${chartH}`} fill="url(#ag4)"/>
                      <polyline points={points} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      {monthData.map((v, i) => v > 0 ? <circle key={i} cx={i * stepX} cy={chartH - (v / maxT) * chartH} r="2" fill="#10B981" stroke="#0A0F24" strokeWidth="1.5"/> : null)}
                      {[1, Math.ceil(daysInMonth/2), daysInMonth].map(d => <text key={d} x={(d-1) * stepX} y={chartH + 13} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">{d}</text>)}
                    </svg>
                  );
                })()}
              </div>
              <div className="jp-card">
                <div className="jp-section-title" style={{marginBottom:16,fontSize:'0.95rem'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Heatmap</div>
                {(() => {
                  const today = new Date(); const cells: { date: string; count: number; col: number; row: number }[] = [];
                  for (let i = 89; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); const ds = localDateString(d); cells.push({ date: ds, count: store.tasks.filter(t => t.date === ds && t.status === 'done').length, col: Math.floor((89 - i) / 7), row: d.getDay() === 0 ? 6 : d.getDay() - 1 }); }
                  const cellSize = 10; const gapC = 2; const cols = Math.ceil(90 / 7) + 1;
                  return (
                    <div>
                      <div style={{overflowX:'auto'}}>
                        <svg width={cols * (cellSize + gapC)} height={7 * (cellSize + gapC)}>
                          {cells.map((c, i) => { const intensity = c.count === 0 ? 0 : Math.min(c.count / 3, 1); const color = c.count === 0 ? 'rgba(255,255,255,0.04)' : intensity < 0.33 ? '#0D3B23' : intensity < 0.66 ? '#166534' : '#22C55E';
                            return <rect key={i} x={c.col * (cellSize + gapC)} y={c.row * (cellSize + gapC)} width={cellSize} height={cellSize} rx={2} fill={color}><title>{c.date}: {c.count}</title></rect>;
                          })}
                        </svg>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:5,justifyContent:'flex-end',marginTop:6}}>
                        <span style={{fontSize:'0.58rem',color:'#475569'}}>Less</span>
                        {['rgba(255,255,255,0.04)','#0D3B23','#166534','#22C55E'].map((c,i)=><div key={i} style={{width:8,height:8,borderRadius:2,background:c}}/>)}
                        <span style={{fontSize:'0.58rem',color:'#475569'}}>More</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Per-track Progress */}
            <div className="jp-card">
              <h3 style={{fontSize:'1.1rem',fontWeight:700,marginBottom:18}}>Per-track progress</h3>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {store.onboarding.tracks.map(track => {
                  const trackTasks = store.tasks.filter(t => t.track === track);
                  const dc = trackTasks.filter(t => t.status === 'done').length;
                  const pct = trackTasks.length > 0 ? Math.round((dc / trackTasks.length) * 100) : 0;
                  return (
                    <div key={track}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',marginBottom:6}}>
                        <span style={{fontWeight:600,display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:TRACK_COLORS[track]||'#3B82F6',display:'inline-block'}}/>{track}</span>
                        <span style={{color:'#64748B',fontWeight:600,fontSize:'0.78rem'}}>{dc}/{trackTasks.length} â€¢ {pct}%</span>
                      </div>
                      <div style={{height:6,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:TRACK_COLORS[track]||'#3B82F6',borderRadius:3,transition:'width 0.5s ease'}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* --- Study Planner Tab --- */}
        {activeTab === 'planner' && <WeeklyPlanner store={store} updateStore={updateStore} />}

        {/* --- Interview Tab --- */}
        {activeTab === 'interview' && (
          <div className="jp-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div className="jp-card">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20 }}>Interview Questions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {store.questions.map(q => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <input type="checkbox" checked={q.practiced} onChange={(e) => {
                      updateStore(s => ({
                        ...s,
                        questions: s.questions.map(x => x.id === q.id ? { ...x, practiced: e.target.checked } : x)
                      }));
                    }} style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#3B82F6' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: q.practiced ? '#94A3B8' : '#E2E8F0', textDecoration: q.practiced ? 'line-through' : 'none' }}>{q.text}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <span className="jp-badge" style={{ background: q.difficulty === 'Easy' ? 'rgba(16,185,129,0.1)' : q.difficulty === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: q.difficulty === 'Easy' ? '#10B981' : q.difficulty === 'Medium' ? '#F59E0B' : '#EF4444' }}>{q.difficulty}</span>
                        <span className="jp-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>{q.category.toUpperCase()}</span>
                        {q.track && <span className="jp-badge" style={{ background: 'rgba(255,255,255,0.05)', color: TRACK_COLORS[q.track] || '#94A3B8' }}>{q.track}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="jp-card">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20 }}>Add Question</h2>
              <form onSubmit={(e) => {
                 e.preventDefault();
                 const fd = new FormData(e.currentTarget);
                 updateStore(s => ({
                   ...s,
                   questions: [...s.questions, {
                     id: UID(),
                     text: fd.get('text') as string,
                     category: fd.get('category') as any,
                     difficulty: fd.get('difficulty') as string,
                     track: fd.get('track') as string || undefined,
                     practiced: false
                   }]
                 }));
                 e.currentTarget.reset();
              }} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                <textarea name="text" placeholder="Question text" required className="jp-input" rows={3} />
                <select name="category" required className="jp-input">
                  <option value="technical">Technical</option>
                  <option value="hr">HR / Behavioral</option>
                  <option value="company">Company Specific</option>
                </select>
                <select name="difficulty" required className="jp-input">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select name="track" className="jp-input">
                  <option value="">No specific track</option>
                  {store.onboarding.tracks.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="submit" className="jp-btn">Add Question</button>
              </form>
            </div>
          </div>
        )}

        {/* --- Projects Tab --- */}
        {activeTab === 'projects' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div className="jp-section-title"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-light)" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> Your Projects</div>
              <button className="jp-btn" onClick={()=>setShowAddProject(true)}>+ Add Project</button>
            </div>
            {store.projects.length===0 ? (
              <div className="jp-card" style={{textAlign:'center',padding:'60px 24px'}}>
                <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(var(--color-teal-light-rgb),0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-light)" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>
                <p style={{color:'#94A3B8',fontSize:'0.95rem'}}>No projects yet. Start building your portfolio!</p>
              </div>
            ) : (
              <div className="jp-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
                {store.projects.map(p=>{
                  const statusColor = p.status==='Done'?'#10B981':p.status==='In Progress'?'#F59E0B':'#64748B';
                  return (
                    <div key={p.id} className="jp-card" style={{position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:statusColor}}/>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <h3 style={{fontWeight:700,fontSize:'1.05rem'}}>{p.name}</h3>
                        <select value={p.status} onChange={e=>updateStore(s=>({...s,projects:s.projects.map(x=>x.id===p.id?{...x,status:e.target.value as any}:x)}))} style={{background:'transparent',border:`1px solid ${statusColor}40`,borderRadius:8,color:statusColor,padding:'4px 8px',fontSize:'0.72rem',fontWeight:700,cursor:'pointer',outline:'none'}}>
                          <option value="Not Started">Not Started</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                        </select>
                      </div>
                      {p.description && <p style={{color:'#94A3B8',fontSize:'0.82rem',marginBottom:12,lineHeight:1.5}}>{p.description}</p>}
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                        {p.tags.map((tag,i)=><span key={i} className="jp-badge" style={{background:'rgba(var(--color-teal-light-rgb),0.1)',color:'#A78BFA',border:'1px solid rgba(var(--color-teal-light-rgb),0.2)'}}>{tag}</span>)}
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <span className="jp-badge" style={{background:p.complexity==='Easy'?'rgba(16,185,129,0.1)':p.complexity==='Medium'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)',color:p.complexity==='Easy'?'#10B981':p.complexity==='Medium'?'#F59E0B':'#EF4444'}}>{p.complexity}</span>
                        <button onClick={()=>updateStore(s=>({...s,projects:s.projects.filter(x=>x.id!==p.id)}))} style={{marginLeft:'auto',background:'none',border:'none',color:'#64748B',cursor:'pointer',fontSize:'0.75rem'}}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- Resources Tab --- */}
        {activeTab === 'resources' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div className="jp-section-title"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Learning Resources</div>
              <button className="jp-btn" onClick={()=>setShowAddResource(true)}>+ Add Resource</button>
            </div>
            <div className="jp-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
              {store.resources.map(r=>{
                const typeColors:Record<string,string> = {Video:'#EF4444',Article:'#3B82F6',Course:'var(--color-teal-light)',Tool:'#10B981'};
                return (
                  <div key={r.id} className="jp-card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:6}}>{r.title}</div>
                      <div style={{display:'flex',gap:6}}>
                        <span className="jp-badge" style={{background:`${typeColors[r.type]||'#3B82F6'}18`,color:typeColors[r.type]||'#3B82F6'}}>{r.type}</span>
                        <span className="jp-badge" style={{background:'rgba(255,255,255,0.05)',color:TRACK_COLORS[r.track]||'#94A3B8'}}>{r.track}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button onClick={()=>updateStore(s=>({...s,resources:s.resources.map(x=>x.id===r.id?{...x,bookmarked:!x.bookmarked}:x)}))} style={{background:'none',border:'none',cursor:'pointer',color:r.bookmarked?'#F59E0B':'#475569',fontSize:'1.2rem'}}>{r.bookmarked?'★':'☆'}</button>
                      <a href={r.link} target="_blank" rel="noopener noreferrer" style={{color:'#3B82F6',fontSize:'0.82rem',fontWeight:600,textDecoration:'none'}}>Open â†’</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Progress Tab --- */}
        {activeTab === 'progress' && (
          <div style={{display:'grid',gap:24}}>
            {/* Readiness Ring */}
            <div className="jp-card" style={{textAlign:'center',padding:'40px 24px'}}>
              <div style={{position:'relative',width:160,height:160,margin:'0 auto 24px'}}>
                <svg width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12"/><circle cx="80" cy="80" r="70" fill="none" stroke="url(#jpGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${readiness*4.4} 440`} transform="rotate(-90 80 80)" style={{transition:'stroke-dasharray 0.6s ease'}}/><defs><linearGradient id="jpGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#10B981"/></linearGradient></defs></svg>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:'2.5rem',fontWeight:900,background:'linear-gradient(135deg,#3B82F6,#10B981)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{readiness}%</div>
                  <div style={{fontSize:'0.75rem',color:'#94A3B8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em'}}>Ready</div>
                </div>
              </div>
              <h2 style={{fontWeight:800,fontSize:'1.3rem',marginBottom:6}}>{readiness<30?'Just Getting Started':readiness<60?'Making Progress':readiness<80?'Almost There':'Interview Ready!'}</h2>
              <p style={{color:'#94A3B8',fontSize:'0.88rem'}}>Keep pushing â€” consistency beats talent.</p>
            </div>
            {/* Track Breakdown */}
            <div className="jp-card">
              <div className="jp-section-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Track Breakdown</div>
              <div style={{display:'grid',gap:16}}>
                {store.onboarding!.tracks.map(track=>{
                  const tt=store.tasks.filter(t=>t.track===track); const d=tt.filter(t=>t.status==='done').length; const p=tt.length>0?Math.round((d/tt.length)*100):0;
                  return <div key={track}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',marginBottom:8}}><span style={{fontWeight:600,display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:TRACK_COLORS[track]||'#3B82F6',display:'inline-block'}}/>{track}</span><span style={{color:'#94A3B8',fontWeight:700}}>{p}%</span></div><div style={{height:8,background:'rgba(255,255,255,0.06)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${p}%`,background:`linear-gradient(90deg,${TRACK_COLORS[track]||'#3B82F6'},${TRACK_COLORS[track]||'#3B82F6'}88)`,borderRadius:4,transition:'width 0.5s ease'}}/></div></div>;
                })}
              </div>
            </div>
            {/* Quick Stats */}
            <div className="jp-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
              <div className="jp-card" style={{textAlign:'center'}}><div style={{fontSize:'2rem',fontWeight:900,color:'#3B82F6'}}>{store.dsaCount}</div><div style={{color:'#94A3B8',fontSize:'0.8rem',fontWeight:600}}>DSA Problems Solved</div><input type="number" value={store.dsaCount} onChange={e=>updateStore(s=>({...s,dsaCount:Number(e.target.value)}))} className="jp-input" style={{marginTop:12,textAlign:'center',maxWidth:120,margin:'12px auto 0'}}/></div>
              <div className="jp-card" style={{textAlign:'center'}}><div style={{fontSize:'2rem',fontWeight:900,color:'#10B981'}}>{store.tasks.filter(t=>t.status==='done').length}</div><div style={{color:'#94A3B8',fontSize:'0.8rem',fontWeight:600}}>Tasks Completed</div></div>
              <div className="jp-card" style={{textAlign:'center'}}><div style={{fontSize:'2rem',fontWeight:900,color:'#F59E0B'}}>{store.questions.filter(q=>q.practiced).length}</div><div style={{color:'#94A3B8',fontSize:'0.8rem',fontWeight:600}}>Questions Practiced</div></div>
            </div>
          </div>
        )}

      </main>

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="jp-modal-overlay" onClick={()=>setShowAddProject(false)}>
          <div className="jp-modal" style={{'--modal-accent':'linear-gradient(90deg,var(--color-teal-light),#A78BFA)'} as any} onClick={e=>e.stopPropagation()}>
            <h3>Add New Project</h3>
            <form onSubmit={e=>{
              e.preventDefault();
              const fd=new FormData(e.currentTarget);
              const name=fd.get('name') as string; if(!name.trim()) return;
              updateStore(s=>({...s,projects:[...s.projects,{id:UID(),name,description:fd.get('desc') as string,tags:(fd.get('tags') as string).split(',').map(t=>t.trim()).filter(Boolean),github:fd.get('github') as string,demo:fd.get('demo') as string,status:'Not Started',complexity:fd.get('complexity') as any}]}));
              setShowAddProject(false);
            }} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Project Name *</label>
                <input name="name" required placeholder="e.g. Portfolio Website" className="jp-input" />
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Description</label>
                <textarea name="desc" placeholder="Short description of the project..." className="jp-input" rows={2} />
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Tech Stack (comma separated)</label>
                <input name="tags" placeholder="e.g. React, Node.js, MongoDB" className="jp-input" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>GitHub Link</label>
                  <input name="github" placeholder="https://github.com/..." className="jp-input" />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Complexity</label>
                  <select name="complexity" className="jp-input"><option value="Easy">Easy</option><option value="Medium" selected>Medium</option><option value="Hard">Hard</option></select>
                </div>
              </div>
              <input name="demo" type="hidden" value="" />
              <div style={{display:'flex',gap:12,marginTop:8}}>
                <button type="submit" className="jp-btn" style={{flex:1,background:'linear-gradient(135deg,var(--color-teal-light),#7C3AED)'}}>Create Project</button>
                <button type="button" onClick={()=>setShowAddProject(false)} style={{padding:'12px 20px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#94A3B8',cursor:'pointer',fontWeight:600,fontSize:'0.88rem'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {showAddResource && (
        <div className="jp-modal-overlay" onClick={()=>setShowAddResource(false)}>
          <div className="jp-modal" style={{'--modal-accent':'linear-gradient(90deg,#14B8A6,#10B981)'} as any} onClick={e=>e.stopPropagation()}>
            <h3>Add Resource</h3>
            <form onSubmit={e=>{
              e.preventDefault();
              const fd=new FormData(e.currentTarget);
              const title=fd.get('title') as string; if(!title.trim()) return;
              updateStore(s=>({...s,resources:[...s.resources,{id:UID(),title,link:fd.get('link') as string||'#',type:fd.get('type') as any,track:fd.get('track') as string,bookmarked:false}]}));
              setShowAddResource(false);
            }} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Resource Title *</label>
                <input name="title" required placeholder="e.g. NeetCode 150" className="jp-input" />
              </div>
              <div>
                <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>URL</label>
                <input name="link" placeholder="https://..." className="jp-input" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Type</label>
                  <select name="type" className="jp-input"><option value="Article">Article</option><option value="Video">Video</option><option value="Course">Course</option><option value="Tool">Tool</option></select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.78rem',color:'#94A3B8',fontWeight:600,marginBottom:6}}>Track</label>
                  <select name="track" className="jp-input">{store.onboarding!.tracks.map(t=><option key={t} value={t}>{t}</option>)}</select>
                </div>
              </div>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                <button type="submit" className="jp-btn" style={{flex:1,background:'linear-gradient(135deg,#14B8A6,#0D9488)'}}>Add Resource</button>
                <button type="button" onClick={()=>setShowAddResource(false)} style={{padding:'12px 20px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#94A3B8',cursor:'pointer',fontWeight:600,fontSize:'0.88rem'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Components
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <div className={`jp-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: React.ReactNode; color: string; icon?: React.ReactNode }) {
  return (
    <div className="jp-stat-card" style={{ padding: '24px' }}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${color},${color}66)`}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        {icon && <div style={{color,opacity:0.7}}>{icon}</div>}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function WeeklyPlanner({ store, updateStore }: { store: Store; updateStore: (fn: (s: Store) => Store) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [addingDay, setAddingDay] = useState<string | null>(null);

  // Get week days (Mon-Sun) for current offset
  const getWeekDays = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = TODAY();

  // Weekly stats
  const weekTasks = store.tasks.filter(t => {
    const startStr = localDateString(weekDays[0]);
    const endStr = localDateString(weekDays[6]);
    return t.date >= startStr && t.date <= endStr;
  });
  const plannedMins = weekTasks.reduce((a, t) => a + t.duration, 0);
  const doneMins = weekTasks.filter(t => t.status === 'done').reduce((a, t) => a + t.duration, 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Week Header */}
      <div className="jp-card" style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', transition: 'all 0.2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>
                {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} â€” {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} weeks ${weekOffset > 0 ? 'ahead' : 'ago'}`}
              </div>
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', transition: 'all 0.2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#3B82F6', fontWeight: 700, fontSize: '0.78rem' }}>Today</button>}
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Planned</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#94A3B8' }}>{(plannedMins / 60).toFixed(1)}h</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Done</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>{(doneMins / 60).toFixed(1)}h</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tasks</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3B82F6' }}>{weekTasks.filter(t => t.status === 'done').length}/{weekTasks.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Day Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
        {weekDays.map((day, i) => {
          const dateStr = localDateString(day);
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayTasks = store.tasks.filter(t => t.date === dateStr);
          const doneCount = dayTasks.filter(t => t.status === 'done').length;

          return (
            <div key={dateStr} style={{
              background: isToday ? 'rgba(59,130,246,0.06)' : 'rgba(10,15,36,0.6)',
              border: `1px solid ${isToday ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 16,
              padding: 14,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s',
              opacity: isPast ? 0.6 : 1
            }}>
              {/* Day Header */}
              <div style={{ textAlign: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: isToday ? '#3B82F6' : '#64748B' }}>{dayNames[i]}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: isToday ? '#3B82F6' : '#CBD5E1', marginTop: 2 }}>{day.getDate()}</div>
                {dayTasks.length > 0 && <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 4 }}>{doneCount}/{dayTasks.length} done</div>}
              </div>

              {/* Tasks */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayTasks.map(task => (
                  <div key={task.id} style={{
                    padding: '8px 10px',
                    background: task.status === 'done' ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${task.status === 'done' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: 10,
                    borderLeft: `3px solid ${TRACK_COLORS[task.track] || '#3B82F6'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <input type="checkbox" checked={task.status === 'done'} onChange={e => updateStore(s => ({ ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: e.target.checked ? 'done' : 'todo' } : t) }))} style={{ marginTop: 2, accentColor: '#10B981', cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: task.status === 'done' ? '#64748B' : '#E2E8F0', textDecoration: task.status === 'done' ? 'line-through' : 'none', lineHeight: 1.3, wordBreak: 'break-word' }}>{task.name}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.6rem', color: TRACK_COLORS[task.track] || '#94A3B8', fontWeight: 600 }}>{task.duration}m</span>
                          {task.priority === 'high' && <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: 100, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 700 }}>!</span>}
                        </div>
                      </div>
                      <button onClick={() => updateStore(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== task.id) }))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, fontSize: '0.7rem', flexShrink: 0 }}>&times;</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Task Button / Form */}
              {addingDay === dateStr ? (
                <form onSubmit={e => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const name = fd.get('name') as string;
                  if (!name.trim()) return;
                  updateStore(s => ({
                    ...s,
                    tasks: [...s.tasks, {
                      id: UID(), name, track: fd.get('track') as string,
                      date: dateStr, duration: Number(fd.get('dur') || 30),
                      priority: (fd.get('pri') || 'medium') as any, status: 'todo'
                    }]
                  }));
                  e.currentTarget.reset();
                  setAddingDay(null);
                }} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input name="name" placeholder="Task name..." autoFocus className="jp-input" style={{ padding: '7px 10px', fontSize: '0.78rem', borderRadius: 8 }} />
                  <select name="track" className="jp-input" style={{ padding: '6px 8px', fontSize: '0.72rem', borderRadius: 8 }}>
                    {store.onboarding!.tracks.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input name="dur" type="number" placeholder="min" defaultValue={30} className="jp-input" style={{ padding: '6px 8px', fontSize: '0.72rem', borderRadius: 8, width: '50%' }} />
                    <select name="pri" className="jp-input" style={{ padding: '6px 8px', fontSize: '0.72rem', borderRadius: 8, width: '50%' }}>
                      <option value="medium">Med</option><option value="high">High</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="submit" style={{ flex: 1, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                    <button type="button" onClick={() => setAddingDay(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', fontSize: '0.72rem', cursor: 'pointer' }}>&times;</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingDay(dateStr)} style={{ marginTop: 8, background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px', cursor: 'pointer', color: '#475569', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Onboarding({ onComplete, onCancel }: { onComplete: (data: OnboardingData) => void, onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<OnboardingData>>({ tracks: [], dailyHours: 4 });

  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  return (
    <div style={{ minHeight: '100vh', background: '#060A17', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font)' }}>
      <div className="jp-card" style={{ maxWidth: 600, width: '100%' }}>
        
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ flex: 1, height: 4, background: i <= step ? '#3B82F6' : 'rgba(255,255,255,0.1)', borderRadius: 2 }} />)}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E2E8F0', marginBottom: 24 }}>What is your primary goal?</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {['Campus Placements', 'Off-campus Jobs', 'Switching Jobs', 'Internships'].map(g => (
                <button key={g} onClick={() => { setData(p => ({...p, goal: g})); next(); }} 
                  style={{ padding: 20, textAlign: 'left', background: data.goal === g ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${data.goal === g ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, color: '#E2E8F0', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>Select your focus tracks</h2>
            <p style={{ color: '#94A3B8', marginBottom: 24 }}>Choose the areas you need to prepare for.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Object.keys(TRACK_COLORS).map(t => {
                const sel = data.tracks?.includes(t);
                return (
                  <button key={t} onClick={() => {
                    setData(p => {
                      const tr = p.tracks || [];
                      return { ...p, tracks: sel ? tr.filter(x => x !== t) : [...tr, t] };
                    });
                  }} style={{ padding: '10px 16px', borderRadius: 100, border: `1px solid ${sel ? TRACK_COLORS[t] : 'rgba(255,255,255,0.1)'}`, background: sel ? `${TRACK_COLORS[t]}22` : 'transparent', color: sel ? TRACK_COLORS[t] : '#94A3B8', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
                    {t}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prev} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>Back</button>
              <button onClick={next} disabled={!data.tracks?.length} className="jp-btn">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
           <div>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E2E8F0', marginBottom: 24 }}>Set your targets</h2>
             <div style={{ display: 'grid', gap: 16 }}>
               <div>
                 <label style={{ display: 'block', marginBottom: 8, color: '#94A3B8', fontSize: '0.9rem' }}>Dream Company / Role</label>
                 <div style={{ display: 'flex', gap: 12 }}>
                   <input placeholder="e.g. Google" value={data.company || ''} onChange={e => setData(p => ({...p, company: e.target.value}))} className="jp-input" />
                   <input placeholder="e.g. SDE" value={data.role || ''} onChange={e => setData(p => ({...p, role: e.target.value}))} className="jp-input" />
                 </div>
               </div>
               <div>
                 <label style={{ display: 'block', marginBottom: 8, color: '#94A3B8', fontSize: '0.9rem' }}>Target Date (approximate)</label>
                 <input type="date" value={data.deadline || ''} onChange={e => setData(p => ({...p, deadline: e.target.value}))} className="jp-input" />
               </div>
             </div>
             <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prev} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>Back</button>
              <button onClick={next} disabled={!data.company || !data.deadline} className="jp-btn">Continue</button>
            </div>
           </div>
        )}

        {step === 4 && (
           <div>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E2E8F0', marginBottom: 24 }}>Daily Commitment</h2>
             <div style={{ textAlign: 'center', marginBottom: 32 }}>
               <div style={{ fontSize: '4rem', fontWeight: 900, color: '#3B82F6' }}>{data.dailyHours}</div>
               <div style={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Hours per day</div>
             </div>
             <input type="range" min="1" max="12" value={data.dailyHours} onChange={e => setData(p => ({...p, dailyHours: Number(e.target.value)}))} style={{ width: '100%', accentColor: '#3B82F6' }} />
             
             <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prev} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>Back</button>
              <button onClick={next} className="jp-btn">Review</button>
            </div>
           </div>
        )}

        {step === 5 && (
           <div style={{ textAlign: 'center' }}>
             <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
             </div>
             <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#E2E8F0', marginBottom: 12 }}>You're all set!</h2>
             <p style={{ color: '#94A3B8', marginBottom: 32 }}>Your job prep command center is ready.</p>
             <button onClick={() => onComplete(data as OnboardingData)} className="jp-btn" style={{ width: '100%', fontSize: '1.1rem', padding: 16 }}>Enter Dashboard â†’</button>
             <button onClick={prev} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', marginTop: 16 }}>Wait, go back</button>
           </div>
        )}
        
      </div>
      {step === 1 && <button onClick={onCancel} style={{ position: 'absolute', top: 24, left: 24, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>â† Back to Chooser</button>}
    </div>
  );
}

