"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadHabits, saveHabits } from "@/lib/habitsDb";

// ─── Types ────────────────────────────────────────────────────────────────────
type Habit    = { id: string; label: string; done: boolean };
type Category = { id: string; name: string; icon: string; collapsed: boolean; habits: Habit[] };
type DayEntry = { dayName: string; date: Date; dateStr: string; categories: Category[] };

const ICON_OPTIONS: { key: string; node: React.ReactNode }[] = [
  { key:"rich",        node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9.5 9.5C9.5 8.12 10.62 7 12 7s2.5 1.12 2.5 2.5c0 1.5-1.5 2-2.5 2.5-1 .5-2.5 1-2.5 2.5C9.5 15.88 10.62 17 12 17s2.5-1.12 2.5-2.5"/></svg> },
  { key:"muscular",    node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 0 0 5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 1 0 5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> },
  { key:"intelligent", node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { key:"career",      node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { key:"spiritual",   node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v8M8 12h8"/></svg> },
  { key:"heart",       node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { key:"star",        node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { key:"target",      node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
  { key:"lightning",   node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { key:"globe",       node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { key:"default",     node:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
];
const ALL_ICONS: Record<string,React.ReactNode> = Object.fromEntries(ICON_OPTIONS.map(o=>[o.key,o.node]));

// DAY_META now returns theme-aware CSS variable references for bg
const DAY_META: Record<string, { dotDark: string; dotLight: string }> = {
  Monday:    { dotDark: "#C36BFF", dotLight: "#111111" },
  Tuesday:   { dotDark: "#9e7dff", dotLight: "#111111" },
  Wednesday: { dotDark: "#4A90FF", dotLight: "#111111" },
  Thursday:  { dotDark: "#28D7FF", dotLight: "#111111" },
  Friday:    { dotDark: "#C36BFF", dotLight: "#111111" },
  Saturday:  { dotDark: "#28D7FF", dotLight: "#111111" },
  Sunday:    { dotDark: "#9e7dff", dotLight: "#111111" },
};
const DAY_BG_DARK: Record<string,string> = {
  Monday: "#1e1040", Tuesday: "#0e1a40", Wednesday: "#0a1e3a",
  Thursday: "#0d1e44", Friday: "#1a0e40", Saturday: "#22083a", Sunday: "#180840",
};
const DAY_BG_LIGHT: Record<string,string> = {
  Monday: "#f7f7f7", Tuesday: "#f7f7f7", Wednesday: "#f7f7f7",
  Thursday: "#f7f7f7", Friday: "#f7f7f7", Saturday: "#f7f7f7", Sunday: "#f7f7f7",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS  = [2026, 2027, 2028];

// ─── Winter Arc ───────────────────────────────────────────────────────────────
const WINTER_ARC_START = new Date(2026, 8, 1); // Sep 1, 2026
const getWinterArcDay = (date: Date): number | null => {
  const start = new Date(WINTER_ARC_START);
  start.setHours(0,0,0,0);
  const d = new Date(date);
  d.setHours(0,0,0,0);
  if (d < start) return null;
  const diff = Math.floor((d.getTime() - start.getTime()) / (1000*60*60*24));
  return diff + 1;
};

const WINTER_ARC_RULES = [
  { icon: "🌅", rule: "Wake up before 6 AM" },
  { icon: "🏋️", rule: "Gym 5x a week" },
  { icon: "🚀", rule: "Daily min. 1 hour new skill" },
  { icon: "🎯", rule: "Min 6 hr working in silence to your focused goal" },
  { icon: "🚫", rule: "No junk food" },
  { icon: "📖", rule: "Read any book daily" },
  { icon: "🧘", rule: "Meditation" },
  { icon: "💧", rule: "Drink at least 3-4 litres of water" },
  { icon: "📵", rule: "Less usage of social media" },
  { icon: "📝", rule: "Track habits daily" },
];

const WINTER_ARC_HABITS = [
  "Wake up before 6 AM",
  "Gym",
  "Daily 1 hr new skill",
  "Min 6 hr to your focused goal",
  "Read book daily",
  "Meditation",
  "No junk",
  "Drink at least 4 litres of water",
  "Less usage of mobile (less than 2 hours)",
];

const WINTER_ARC_CAT = (ds: string): Category => ({
  id: `${ds}-winterarc`,
  icon: "star",
  name: "❄️ WINTER ARC CHALLENGE",
  collapsed: false,
  habits: WINTER_ARC_HABITS.map((label, i) => ({
    id: `${ds}-wa-${i}`,
    label,
    done: false,
  })),
});

const JS_DAY_TO_NAME = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const STORAGE_KEY = "lifestack-habits-v2";

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function getWeeksInMonth(year: number, monthIdx: number): Date[][] {
  const weeks: Date[][] = [];
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay  = new Date(year, monthIdx + 1, 0);
  let cursor = new Date(firstDay), week: Date[] = [];
  while (cursor <= lastDay) {
    week.push(new Date(cursor));
    if (cursor.getDay() === 0) { weeks.push(week); week = []; }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

function getWeekIndexForDate(weeks: Date[][], target: Date): number {
  const targetDateKey = dateKey(target);
  const idx = weeks.findIndex((week) => week.some((d) => dateKey(d) === targetDateKey));
  return idx >= 0 ? idx : 0;
}

const getCatIconKey = (id: string) => {
  if (id.includes("rich"))        return "rich";
  if (id.includes("muscular"))    return "muscular";
  if (id.includes("intelligent")) return "intelligent";
  return "default";
};

const DEFAULT_CATS = (ds: string): Category[] => [
  { id:`${ds}-rich`,        icon:"rich",        name:"BECOME INCREDIBLY RICH",        collapsed:false, habits:[
    { id:`${ds}-rich-1`, label:"Study", done:false },
  ]},
  { id:`${ds}-muscular`,    icon:"muscular",    name:"BECOME INCREDIBLY MUSCULAR",    collapsed:false, habits:[
    { id:`${ds}-mus-1`, label:"Workout", done:false },
  ]},
  { id:`${ds}-intelligent`, icon:"intelligent", name:"BECOME INCREDIBLY INTELLIGENT", collapsed:false, habits:[
    { id:`${ds}-int-1`, label:"Book (20 min)", done:false },
  ]},
];

const uid = () => Math.random().toString(36).slice(2,9);
const pct = (cats: Category[]) => {
  const all = cats.flatMap(c => c.habits);
  return all.length ? Math.round(all.filter(h=>h.done).length/all.length*100) : 0;
};

// ─── EmojiPicker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect:(e:string)=>void; onClose:()=>void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  },[onClose]);
  return (
    <div ref={ref} style={{ position:"absolute",zIndex:200,top:"110%",left:0,background:"var(--bg-card)",border:"1px solid var(--border-act)",borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",minWidth:180 }}>
      {ICON_OPTIONS.map(opt=>(
        <button key={opt.key} onClick={()=>{ onSelect(opt.key); onClose(); }} style={{ background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:8,padding:"8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-sub)",transition:"all 0.15s",width:38,height:38 }}
          onMouseEnter={el=>{ (el.currentTarget as HTMLElement).style.background="rgba(195,107,255,0.15)"; (el.currentTarget as HTMLElement).style.color="#C36BFF"; }}
          onMouseLeave={el=>{ (el.currentTarget as HTMLElement).style.background="var(--bg-subtle)"; (el.currentTarget as HTMLElement).style.color="var(--text-sub)"; }}
        ><div style={{width:18,height:18}}>{opt.node}</div></button>
      ))}
    </div>
  );
}

// ─── CategoryBlock ────────────────────────────────────────────────────────────
function CategoryBlock({ category, onToggleHabit, onToggleCollapse, onDeleteHabit, onCheckAll, onEditCat, onDeleteCat }: {
  category: Category; onToggleHabit:(id:string)=>void; onToggleCollapse:(id:string)=>void;
  onDeleteHabit:(id:string)=>void; onCheckAll:(catId:string)=>void;
  onEditCat:(catId:string,name:string,icon:string)=>void; onDeleteCat:(catId:string)=>void;
}) {
  const [editing,setEditing]=useState(false);
  const [editName,setEditName]=useState(category.name);
  const [editIcon,setEditIcon]=useState(category.icon);
  const [showEmoji,setShowEmoji]=useState(false);
  const allDone = category.habits.length>0 && category.habits.every(h=>h.done);
  const catPct  = category.habits.length ? Math.round(category.habits.filter(h=>h.done).length/category.habits.length*100) : 0;
  const saveEdit = () => { if(editName.trim()) onEditCat(category.id,editName.trim().toUpperCase(),editIcon); setEditing(false); setShowEmoji(false); };

  return (
    <div style={{ marginBottom:10,borderRadius:8,background:"transparent",border:"1px solid var(--bg-subtle)",overflow:"visible",position:"relative",textAlign:"left" }}>
      {editing ? (
        <div style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 10px" }}>
          <div style={{ position:"relative" }}>
            <button onClick={()=>setShowEmoji(v=>!v)} style={{ background:"var(--bg-subtle)",border:"1px solid var(--bg-hover)",borderRadius:6,padding:"6px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:32,height:32,color:"var(--text-sub)" }}>
              <div style={{width:16,height:16}}>{ALL_ICONS[editIcon]??ALL_ICONS["default"]}</div>
            </button>
            {showEmoji&&<EmojiPicker onSelect={e=>setEditIcon(e)} onClose={()=>setShowEmoji(false)}/>}
          </div>
          <input value={editName} onChange={e=>setEditName(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter")saveEdit(); if(e.key==="Escape"){setEditing(false);setEditName(category.name);} }}
            autoFocus style={{ flex:1,fontFamily:"var(--font)",fontSize:"0.7rem",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",background:"var(--bg-subtle)",border:"1px solid rgba(195,107,255,0.4)",borderRadius:6,color:"var(--text)",padding:"4px 8px",outline:"none" }}
          />
          <button onClick={saveEdit} style={{ background:"rgba(74,144,255,0.15)",border:"1px solid rgba(74,144,255,0.4)",borderRadius:5,padding:"3px 10px",cursor:"pointer",fontFamily:"var(--font)",fontSize:"0.65rem",fontWeight:700,color:"#4A90FF" }}>Save</button>
          <button onClick={()=>{setEditing(false);setEditName(category.name);setShowEmoji(false);}} style={{ background:"var(--bg-subtle)",border:"1px solid var(--bg-hover)",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontFamily:"var(--font)",fontSize:"0.65rem",color:"var(--text-sub)" }}>✕</button>
        </div>
      ) : (
        <div style={{ display:"flex",alignItems:"center",padding:"6px 10px",gap:5,minWidth:0,overflow:"hidden",textAlign:"left" }}>
          <button onClick={()=>onToggleCollapse(category.id)} style={{ display:"flex",alignItems:"center",gap:5,flex:1,minWidth:0,background:"none",border:"none",cursor:"pointer",overflow:"hidden",textAlign:"left" }}>
            <div style={{ width:16,height:16,minWidth:16,flexShrink:0,color:"var(--text-sub)" }}>
              {ALL_ICONS[category.icon]??ALL_ICONS[getCatIconKey(category.id)]??ALL_ICONS["default"]}
            </div>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",color:"var(--text-sub)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{category.name}</span>
            <span style={{ fontSize:"0.5rem",flexShrink:0,transition:"transform 0.22s",transform:category.collapsed?"rotate(-90deg)":"rotate(0deg)",background:"var(--gradient)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>▼</span>
          </button>
          <span style={{ fontFamily:"var(--font)",fontSize:"0.6rem",fontWeight:600,color:catPct===100?"var(--text)":"var(--text-sub)",minWidth:26,textAlign:"right" }}>{catPct}%</span>
          <button onClick={()=>onCheckAll(category.id)} style={{ background:allDone?"var(--bg-hover)":"var(--bg-subtle)",border:`1px solid ${allDone?"var(--border-act)":"var(--bg-hover)"}`,borderRadius:5,padding:"2px 7px",cursor:"pointer",fontFamily:"var(--font)",fontSize:"0.58rem",fontWeight:600,color:allDone?"var(--text)":"var(--text-sub)",transition:"all 0.18s",whiteSpace:"nowrap" }}>{allDone?"✓ All":"All"}</button>
          <button onClick={()=>{setEditing(true);setEditName(category.name);setEditIcon(category.icon);}} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px",color:"var(--text-sub)",transition:"color 0.15s" }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="var(--text)"}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--text-sub)"}
            title="Edit category"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          <button onClick={()=>{if(window.confirm(`Delete "${category.name}"?`))onDeleteCat(category.id);}} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px",color:"var(--text-sub)",transition:"color 0.15s" }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="#ff6b6b"}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--text-sub)"}
            title="Delete category"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      )}
      <div className={`cat-items${category.collapsed?" closed":""}`} style={{ maxHeight:category.collapsed?"0px":"600px",padding:category.collapsed?"0":"0 8px 8px" }}>
        {category.habits.map(h=>(
          <div key={h.id} style={{ display:"flex",alignItems:"center",gap:7,padding:"4px 6px",borderRadius:6,marginBottom:2,background:h.done?"var(--bg-subtle)":"transparent",transition:"background 0.15s" }}
            onMouseEnter={e=>{if(!h.done)(e.currentTarget as HTMLElement).style.background="var(--bg-subtle)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=h.done?"var(--bg-subtle)":"transparent";}}
          >
            <input type="checkbox" className="habit-checkbox" checked={h.done} onChange={()=>onToggleHabit(h.id)}/>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.8rem",fontWeight:h.done?400:500,color:h.done?"var(--text-muted)":"var(--text)",textDecoration:h.done?"line-through":"none",flex:1,transition:"all 0.18s" }}>{h.label}</span>
            <button onClick={()=>onDeleteHabit(h.id)} style={{ background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:4,cursor:"pointer",color:"rgba(248,113,113,0.7)",fontSize:"0.65rem",padding:"2px 6px",transition:"all 0.15s",flexShrink:0 }}
              onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(248,113,113,0.18)"; (e.currentTarget as HTMLElement).style.color="#f87171"; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(248,113,113,0.08)"; (e.currentTarget as HTMLElement).style.color="rgba(248,113,113,0.7)"; }}
            >✕</button>
          </div>
        ))}
        {category.habits.length===0&&<p style={{ fontFamily:"var(--font)",fontSize:"0.72rem",color:"var(--text-muted)",padding:"3px 6px",fontStyle:"italic" }}>No habits yet</p>}
      </div>
    </div>
  );
}

// ─── AddRow ───────────────────────────────────────────────────────────────────
function AddRow({ categories,onAdd,onAddToWeek,onAddCategory,onClose }: { categories:Category[];onAdd:(catId:string,label:string)=>void;onAddToWeek:(catId:string,label:string)=>void;onAddCategory:(name:string,icon:string)=>void;onClose:()=>void; }) {
  const [tab,setTab]=useState<"habit"|"category">("habit");
  const [label,setLabel]=useState("");
  const [catId,setCatId]=useState(categories[0]?.id??"");
  const [catName,setCatName]=useState("");
  const [catIcon,setCatIcon]=useState("default");
  const [showEmoji,setShowEmoji]=useState(false);
  const [showCatDrop,setShowCatDrop]=useState(false);
  const dropRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(dropRef.current&&!dropRef.current.contains(e.target as Node))setShowCatDrop(false);};
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const submitHabit=()=>{if(!label.trim())return;onAdd(catId,label.trim());setLabel("");onClose();};
  const submitHabitToWeek=()=>{if(!label.trim())return;onAddToWeek(catId,label.trim());setLabel("");onClose();};
  const submitCat=()=>{if(!catName.trim())return;onAddCategory(catName.trim(),catIcon||"default");setCatName("");onClose();};
  return (
    <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid var(--bg-subtle)" }}>
      <div style={{ display:"flex",gap:4,marginBottom:8 }}>
        {(["habit","category"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ fontFamily:"var(--font)",fontSize:"0.65rem",fontWeight:700,padding:"3px 10px",borderRadius:5,border:"1px solid",cursor:"pointer",transition:"all 0.18s",textTransform:"capitalize",borderColor:tab===t?"var(--grad-start)":"var(--border)",background:tab===t?"rgba(195,107,255,0.14)":"transparent",color:tab===t?"var(--grad-start)":"var(--text-muted)" }}>+ {t==="habit"?"New Habit":"New Category"}</button>
        ))}
        <button onClick={onClose} style={{ marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:"0.75rem" }}>✕</button>
      </div>
      {tab==="habit"?(
        <>
          <div ref={dropRef} style={{ position: "relative", marginBottom: 6 }}>
            <div 
              onClick={() => setShowCatDrop(!showCatDrop)} 
              className="h-input" 
              style={{ fontSize:"0.7rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", background: "var(--bg-subtle)", userSelect: "none" }}
            >
              <span>{categories.find(c => c.id === catId)?.name || "Select Category..."}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: showCatDrop ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"></path></svg>
            </div>
            {showCatDrop && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "var(--bg-card)", border: "1px solid var(--border-act)", borderRadius: 8, marginTop: 4, maxHeight: 150, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", padding: 4 }}>
                {categories.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => { setCatId(c.id); setShowCatDrop(false); }}
                    style={{ padding: "8px 12px", fontSize: "0.7rem", cursor: "pointer", background: c.id === catId ? "rgba(195,107,255,0.15)" : "transparent", color: c.id === catId ? "var(--text)" : "var(--text-sub)", borderRadius: 5, transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => { if (c.id !== catId) { (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; } }}
                    onMouseLeave={e => { if (c.id !== catId) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-sub)"; } }}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:6 }}>
            <input value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitHabit()} placeholder="Habit name..." className="h-input" style={{ flex:1 }}/>
            <button onClick={submitHabit} className="grad-btn">Add</button>
            <button onClick={submitHabitToWeek} title="Add this habit to all days this week" style={{ background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"var(--font)",fontSize:"0.7rem",fontWeight:700,color:"var(--text-sub)",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",transition:"all 0.18s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--grad-mid)";(e.currentTarget as HTMLElement).style.color="var(--grad-mid)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--text-sub)";}}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              All Week
            </button>
          </div>
        </>
      ):(
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <button onClick={()=>setShowEmoji(v=>!v)} style={{ background:"var(--bg-subtle)",border:"1px solid var(--bg-hover)",borderRadius:6,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,color:"var(--text-sub)" }}>
              <div style={{width:16,height:16}}>{ALL_ICONS[catIcon]??ALL_ICONS["default"]}</div>
            </button>
            {showEmoji&&<EmojiPicker onSelect={e=>setCatIcon(e)} onClose={()=>setShowEmoji(false)}/>}
          </div>
          <input value={catName} onChange={e=>setCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitCat()} placeholder="Category name..." className="h-input" style={{ flex:1 }}/>
          <button onClick={submitCat} className="grad-btn">Add</button>
        </div>
      )}
    </div>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────
function DayCard({ entry,onToggleHabit,onToggleCollapse,onAddHabit,onAddHabitToWeek,onDeleteHabit,onCheckAll,onEditCat,onDeleteCat,onAddCategory,onCopyToWeek,theme }: {
  entry:DayEntry;onToggleHabit:(ds:string,catId:string,hId:string)=>void;onToggleCollapse:(ds:string,catId:string)=>void;
  onAddHabit:(ds:string,catId:string,label:string)=>void;onAddHabitToWeek:(ds:string,catId:string,label:string)=>void;onDeleteHabit:(ds:string,catId:string,hId:string)=>void;
  onCheckAll:(ds:string,catId:string)=>void;onEditCat:(ds:string,catId:string,name:string,icon:string)=>void;
  onDeleteCat:(ds:string,catId:string)=>void;onAddCategory:(ds:string,name:string,icon:string)=>void;onCopyToWeek:(ds:string)=>void;
  theme: "dark" | "light";
}) {
  const [showAdd,setShowAdd]=useState(false);
  const p=pct(entry.categories);
  const dd=entry.date.getDate(), mm=MONTHS[entry.date.getMonth()];
  const dayBg = theme==='light' ? (DAY_BG_LIGHT[entry.dayName]||"#f0f2f6") : (DAY_BG_DARK[entry.dayName]||"#12121e");
  const dayDot = theme==='light' ? (DAY_META[entry.dayName]?.dotLight||"#9333ea") : (DAY_META[entry.dayName]?.dotDark||"#C36BFF");
  const dayNameColor = theme==='light' ? "#1e1e2d" : "#ffffff";
  const dayDateColor = theme==='light' ? "rgba(30,30,45,0.55)" : "rgba(255,255,255,0.45)";
  const winterDay = getWinterArcDay(entry.date);
  return (
    <div style={{ background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,display:"flex",flexDirection:"column",height:"100%" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:dayBg,borderRadius:"11px 11px 0 0",borderBottom:"1px solid var(--bg-subtle)" }}>
        <span style={{ width:9,height:9,borderRadius:"50%",flexShrink:0,background:dayDot,boxShadow:`0 0 8px ${dayDot}88` }}/>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontFamily:"var(--font)",fontWeight:700,fontSize:"0.84rem",letterSpacing:"0.08em",color:dayNameColor,textTransform:"uppercase" }}>{entry.dayName}</span>
            {winterDay !== null && entry.categories.some(c => c.id.includes('winterarc')) && (
              <span style={{
                fontFamily:"var(--font)",
                fontSize:"0.5rem",
                fontWeight:800,
                letterSpacing:"0.1em",
                textTransform:"uppercase",
                background: theme === 'light'
                  ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                  : "linear-gradient(135deg, #667eea, #764ba2)",
                color:"#fff",
                padding:"2px 7px",
                borderRadius:20,
                whiteSpace:"nowrap",
                boxShadow: theme === 'light'
                  ? "0 2px 8px rgba(0,0,0,0.15)"
                  : "0 2px 8px rgba(102,126,234,0.3)",
              }}>❄️ DAY {winterDay}</span>
            )}
          </div>
          <div style={{ fontFamily:"var(--font)",fontSize:"0.62rem",fontWeight:500,color:dayDateColor,marginTop:1 }}>{dd} {mm}</div>
        </div>
        <span style={{ fontFamily:"var(--font)",fontSize:"0.72rem",fontWeight:600,color:"var(--text-sub)" }}>
          {entry.categories.flatMap(c=>c.habits).filter(h=>h.done).length}
          <span style={{ color:"var(--text-sub)",fontWeight:400 }}>/{entry.categories.flatMap(c=>c.habits).length}</span>
        </span>
      </div>
      <div style={{ height:2,background:"var(--bg-subtle)" }}>
        <div className="prog-fill" style={{ width:`${p}%` }}/>
      </div>
      <div style={{ padding:10,flex:1,overflowY:"auto",textAlign:"left",paddingBottom:0 }}>

        {entry.categories.map(cat=>(
          <CategoryBlock key={cat.id} category={cat}
            onToggleHabit={hId=>onToggleHabit(entry.dateStr,cat.id,hId)}
            onToggleCollapse={cId=>onToggleCollapse(entry.dateStr,cId)}
            onDeleteHabit={hId=>onDeleteHabit(entry.dateStr,cat.id,hId)}
            onCheckAll={cId=>onCheckAll(entry.dateStr,cId)}
            onEditCat={(cId,n,ic)=>onEditCat(entry.dateStr,cId,n,ic)}
            onDeleteCat={cId=>onDeleteCat(entry.dateStr,cId)}
          />
        ))}
      </div>
      <div style={{ padding:10,marginTop:"auto" }}>
        {showAdd
          ? <AddRow categories={entry.categories} onAdd={(cId,lbl)=>onAddHabit(entry.dateStr,cId,lbl)} onAddToWeek={(cId,lbl)=>onAddHabitToWeek(entry.dateStr,cId,lbl)} onAddCategory={(n,ic)=>onAddCategory(entry.dateStr,n,ic)} onClose={()=>setShowAdd(false)}/>
          : <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <button className="ghost-btn" style={{ width:"100%" }} onClick={()=>setShowAdd(true)}>+ Add Habit / Category</button>
              <button className="ghost-btn" style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:"var(--grad-mid)",borderColor:"var(--border)" }} onClick={()=>onCopyToWeek(entry.dateStr)} title="Copy to whole week">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy to whole week
              </button>
            </div>
        }
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function LineGraph({ data,labels,activeIdx,theme }: { data:number[];labels:string[];activeIdx:number;theme:"dark"|"light" }) {
  const W=460,H=180,PL=36,PR=16,PT=28,PB=36,gW=W-PL-PR,gH=H-PT-PB,n=data.length;
  const pts=data.map((v,i)=>({ x:n<2?PL+gW/2:PL+(i/(n-1))*gW, y:PT+gH-(v/100)*gH }));
  const lp=pts.length>1?pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" "):"";
  const ap=pts.length>1?`M${pts[0].x},${PT+gH} ${pts.map(p=>`L${p.x},${p.y}`).join(" ")} L${pts[n-1].x},${PT+gH} Z`:"";
  const isLight = theme === "light";
  const accentColor = isLight ? "#111111" : "#C36BFF";
  const accentColor2 = isLight ? "#444444" : "#28D7FF";
  const lineStroke = isLight ? "#111111" : "url(#lg)";
  const dotFill = (active:boolean) => active ? accentColor : "var(--bg-card)";
  const dotStroke = (active:boolean) => active ? accentColor : (isLight ? "#333333" : "url(#lg)");
  const highlightFill = isLight ? "rgba(0,0,0,0.05)" : "rgba(195,107,255,0.08)";
  const areaFill = isLight ? "rgba(0,0,0,0.06)" : "url(#ag)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"100%",overflow:"visible" }}>
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#C36BFF"/><stop offset="50%" stopColor="#4A90FF"/><stop offset="100%" stopColor="#28D7FF"/></linearGradient>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4A90FF" stopOpacity="0.2"/><stop offset="100%" stopColor="#4A90FF" stopOpacity="0"/></linearGradient>
        <filter id="lgw"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {[0,25,50,75,100].map(v=>{ const y=PT+gH-(v/100)*gH; return <g key={v}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border)" strokeWidth="1"/><text x={PL-6} y={y+4} fill="var(--text-sub)" fontSize="10" textAnchor="end" fontFamily="Poppins,sans-serif">{v}</text></g>; })}
      {ap&&<path d={ap} fill={areaFill}/>}
      {lp&&<path d={lp} fill="none" stroke={lineStroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" filter={isLight?"none":"url(#lgw)"}/>}
      {pts.map((p,i)=>(
        <g key={i}>
          {i===activeIdx&&<rect x={p.x-16} y={PT} width={32} height={gH} fill={highlightFill} rx="4"/>}
          <circle cx={p.x} cy={p.y} r={i===activeIdx?6:4} fill={dotFill(i===activeIdx)} stroke={dotStroke(i===activeIdx)} strokeWidth="2"/>
          <text x={p.x} y={p.y-12} fill={i===activeIdx?accentColor:"var(--text-sub)"} fontSize="11" textAnchor="middle" fontFamily="Poppins,sans-serif" fontWeight={i===activeIdx?"700":"500"}>{data[i]}%</text>
          <text x={p.x} y={H-4} fill={i===activeIdx?accentColor2:"var(--text-sub)"} fontSize="11" textAnchor="middle" fontFamily="Poppins,sans-serif" fontWeight={i===activeIdx?"700":"500"}>{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

function BarGraph({ entries,theme }: { entries:{label:string;date:string;value:number}[];theme:"dark"|"light" }) {
  const W=400,H=180,PL=36,PR=16,PT=28,PB=44,gW=W-PL-PR,gH=H-PT-PB,n=entries.length;
  const slot=n>0?gW/n:gW, barW=Math.min(36,slot*0.55);
  const isLight = theme === "light";
  const barColor1 = isLight ? "url(#lb1)" : "url(#bg1)";
  const barColor2 = isLight ? "url(#lb2)" : "url(#bg2)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"100%",overflow:"visible" }}>
      <defs>
        <linearGradient id="bg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#C36BFF"/><stop offset="100%" stopColor="#4A90FF"/></linearGradient>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#4A90FF"/><stop offset="100%" stopColor="#28D7FF"/></linearGradient>
        <linearGradient id="lb1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#111111"/><stop offset="100%" stopColor="#333333"/></linearGradient>
        <linearGradient id="lb2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#333333"/><stop offset="100%" stopColor="#555555"/></linearGradient>
        <filter id="bgw"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {[0,25,50,75,100].map(v=>{ const y=PT+gH-(v/100)*gH; return <g key={v}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border)" strokeWidth="1"/><text x={PL-6} y={y+4} fill="var(--text-sub)" fontSize="10" textAnchor="end" fontFamily="Poppins,sans-serif">{v}</text></g>; })}
      <line x1={PL} y1={PT+gH} x2={W-PR} y2={PT+gH} stroke="var(--border)" strokeWidth="1"/>
      {entries.map((e,i)=>{
        const x=PL+slot*i+slot/2, barH=(e.value/100)*gH, barY=PT+gH-barH, grad=i%2===0?barColor1:barColor2, dp=e.date.split(" ");
        return (
          <g key={i}>
            <rect x={x-barW/2} y={PT} width={barW} height={gH} fill="var(--bg-subtle)" rx="5"/>
            {barH>0&&<rect x={x-barW/2} y={barY} width={barW} height={barH} fill={grad} rx="5" filter={isLight?"none":"url(#bgw)"} opacity="0.9"/>}
            <text x={x} y={Math.min(barY-8,PT+gH-4)} fill="var(--text-sub)" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Poppins,sans-serif">{e.value}%</text>
            <text x={x} y={PT+gH+16} fill="var(--text-sub)" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Poppins,sans-serif">{e.label.slice(0,3)}</text>
            <text x={x} y={PT+gH+28} fill="var(--text-sub)" fontSize="10" textAnchor="middle" fontFamily="Poppins,sans-serif">{dp[0]} {dp[1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ percent,theme }: { percent:number;theme:"dark"|"light" }) {
  const R=48,cx=65,cy=65,sw=11,circ=2*Math.PI*R;
  const isLight = theme === "light";
  const strokeColor = isLight ? "#111111" : "url(#dg)";
  return (
    <svg viewBox="0 0 130 130" style={{ width:"100%",height:"100%" }}>
      <defs>
        <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#C36BFF"/><stop offset="50%" stopColor="#4A90FF"/><stop offset="100%" stopColor="#28D7FF"/></linearGradient>
        <filter id="dgw"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--bg-subtle)" strokeWidth={sw+4}/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={strokeColor} strokeWidth={sw} strokeDasharray={`${(percent/100)*circ} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} filter={isLight?"none":"url(#dgw)"}/>
      <text x={cx} y={cy-6} textAnchor="middle" fill="var(--text)" fontSize="20" fontWeight="800" fontFamily="Poppins,sans-serif">{percent}%</text>
      <text x={cx} y={cy+9} textAnchor="middle" fill="var(--text-sub)" fontSize="8" fontFamily="Poppins,sans-serif">COMPLETE</text>
      <text x={cx} y={cy+20} textAnchor="middle" fill="var(--text-sub)" fontSize="7" fontFamily="Poppins,sans-serif">this week</text>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HabitTrackerPage() {
  const router = useRouter();
  const now = new Date();
  const initialYear = now.getFullYear() < 2026 ? 2026 : now.getFullYear();
  const initialMonth = now.getMonth();
  const initialWeek = getWeekIndexForDate(getWeeksInMonth(initialYear, initialMonth), now);
  const [selYear,  setSelYear]  = useState(initialYear);
  const [selMonth, setSelMonth] = useState(initialMonth);
  const [selWeek,  setSelWeek]  = useState(initialWeek);
  const [store,    setStore]    = useState<Record<string,{categories:Category[]}>>({});
  const [theme,    setTheme]    = useState<"dark"|"light">("dark");
  const [userId,   setUserId]   = useState<string|null>(null);
  const userIdRef = useRef<string|null>(null);
  const saveTimer = useRef<any>(null);
  const [copyConfirmDs, setCopyConfirmDs] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showWinterRules, setShowWinterRules] = useState(false);
  const [winterArcEnabled, setWinterArcEnabled] = useState<boolean | null>(null); // null = not decided yet
  const [showWinterArcModal, setShowWinterArcModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setShowAnalytics(false);
    }
  }, []);

  // ── Load + realtime sync ──
  useEffect(()=>{
    try {
      const savedTheme = localStorage.getItem("ht-theme") as "dark"|"light";
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    } catch (e) {}

    try {
      const savedWA = localStorage.getItem("winter-arc-status-v2");
      if (savedWA !== null) {
        setWinterArcEnabled(savedWA === "true");
      } else {
        // First visit - show the modal
        setShowWinterArcModal(true);
      }
    } catch (e) {}

    let channel: any = null;

    // Clear old shared localStorage key (was causing cross-user data leak)
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    // Always start with empty store until we know who is logged in
    setStore({});

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);
      userIdRef.current = uid;

      const userKey = STORAGE_KEY + "-" + uid;

      // ALWAYS load from Supabase first — it's the source of truth
      loadHabits(uid).then(dbStore => {
        if (dbStore && Object.keys(dbStore).length > 0) {
          // Use Supabase data
          setStore(dbStore);
          try { localStorage.setItem(userKey, JSON.stringify(dbStore)); } catch(e) {}
        } else {
          // New user — check if they have local data under their key
          try {
            const raw = localStorage.getItem(userKey);
            if (raw) {
              const localStore = JSON.parse(raw);
              setStore(localStore);
              saveHabits(uid, localStore);
            }
            // else: brand new user, store stays empty {}
          } catch(e) {}
        }
      });

      // Realtime subscription — listen for changes from other devices
      channel = supabase
        .channel('habits-sync')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'habits_store',
          filter: `user_id=eq.${uid}`,
        }, (payload: any) => {
          if (payload.new?.store) {
            setStore(payload.new.store);
            const k = STORAGE_KEY+'-'+uid; try { localStorage.setItem(k, JSON.stringify(payload.new.store)); } catch(e) {}
          }
        })
        .subscribe();
    });

    return () => { if (channel) supabase.removeChannel(channel); };
  },[]);

  // Save to Supabase debounced

  const weeksInMonth     = useMemo(()=>getWeeksInMonth(selYear,selMonth),[selYear,selMonth]);
  const safeWeek         = Math.min(selWeek, weeksInMonth.length-1);
  const currentWeekDates = weeksInMonth[safeWeek]??[];

  const dayEntries: DayEntry[] = currentWeekDates.map(date=>{
    const ds=dateKey(date), name=JS_DAY_TO_NAME[date.getDay()];
    const saved = store[ds]?.categories;
    let cats = (saved && saved.length>0)?saved:DEFAULT_CATS(ds);
    // Auto-add or filter Winter Arc category based on opt-in
    if (winterArcEnabled && getWinterArcDay(date) !== null) {
      cats = cats.filter(c => !["rich", "muscular", "intelligent"].some(key => c.id.includes(key)));
      if (!cats.some(c => c.id.includes('winterarc'))) {
        cats = [WINTER_ARC_CAT(ds), ...cats];
      }
    } else if (!winterArcEnabled) {
      // Hide winter arc if they haven't explicitly opted in (covers false and null)
      cats = cats.filter(c => !c.id.includes('winterarc'));
    }
    return { dayName:name,date,dateStr:ds,categories:cats };
  });

  const updateDay = useCallback((ds:string,fn:(c:Category[])=>Category[])=>{
    setStore(p=>{
      const existing = p[ds]?.categories;
      let base = (existing && existing.length>0) ? existing : DEFAULT_CATS(ds);
      
      const [y, m, d] = ds.split('-');
      const date = new Date(Number(y), Number(m)-1, Number(d));
      if (winterArcEnabled && getWinterArcDay(date) !== null) {
        base = base.filter(c => !["rich", "muscular", "intelligent"].some(key => c.id.includes(key)));
        if (!base.some(c => c.id.includes('winterarc'))) {
          base = [WINTER_ARC_CAT(ds), ...base];
        }
      } else if (!winterArcEnabled) {
        base = base.filter(c => !c.id.includes('winterarc'));
      }

      const newCats = fn(base);
      const newStore = { ...p,[ds]:{ categories:newCats } };
      const uid = userIdRef.current;
      const userKey = uid ? STORAGE_KEY + "-" + uid : STORAGE_KEY;
      try { localStorage.setItem(userKey, JSON.stringify(newStore)); } catch(e){}
      if (uid) {
        saveHabits(uid, newStore).then(r => {
          if (r.error) console.error("Supabase save failed:", r.error.message);
          else console.log("Saved to Supabase ok");
        });
      } else {
        console.warn("No userId - not saving to Supabase");
      }
      return newStore;
    });
  },[winterArcEnabled]);

  const toggleHabit    = useCallback((ds:string,catId:string,hId:string)=>{ updateDay(ds,cats=>cats.map(c=>c.id!==catId?c:{...c,habits:c.habits.map(h=>h.id!==hId?h:{...h,done:!h.done})})); },[updateDay]);
  const toggleCollapse = useCallback((ds:string,catId:string)=>{ updateDay(ds,cats=>cats.map(c=>c.id!==catId?c:{...c,collapsed:!c.collapsed})); },[updateDay]);
  const addHabit       = useCallback((ds:string,catId:string,label:string)=>{ updateDay(ds,cats=>cats.map(c=>c.id!==catId?c:{...c,habits:[...c.habits,{id:uid(),label,done:false}]})); },[updateDay]);
  const deleteHabit    = useCallback((ds:string,catId:string,hId:string)=>{ updateDay(ds,cats=>cats.map(c=>c.id!==catId?c:{...c,habits:c.habits.filter(h=>h.id!==hId)})); },[updateDay]);
  const checkAll       = useCallback((ds:string,catId:string)=>{ updateDay(ds,cats=>cats.map(c=>{ if(c.id!==catId)return c; const a=c.habits.every(h=>h.done); return {...c,habits:c.habits.map(h=>({...h,done:!a}))}; })); },[updateDay]);
  const editCat        = useCallback((ds:string,catId:string,name:string,icon:string)=>{ updateDay(ds,cats=>cats.map(c=>c.id!==catId?c:{...c,name,icon})); },[updateDay]);
  const deleteCat      = useCallback((ds:string,catId:string)=>{ updateDay(ds,cats=>cats.filter(c=>c.id!==catId)); },[updateDay]);
  const addCategory    = useCallback((ds:string,name:string,icon:string)=>{ updateDay(ds,cats=>[...cats,{id:`${ds}-${uid()}`,name:name.toUpperCase(),icon,collapsed:false,habits:[]}]); },[updateDay]);
  const addHabitToAllWeek = useCallback((fromDs:string,catId:string,label:string)=>{
    // find category name from source day to match across all days
    setStore(p=>{
      const fromCats = p[fromDs]?.categories || DEFAULT_CATS(fromDs);
      const srcCat = fromCats.find(c=>c.id===catId);
      if(!srcCat) return p;
      const catName = srcCat.name;
      const newStore = {...p};
      currentWeekDates.forEach(date=>{
        const ds = dateKey(date);
        const existing = newStore[ds]?.categories || DEFAULT_CATS(ds);
        // find matching category by name, or use first category
        const targetCat = existing.find(c=>c.name===catName) || existing[0];
        if(!targetCat) return;
        newStore[ds] = { categories: existing.map(c=>c.id===targetCat.id ? {...c, habits:[...c.habits,{id:uid(),label,done:false}]} : c) };
      });
      const uid_str = userIdRef.current;
      const userKey = uid_str ? STORAGE_KEY+"-"+uid_str : STORAGE_KEY;
      try { localStorage.setItem(userKey, JSON.stringify(newStore)); } catch(e){}
      if(uid_str) saveHabits(uid_str, newStore);
      return newStore;
    });
  },[currentWeekDates, updateDay]);
  const copyDayToWeek  = useCallback((fromDs:string)=>{
    setStore(p=>{
      const fromCats = p[fromDs]?.categories || DEFAULT_CATS(fromDs);
      if(!fromCats.length) return p;
      const newStore = { ...p };
      currentWeekDates.forEach(date=>{
        const targetDs = dateKey(date);
        if(targetDs===fromDs) return;
        newStore[targetDs] = { categories: fromCats.map(c=>({...c, id:`${targetDs}-${uid()}`, habits:c.habits.map(h=>({...h, id:uid(), done:false}))})) };
      });
      const uid_str = userIdRef.current;
      const userKey = uid_str ? STORAGE_KEY + "-" + uid_str : STORAGE_KEY;
      try { localStorage.setItem(userKey, JSON.stringify(newStore)); } catch(e){}
      if(uid_str) saveHabits(uid_str, newStore);
      return newStore;
    });
  },[currentWeekDates]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("ht-theme", next); } catch(e) {}
      return next;
    });
  }, []);

  const enableWinterArc = useCallback(() => {
    setWinterArcEnabled(true);
    setShowWinterArcModal(false);
    try { localStorage.setItem("winter-arc-status-v2", "true"); } catch(e) {}
  }, []);

  const disableWinterArc = useCallback(() => {
    setWinterArcEnabled(false);
    setShowWinterArcModal(false);
    try { localStorage.setItem("winter-arc-status-v2", "false"); } catch(e) {}
  }, []);

  const allHabits = dayEntries.flatMap(d=>d.categories.flatMap(c=>c.habits));
  const totalDone = allHabits.filter(h=>h.done).length;
  const weekPct   = allHabits.length?Math.round(totalDone/allHabits.length*100):0;

  const monthGraphData = useMemo(()=>weeksInMonth.map(wDates=>{
    const allH=wDates.flatMap(d=>{ const ds=dateKey(d); return (store[ds]?.categories??DEFAULT_CATS(ds)).flatMap(c=>c.habits); });
    return allH.length?Math.round(allH.filter(h=>h.done).length/allH.length*100):0;
  }),[store,weeksInMonth]);

  const graphLabels = weeksInMonth.map((_,i)=>`W${i+1}`);

  const weekBarData = useMemo(()=>currentWeekDates.map(date=>{
    const ds=dateKey(date), cats=store[ds]?.categories??DEFAULT_CATS(ds), all=cats.flatMap(c=>c.habits);
    return { label:JS_DAY_TO_NAME[date.getDay()],date:`${date.getDate()} ${MONTHS[date.getMonth()]}`,value:all.length?Math.round(all.filter(h=>h.done).length/all.length*100):0 };
  }),[store,currentWeekDates]);

  const winterArcStats = useMemo(() => {
    if (!winterArcEnabled) return null;
    const stats = currentWeekDates.map(date => {
      const ds = dateKey(date);
      const cats = store[ds]?.categories ?? [];
      const waCat = cats.find(c => c.id.includes('winterarc'));
      if (!waCat) return { day: JS_DAY_TO_NAME[date.getDay()].slice(0,3), date: `${date.getDate()} ${MONTHS[date.getMonth()]}`, done: 0, total: WINTER_ARC_HABITS.length };
      const done = waCat.habits.filter(h => h.done).length;
      return { day: JS_DAY_TO_NAME[date.getDay()].slice(0,3), date: `${date.getDate()} ${MONTHS[date.getMonth()]}`, done, total: waCat.habits.length };
    });
    const totalDone = stats.reduce((a,s) => a + s.done, 0);
    const totalAll = stats.reduce((a,s) => a + s.total, 0);
    const overallPct = totalAll > 0 ? Math.round(totalDone / totalAll * 100) : 0;
    return { stats, totalDone, totalAll, overallPct };
  }, [winterArcEnabled, store, currentWeekDates]);

  const weekDates  = weeksInMonth[safeWeek]??[];
  const rangeLabel = weekDates.length>0?`${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]} – ${weekDates[weekDates.length-1].getDate()} ${MONTHS[weekDates[weekDates.length-1].getMonth()]}`:"";
  const ROW_DAYS=[["Monday","Tuesday","Wednesday"],["Thursday","Friday","Saturday"],["Sunday"]];
  const getEntry=(d:string)=>dayEntries.find(e=>e.dayName===d)??null;

  return (
    <div style={{ minHeight:"100vh",background:"var(--bg)" }}>
      {/* ── Header ── */}
      <header style={{ position:"sticky",top:0,zIndex:50,padding:"10px 16px",background:"var(--bg-card)",backdropFilter:"blur(16px)",borderBottom:"1px solid var(--border)" }}>
        <div className="habit-tracker-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <button onClick={()=>router.push("/choose")} style={{ background:"none",border:"1px solid var(--border)",borderRadius:7,color:"var(--text-muted)",padding:"5px 12px",cursor:"pointer",fontFamily:"var(--font)",fontSize:"0.7rem",fontWeight:600,letterSpacing:"0.06em",transition:"all 0.18s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--grad-start)";(e.currentTarget as HTMLElement).style.color="var(--grad-start)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--text-muted)";}}
            >← Home</button>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <img src="/icons/icon-192.png" alt="LifeStack Logo" style={{ width:32, height:32, borderRadius:8 }} />
              <div>
                <div style={{ display:"flex",alignItems:"baseline",gap:7 }}>
                  <span className="logo-habit">HABIT</span><span className="logo-tracker">TRACKER</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:2 }}>
                  <span style={{ fontSize:"0.55rem",background:"var(--gradient)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>✦</span>
                  <span className="logo-sub">Consistency Protocol</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button 
                onClick={() => setShowWinterArcModal(true)} 
                title="Winter Arc Settings" 
                style={{ background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"50%", width: 28, height: 28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text-sub)", transition:"all 0.2s", fontSize: "0.8rem" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="var(--grad-mid)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border-act)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="var(--text-sub)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
              >
                ❄️
              </button>
              <button onClick={toggleTheme} title="Toggle Dark/Light Mode" style={{ background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:"50%", width: 28, height: 28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text-sub)", transition:"all 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="var(--grad-mid)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border-act)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="var(--text-sub)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
              >
                {theme === "dark" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
              <span style={{ fontFamily:"var(--font)",fontSize:"0.62rem",fontWeight:600,color:"var(--text-muted)",letterSpacing:"0.08em" }}>{rangeLabel} · {totalDone}/{allHabits.length} done</span>
            </div>
            <div style={{ width:120,height:3,background:"var(--bg-subtle)",borderRadius:2,overflow:"hidden",marginTop:2 }}>
              <div className="prog-fill" style={{ width:`${weekPct}%` }}/>
            </div>
          </div>
        </div>
        <div className="habit-tracker-selectors" style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.12em",color:"var(--text-muted)",textTransform:"uppercase" }}>Year</span>
            <select value={selYear} onChange={e=>{ setSelYear(Number(e.target.value));setSelWeek(0); }} style={{ fontFamily:"var(--font)",fontSize:"0.78rem",fontWeight:600,padding:"5px 32px 5px 12px",borderRadius:7,border:`1px solid var(--grad-start)`,backgroundColor:theme==="light"?"rgba(0,0,0,0.05)":"rgba(195,107,255,0.12)",color:"var(--grad-start)",cursor:"pointer",outline:"none",appearance:"none",WebkitAppearance:"none",backgroundImage:theme==="light"?`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23111' d='M6 8L1 3h10z'/%3E%3C/svg%3E")` : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23C36BFF' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center" }}>
              {YEARS.map(y=>(<option key={y} value={y} style={{ background:theme==="light"?"#fff":"#12121e",color:theme==="light"?"#111":"#e8e8f0" }}>{y}</option>))}
            </select>
          </div>
          <div style={{ width:1,height:28,background:"var(--border)" }}/>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.12em",color:"var(--text-muted)",textTransform:"uppercase",minWidth:36 }}>Month</span>
            <div className="month-scroll-container" style={{ display:"flex",gap:3,flexWrap:"wrap",maxWidth:"calc(100vw - 120px)",overflowX:"auto" }}>
              {MONTHS.map((m,i)=>(<button key={m} onClick={()=>{ setSelMonth(i);setSelWeek(0); }} style={{ fontFamily:"var(--font)",fontSize:"0.68rem",fontWeight:600,padding:"3px 8px",borderRadius:5,border:"1px solid",cursor:"pointer",transition:"all 0.18s",borderColor:selMonth===i?"var(--grad-mid)":"var(--border)",background:selMonth===i?(theme==="light"?"rgba(0,0,0,0.08)":"rgba(74,144,255,0.14)"):"transparent",color:selMonth===i?"var(--grad-mid)":"var(--text-muted)" }}>{m}</button>))}
            </div>
          </div>
          <div style={{ width:1,height:28,background:"var(--border)" }}/>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.12em",color:"var(--text-muted)",textTransform:"uppercase",minWidth:30 }}>Week</span>
            <div className="week-scroll-container" style={{ display:"flex",gap:4 }}>
              {weeksInMonth.map((wDates,i)=>{ const s=wDates[0].getDate(),e=wDates[wDates.length-1].getDate(); return (
                <button key={i} onClick={()=>setSelWeek(i)} style={{ fontFamily:"var(--font)",fontSize:"0.68rem",fontWeight:600,padding:"4px 10px",borderRadius:5,border:"1px solid",cursor:"pointer",transition:"all 0.18s",borderColor:safeWeek===i?"var(--grad-end)":"var(--border)",background:safeWeek===i?(theme==="light"?"rgba(0,0,0,0.08)":"rgba(40,215,255,0.12)"):"transparent",color:safeWeek===i?"var(--grad-end)":"var(--text-muted)" }}>
                  W{i+1}<span style={{ fontSize:"0.55rem",marginLeft:3,opacity:0.6 }}>{s}–{e}</span>
                </button>
              ); })}
            </div>
          </div>
        </div>
      </header>

      {/* ── Winter Arc Banner ── */}
      {winterArcEnabled && (
      <div style={{ margin: "16px 12px 0" }}>
        <button
          onClick={() => setShowWinterRules(v => !v)}
          className="winter-arc-banner"
          style={{
            width: "100%",
            padding: "14px 20px",
            background: theme === 'light'
              ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)"
              : "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
            border: theme === 'light' ? "1px solid rgba(22,33,62,0.3)" : "1px solid rgba(102,126,234,0.3)",
            borderRadius: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            position: "relative",
            overflow: "hidden",
            boxShadow: theme === 'light'
              ? "0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
              : "0 4px 20px rgba(102,126,234,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = theme === 'light'
              ? "0 8px 30px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
              : "0 8px 30px rgba(102,126,234,0.3), inset 0 1px 0 rgba(255,255,255,0.08)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = theme === 'light'
              ? "0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
              : "0 4px 20px rgba(102,126,234,0.15), inset 0 1px 0 rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          {/* Snowflake particles */}
          <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, pointerEvents:"none", overflow:"hidden" }}>
            {[...Array(6)].map((_,i) => (
              <span key={i} className="winter-snowflake" style={{
                position:"absolute",
                fontSize: `${8 + Math.random() * 6}px`,
                left: `${10 + i * 16}%`,
                top: `-10px`,
                opacity: 0.3 + Math.random() * 0.3,
                animationDelay: `${i * 0.8}s`,
              }}>❄</span>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, zIndex:1 }}>
            <span style={{ fontSize:"1.5rem" }}>❄️</span>
            <div style={{ textAlign:"left" }}>
              <div style={{
                fontFamily:"var(--font)",
                fontSize:"0.95rem",
                fontWeight:900,
                letterSpacing:"0.14em",
                textTransform:"uppercase",
                color:"#fff",
                textShadow:"0 2px 10px rgba(102,126,234,0.5)",
              }}>🔥 WINTER ARC STARTED 🔥</div>
              <div style={{
                fontFamily:"var(--font)",
                fontSize:"0.65rem",
                fontWeight:500,
                color:"rgba(255,255,255,0.6)",
                letterSpacing:"0.08em",
                marginTop:2,
              }}>Tap to view the rules · No excuses · Become unstoppable</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, zIndex:1 }}>
            <span style={{
              fontFamily:"var(--font)",
              fontSize:"0.6rem",
              fontWeight:700,
              color:"rgba(255,255,255,0.5)",
              letterSpacing:"0.1em",
              textTransform:"uppercase",
            }}>{showWinterRules ? "HIDE" : "RULES"}</span>
            <span style={{
              transition:"transform 0.3s",
              transform: showWinterRules ? "rotate(180deg)" : "rotate(0deg)",
              color:"rgba(255,255,255,0.6)",
              fontSize:"0.7rem",
            }}>▼</span>
          </div>
        </button>

        {/* Winter Arc Rules Panel */}
        <div style={{
          maxHeight: showWinterRules ? "1000px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.5s ease, opacity 0.3s ease, margin 0.3s ease",
          opacity: showWinterRules ? 1 : 0,
          marginTop: showWinterRules ? 8 : 0,
        }}>
          <div style={{
            background: theme === 'light'
              ? "linear-gradient(145deg, #f8f9ff 0%, #e8ecf4 100%)"
              : "linear-gradient(145deg, rgba(15,12,41,0.95) 0%, rgba(48,43,99,0.6) 100%)",
            border: theme === 'light' ? "1px solid rgba(22,33,62,0.15)" : "1px solid rgba(102,126,234,0.2)",
            borderRadius: 12,
            padding: "16px 18px",
            backdropFilter: "blur(10px)",
          }}>
            <div style={{
              fontFamily:"var(--font)",
              fontSize:"0.7rem",
              fontWeight:800,
              letterSpacing:"0.12em",
              textTransform:"uppercase",
              color: theme === 'light' ? "#1a1a2e" : "rgba(255,255,255,0.7)",
              marginBottom:12,
              display:"flex",
              alignItems:"center",
              gap:6,
            }}>
              <span>⚔️</span> THE 10 COMMANDMENTS OF WINTER ARC
            </div>
            <div style={{ display:"grid", gap:6 }}>
              {WINTER_ARC_RULES.map((r, i) => (
                <div key={i} style={{
                  display:"flex",
                  alignItems:"center",
                  gap:10,
                  padding:"8px 12px",
                  borderRadius:8,
                  background: theme === 'light'
                    ? "rgba(0,0,0,0.03)"
                    : "rgba(255,255,255,0.03)",
                  border: theme === 'light'
                    ? "1px solid rgba(0,0,0,0.06)"
                    : "1px solid rgba(255,255,255,0.06)",
                  transition:"all 0.2s",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = theme === 'light'
                      ? "rgba(0,0,0,0.06)"
                      : "rgba(102,126,234,0.1)";
                    (e.currentTarget as HTMLElement).style.borderColor = theme === 'light'
                      ? "rgba(0,0,0,0.12)"
                      : "rgba(102,126,234,0.25)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = theme === 'light'
                      ? "rgba(0,0,0,0.03)"
                      : "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLElement).style.borderColor = theme === 'light'
                      ? "rgba(0,0,0,0.06)"
                      : "rgba(255,255,255,0.06)";
                  }}
                >
                  <span style={{
                    fontSize:"0.9rem",
                    width:28,
                    height:28,
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    borderRadius:6,
                    background: theme === 'light'
                      ? "rgba(22,33,62,0.08)"
                      : "rgba(102,126,234,0.12)",
                    flexShrink:0,
                  }}>{r.icon}</span>
                  <span style={{
                    fontFamily:"var(--font)",
                    fontSize:"0.75rem",
                    fontWeight:600,
                    color: theme === 'light' ? "#1a1a2e" : "rgba(255,255,255,0.85)",
                    lineHeight:1.3,
                  }}>{r.rule}</span>
                  <span style={{
                    marginLeft:"auto",
                    fontFamily:"var(--font)",
                    fontSize:"0.55rem",
                    fontWeight:700,
                    color: theme === 'light' ? "rgba(22,33,62,0.35)" : "rgba(255,255,255,0.2)",
                    letterSpacing:"0.1em",
                    flexShrink:0,
                  }}>#{String(i+1).padStart(2,'0')}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop:14,
              padding:"10px 14px",
              borderRadius:8,
              background: theme === 'light'
                ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                : "linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))",
              border: theme === 'light' ? "1px solid rgba(22,33,62,0.2)" : "1px solid rgba(102,126,234,0.2)",
              textAlign:"center",
            }}>
              <span style={{
                fontFamily:"var(--font)",
                fontSize:"0.68rem",
                fontWeight:700,
                letterSpacing:"0.1em",
                color: theme === 'light' ? "#fff" : "rgba(255,255,255,0.7)",
              }}>"THE PAIN OF DISCIPLINE IS NOTHING COMPARED TO THE PAIN OF REGRET" 💪</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Analytics ── */}
        <section className="habit-tracker-analytics" style={{ margin:"16px 12px 0",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:14,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1px 1fr 1px auto",gap:"0 16px",alignItems:"stretch" }}>
          <div className="analytics-line-chart">
            <div style={{ display:"flex",alignItems:"baseline",gap:7,marginBottom:8 }}>
              <span style={{ fontFamily:"var(--font)",fontSize:"0.76rem",fontWeight:700,color:"var(--text)" }}>Monthly</span>
              <span style={{ fontFamily:"var(--font)",fontSize:"0.72rem",fontWeight:500,color:"var(--text-sub)" }}>{MONTHS[selMonth]} {selYear} · line per week</span>
            </div>
            <div style={{ height:180 }}><LineGraph data={monthGraphData} labels={graphLabels} activeIdx={safeWeek} theme={theme}/></div>
          </div>
          <div className="analytics-divider habit-tracker-analytics-divider" style={{ background:"var(--border)" }}/>
          <div className="analytics-bar-chart">
            <div style={{ display:"flex",alignItems:"baseline",gap:7,marginBottom:8 }}>
              <span style={{ fontFamily:"var(--font)",fontSize:"0.76rem",fontWeight:700,color:"var(--text)" }}>Week {safeWeek+1}</span>
              <span style={{ fontFamily:"var(--font)",fontSize:"0.72rem",fontWeight:500,color:"var(--text-sub)" }}>{rangeLabel} · bar per day</span>
            </div>
            <div style={{ height:180 }}><BarGraph entries={weekBarData} theme={theme}/></div>
          </div>
          <div className="analytics-divider habit-tracker-analytics-divider" style={{ background:"var(--border)" }}/>
          <div className="analytics-donut" style={{ width:140,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4 }}>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.68rem",fontWeight:700,color:"var(--text)" }}>{MONTHS[selMonth]} W{safeWeek+1}</span>
            <div style={{ width:130,height:130 }}><DonutChart percent={weekPct} theme={theme}/></div>
            <span style={{ fontFamily:"var(--font)",fontSize:"0.78rem",fontWeight:600,color:"var(--text-sub)",textAlign:"center" }}>{totalDone}/{allHabits.length} habits</span>
          </div>
        </section>

      {/* ── Habit Grid ── */}
      <main style={{ padding:"12px 12px 80px" }}>
        {ROW_DAYS.map((rowDays,rowIdx)=>{
          const rowEntries=rowDays.map(d=>getEntry(d)).filter(Boolean) as DayEntry[];
          if(!rowEntries.length) return null;
          return (
            <div key={rowIdx} style={{ marginBottom:14 }}>
              {rowIdx===2
                ? <div className="habit-tracker-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                    <div/>{rowEntries.map(e=>(<DayCard key={e.dateStr} entry={e} theme={theme} onToggleHabit={toggleHabit} onToggleCollapse={toggleCollapse} onAddHabit={addHabit} onAddHabitToWeek={addHabitToAllWeek} onDeleteHabit={deleteHabit} onCheckAll={checkAll} onEditCat={editCat} onDeleteCat={deleteCat} onAddCategory={addCategory} onCopyToWeek={setCopyConfirmDs}/>))}<div/>
                  </div>
                : <div className="habit-tracker-grid" style={{ display:"grid",gridTemplateColumns:`repeat(${rowEntries.length},1fr)`,gap:14 }}>
                    {rowEntries.map(e=>(<DayCard key={e.dateStr} entry={e} theme={theme} onToggleHabit={toggleHabit} onToggleCollapse={toggleCollapse} onAddHabit={addHabit} onAddHabitToWeek={addHabitToAllWeek} onDeleteHabit={deleteHabit} onCheckAll={checkAll} onEditCat={editCat} onDeleteCat={deleteCat} onAddCategory={addCategory} onCopyToWeek={setCopyConfirmDs}/>))}
                  </div>
              }
            </div>
          );
        })}
      </main>

      {copyConfirmDs && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(5px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"var(--bg-card)",border:"1px solid var(--border-act)",borderRadius:16,padding:24,width:320,boxShadow:"0 16px 40px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontFamily:"var(--font)",fontSize:"1.1rem",fontWeight:700,color:"var(--text)",marginBottom:10 }}>Copy Habits to Week?</h3>
            <p style={{ fontFamily:"var(--font)",fontSize:"0.85rem",color:"var(--text-sub)",marginBottom:20,lineHeight:1.5 }}>
              Are you sure you want to copy <strong>{dayEntries.find(e=>e.dateStr===copyConfirmDs)?.dayName}</strong>&apos;s habits to all other days of this week? This will overwrite your existing habits for those days.
            </p>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button className="ghost-btn" onClick={()=>setCopyConfirmDs(null)} style={{ padding:"8px 16px" }}>Cancel</button>
              <button className="grad-btn" onClick={()=>{ copyDayToWeek(copyConfirmDs); setCopyConfirmDs(null); }} style={{ padding:"8px 16px" }}>Overwrite & Copy</button>
            </div>
          </div>
        </div>
      )}

      <footer style={{ position:"fixed",bottom:0,left:0,right:0,padding:"8px 12px",textAlign:"center",background:"var(--bg-card)",backdropFilter:"blur(10px)",borderTop:"1px solid var(--border)" }}>
        <span style={{ fontFamily:"var(--font)",fontSize:"0.62rem",fontWeight:500,letterSpacing:"0.1em",color:"var(--text-muted)" }}>
          {MONTHS[selMonth]} {selYear} · Week {safeWeek+1} · {rangeLabel} · {weekPct}% complete · {totalDone}/{allHabits.length} done
        </span>
      </footer>

      {showWinterArcModal && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{
            background: theme === 'light'
              ? "linear-gradient(145deg, #ffffff 0%, #f0f2ff 100%)"
              : "linear-gradient(145deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%)",
            border: theme === 'light' ? "1px solid rgba(22,33,62,0.15)" : "1px solid rgba(102,126,234,0.3)",
            borderRadius:20,
            padding:"32px 28px",
            maxWidth:420,
            width:"100%",
            boxShadow: theme === 'light'
              ? "0 20px 60px rgba(0,0,0,0.15)"
              : "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(102,126,234,0.1)",
            textAlign:"center",
          }}>
            <div style={{ fontSize:"3rem", marginBottom:12 }}>❄️🔥</div>
            <h2 style={{
              fontFamily:"var(--font)",
              fontSize:"1.3rem",
              fontWeight:900,
              letterSpacing:"0.12em",
              textTransform:"uppercase",
              color: theme === 'light' ? "#1a1a2e" : "#fff",
              marginBottom:8,
              textShadow: theme === 'light' ? "none" : "0 2px 10px rgba(102,126,234,0.3)",
            }}>Winter Arc Challenge</h2>
            <p style={{
              fontFamily:"var(--font)",
              fontSize:"0.82rem",
              fontWeight:500,
              color: theme === 'light' ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)",
              lineHeight:1.6,
              marginBottom:20,
            }}>Are you ready to transform yourself? The Winter Arc is a self-improvement challenge starting Sep 1. No excuses, no shortcuts — just pure discipline.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button onClick={enableWinterArc} style={{
                fontFamily:"var(--font)",
                fontSize:"0.85rem",
                fontWeight:800,
                letterSpacing:"0.1em",
                textTransform:"uppercase",
                padding:"14px 24px",
                borderRadius:12,
                border:"none",
                cursor:"pointer",
                color:"#fff",
                background: theme === 'light'
                  ? "linear-gradient(135deg, #1a1a2e 0%, #302b63 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: theme === 'light'
                  ? "0 4px 15px rgba(26,26,46,0.3)"
                  : "0 4px 15px rgba(102,126,234,0.4)",
                transition:"all 0.2s ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = theme === 'light' ? "0 8px 25px rgba(26,26,46,0.4)" : "0 8px 25px rgba(102,126,234,0.5)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = theme === 'light' ? "0 4px 15px rgba(26,26,46,0.3)" : "0 4px 15px rgba(102,126,234,0.4)"; }}
              >🔥 Yes, I&apos;m in! Let&apos;s go!</button>
              <button onClick={disableWinterArc} style={{
                fontFamily:"var(--font)",
                fontSize:"0.78rem",
                fontWeight:600,
                padding:"12px 24px",
                borderRadius:12,
                border: theme === 'light' ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.15)",
                cursor:"pointer",
                color: theme === 'light' ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)",
                background:"transparent",
                transition:"all 0.2s ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = theme === 'light' ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLElement).style.color = theme === 'light' ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.6)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = theme === 'light' ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = theme === 'light' ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)"; }}
              >No thanks, keep it normal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}