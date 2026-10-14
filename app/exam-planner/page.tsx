"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { loadExam, saveExam } from "../../lib/examDb";
import { getGateTemplate, type SubjectTemplate } from "../../lib/gatePlannerDb";

const JobPrepPlanner = dynamic(() => import("./job-prep"), { ssr: false, loading: () => <div style={{height:'100vh',background:'#060A17',display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontFamily:"'Poppins',sans-serif"}}>Loading Job Prep Planner...</div> });
const PLANNER_MODE_KEY = "lifestack-planner-mode";

// Force unregister Service Workers
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).substr(2, 9);
const STORAGE_KEY = "lifestack-exam";
export const localDateString = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDateString();

type Chapter = { id: string; name: string; done: boolean; dpps?: number; lec?: boolean; notes?: boolean; shortnotes?: boolean; pyqs?: boolean; test?: boolean; rev?: number; };
type Subject = {
  id: string; name: string; deadline: string; startDate?: string;
  chapters: Chapter[]; color: string;
  dpps?: boolean; pyqs?: boolean; notes?: boolean; shortnotes?: boolean; lec?: boolean; test?: boolean; revs?: number; subjectDone?: boolean;
};

type DailyTask = { id: string; text: string; done: boolean; };
export type StudySession = { id: string; subjectId: string; topic: string; startTime: string; endTime: string; durationHrs: number; };
type DailyLog = {
  date: string; hours: number; dpps: number; journal: string;
  tasks?: DailyTask[];
  sessions?: StudySession[];
};
type TestScore = {
  id: string; date: string; subjectId: string; testType: string;
  score: number; maxScore: number;
};
type WeekPlan = {
  id: string; weekStart: string; // Monday YYYY-MM-DD
  targetHours: number; targetDpps: number;
  chapterTargets: { subjectId: string; chapIds: string[] }[];
  notes: string;
};
type MonthPlan = {
  id: string; month: string; // YYYY-MM
  subjectTargets: { subjectId: string; chapCount: number }[];
  notes: string;
};
type GOTest = {
  id: string;
  name: string;
  topic: string;
  category: string;
  totalMarks: number;
  timeMinutes: number;
  completed: boolean;
  obtainedMarks: number | null;
  timeTakenMinutes: number | null;
};

type ExamStore = {
  examName: string; examDate: string; targetHours: number;
  subjects: Subject[]; dailyLogs: DailyLog[]; testScores: TestScore[];
  weekPlans: WeekPlan[]; monthPlans: MonthPlan[];
  goTests?: GOTest[];
};

const DEFAULT_STORE: ExamStore = {
  examName: "", examDate: "", targetHours: 8,
  subjects: [], dailyLogs: [], testScores: [],
  weekPlans: [], monthPlans: []
};

const EXAM_PRESETS = ["GATE", "JEE", "UPSC", "CA", "NEET", "GMAT", "CAT", "CET", "CLAT", "Custom"];
const SUBJECT_COLORS = ["var(--color-teal)", "#4A90FF", "#28D7FF", "#9e7dff", "#ff6b6b", "#ffa94d", "#69db7c", "#4dabf7", "#f783ac", "#a9e34b"];

const GO_CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  DM: { label: "Discrete Mathematics", color: "var(--color-teal)" },
  EM: { label: "Engineering Mathematics", color: "#4A90FF" },
  DL: { label: "Digital Logic", color: "#28D7FF" },
  DBMS: { label: "DBMS", color: "#ffa94d" },
  C: { label: "C Programming", color: "#69db7c" },
  TOC: { label: "Theory of Computation", color: "#f783ac" },
  CN: { label: "Computer Networks", color: "#4dabf7" },
  CD: { label: "Compiler Design", color: "#a9e34b" },
  COA: { label: "Computer Organization", color: "#ff6b6b" },
  OS: { label: "Operating Systems", color: "#9e7dff" },
  DS: { label: "Data Structures", color: "#20c997" },
  Algo: { label: "Algorithms", color: "#ffd43b" },
  FLT: { label: "Full Length Tests", color: "#ff8787" },
  Mock: { label: "Mock Tests", color: "#e599f7" },
};

const DEFAULT_GO_TESTS: GOTest[] = [
  { id: uid(), category: "DM", name: "Discrete Mathematics Topic Wise Test 1", topic: "Propositional Logic, First Order Logic", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Topic Wise Test 2", topic: "Set Theory, Functions, Relations, Lattices", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Topic Wise Test 3", topic: "Group Theory", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Topic Wise Test 4", topic: "Combinatorics", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Topic Wise Test 5", topic: "Graph Theory", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Subject Wise Test 1", topic: "Complete Discrete Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Subject Wise Test 2", topic: "Complete Discrete Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DM", name: "Discrete Mathematics Subject Wise Test 3", topic: "Complete Discrete Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Topic Wise Test 1", topic: "Linear Algebra", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Extra Topic Test 1", topic: "Linear Algebra", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Topic Wise Test 2", topic: "Counting", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Topic Wise Test 3", topic: "Bayes Theorem, Conditional Probability", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Topic Wise Test 4", topic: "Complete Probability", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Topic Wise Test 5", topic: "Complete Calculus", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Subject Wise Test 1", topic: "Complete Engineering Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Subject Wise Test 2", topic: "Complete Engineering Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "EM", name: "Engineering Mathematics Subject Wise Test 3", topic: "Complete Engineering Math Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },

  { id: uid(), category: "DL", name: "Digital Logic Topic Wise Test 1", topic: "Boolean Algebra, Minimization, Number System", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DL", name: "Digital Logic Topic Wise Test 2", topic: "Combinational Circuits", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DL", name: "Digital Logic Topic Wise Test 3", topic: "Sequential Circuits", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DL", name: "Digital Logic Subject Wise Test 1", topic: "Complete Digital Logic Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DL", name: "Digital Logic Subject Wise Test 2", topic: "Complete Digital Logic Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DL", name: "Digital Logic Subject Wise Test 3", topic: "Complete Digital Logic Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "Extra Combinatorics Topic Wise Test 1", topic: "Counting", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Topic Wise Test 1", topic: "Normalization", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Topic Wise Test 2", topic: "ER Model, Integrity Constraints", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Topic Wise Test 3", topic: "Queries, SQL, TRC, Relational Algebra", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Topic Wise Test 4", topic: "Indexing, B Tree, B+ Tree", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Topic Wise Test 5", topic: "Transaction Management", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Subject Wise Test 1", topic: "Complete DBMS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Subject Wise Test 2", topic: "Complete DBMS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DBMS", name: "DBMS Subject Wise Test 3", topic: "Complete DBMS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Topic Wise Test 1", topic: "Number Rep, Control Statements (If/Loop)", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Topic Wise Test 2", topic: "Compilation, Functions, Recursion", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Topic Wise Test 3", topic: "Pointers, Arrays, Strings, Structures", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Subject Wise Test 1", topic: "Complete C Programming Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Subject Wise Test 2", topic: "Complete C Programming Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "C", name: "C Programming Subject Wise Test 3", topic: "Complete C Programming Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Topic Wise Test 1", topic: "Finite Automata", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Topic Wise Test 2", topic: "Regular Expression", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Topic Wise Test 3", topic: "CFG, PDA", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Topic Wise Test 4", topic: "Closure Properties, Language Detection", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Topic Wise Test 5", topic: "Decidability, Undecidability", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Subject Wise Test 1", topic: "Complete TOC Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Subject Wise Test 2", topic: "Complete TOC Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "TOC", name: "TOC Subject Wise Test 3", topic: "Complete TOC Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Topic Wise Test 1", topic: "IP Addressing, Subnetting, Data Link Layer", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Topic Wise Test 2", topic: "Network Layer", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Topic Wise Test 3", topic: "Routing Algorithms, Transport Layer", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Topic Wise Test 4", topic: "Transport Layer, Application Layer", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Subject Wise Test 1", topic: "Complete Computer Networks Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Subject Wise Test 2", topic: "Complete Computer Networks Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CN", name: "Computer Networks Subject Wise Test 3", topic: "Complete Computer Networks Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CD", name: "Compiler Design Topic Wise Test 1", topic: "Lexical, Syntax Analysis, Parsers", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CD", name: "Compiler Design Topic Wise Test 2", topic: "Semantic Analysis, SDT, Parser", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CD", name: "Compiler Design Topic Wise Test 3", topic: "Intermediate Code, Optimization", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CD", name: "Compiler Design Subject Wise Test 1", topic: "Complete Compiler Design Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "CD", name: "Compiler Design Subject Wise Test 2", topic: "Complete Compiler Design Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Topic Wise Test 1", topic: "Addressing Modes, Control Unit", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Topic Wise Test 2", topic: "Pipelining", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Topic Wise Test 3", topic: "Cache Memory", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Topic Wise Test 4", topic: "I/O Interfacing, Magnetic Disk", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Subject Wise Test 1", topic: "Complete COA Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Subject Wise Test 2", topic: "Complete COA Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "COA", name: "Computer Organization Subject Wise Test 3", topic: "Complete COA Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },

  { id: uid(), category: "OS", name: "Operating Systems Topic Wise Test 1", topic: "CPU Scheduling", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Topic Wise Test 2", topic: "Synchronization, Deadlock", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Topic Wise Test 3", topic: "Memory Management", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Topic Wise Test 4", topic: "File System, Fork, System Calls", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Subject Wise Test 1", topic: "Complete OS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Subject Wise Test 2", topic: "Complete OS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "OS", name: "Operating Systems Subject Wise Test 3", topic: "Complete OS Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },

  { id: uid(), category: "DS", name: "Data Structures Topic Wise Test 1", topic: "Linked List", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Topic Wise Test 2", topic: "Asymptotic Notations, Loops", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Topic Wise Test 3", topic: "Stack and Queue", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Topic Wise Test 4", topic: "Trees (Binary, BST, AVL, Heap)", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Topic Wise Test 5", topic: "Hashing with Probability", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Subject Wise Test 1", topic: "Complete Data Structures Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Subject Wise Test 2", topic: "Complete Data Structures Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "DS", name: "Data Structures Subject Wise Test 3", topic: "Complete Data Structures Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Topic Wise Test 1", topic: "Divide and Conquer", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Topic Wise Test 2", topic: "Recurrence Relations", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Topic Wise Test 3", topic: "Greedy Algorithms", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Topic Wise Test 4", topic: "Dynamic Programming", totalMarks: 25, timeMinutes: 45, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Subject Wise Test 1", topic: "Complete Algorithms Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Subject Wise Test 2", topic: "Complete Algorithms Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Algo", name: "Algorithms Subject Wise Test 3", topic: "Complete Algorithms Syllabus", totalMarks: 40, timeMinutes: 90, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "FLT", name: "DM & EM 65Q Full Length Test 1", topic: "Discrete Math & Engineering Math", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "FLT", name: "CN, DBMS, TOC, CD 65Q Full Length Test 2", topic: "CN, DBMS, TOC, Compiler Design", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "FLT", name: "OS, COA, Digital 65Q Full Length Test 3", topic: "OS, COA, Digital Logic", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "FLT", name: "C, DS, Algo 65Q Full Length Test 4", topic: "C-Prog, Data Structures, Algorithms", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 1", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 2", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 3", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 4", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 5", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 6", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 7", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 8", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 9", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 10", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 11", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 12", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 13", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 14", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 15 (AIMT - 1)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 16 (AIMT - 2)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 17 (AIMT - 3)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 18 (AIMT - 4)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 19 (AIMT - 5 Set-1)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 20 (AIMT - 5 Set-2)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
  { id: uid(), category: "Mock", name: "Mock Test 21 (AIMT - 6)", topic: "Full Syllabus", totalMarks: 100, timeMinutes: 180, completed: false, obtainedMarks: null, timeTakenMinutes: null },
];

const TEST_TYPES = ["Weekly Test", "Mock Test", "Full Mock", "Surprise Test", "DPP Quiz", "Unit Test"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysLeft(dateStr: string) {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function dateKey(d: Date) { return localDateString(d); }

function getWeekDates() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getLast30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
}

function getWeeksInMonth(year: number, monthIdx: number): Date[][] {
  const weeks: Date[][] = [];
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  let cursor = new Date(firstDay);
  let week: Date[] = [];
  while (cursor <= lastDay) {
    week.push(new Date(cursor));
    if (cursor.getDay() === 0) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

function getWeekIndexForDate(weeks: Date[][], target: Date): number {
  const key = dateKey(target);
  const idx = weeks.findIndex(w => w.some(d => dateKey(d) === key));
  return idx >= 0 ? idx : 0;
}

function buildMonthRange(start: Date, end: Date) {
  const out: { year: number; month: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// ─── Mini SVG Charts ──────────────────────────────────────────────────────────
function WeeklyBarChart({ logs, dates }: { logs: DailyLog[]; dates: Date[] }) {
  const data = dates.map(d => {
    const ds = dateKey(d);
    return { label: DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1], hours: logs.find(l => l.date === ds)?.hours || 0 };
  });
  const maxH = Math.max(...data.map(d => d.hours), 1);
  const W = 420, H = 150, PB = 36, PT = 24, PL = 28, PR = 8;
  const gH = H - PB - PT, gW = W - PL - PR;
  const n = data.length, slotW = gW / n, barW = Math.min(slotW * 0.55, 38);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal)" />
          <stop offset="100%" stopColor="var(--color-teal)" />
        </linearGradient>
      </defs>
      {[0, 2, 4, 6, 8].map(v => {
        const y = PT + gH - (v / (maxH > 8 ? maxH : 8)) * gH;
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end" fontFamily="var(--font)">{v}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PL + slotW * i + slotW / 2;
        const barH = (d.hours / (maxH > 8 ? maxH : 8)) * gH;
        const barY = PT + gH - barH;
        const isToday = dates[i] && dateKey(dates[i]) === today();
        return (
          <g key={i}>
            <rect x={x - barW / 2} y={PT} width={barW} height={gH} fill="var(--bg-subtle)" rx="5" />
            {barH > 0 && <rect x={x - barW / 2} y={barY} width={barW} height={barH} fill="url(#wbg)" rx="5" opacity={isToday ? 1 : 0.7} />}
            {d.hours > 0 && <text x={x} y={barY - 5} fill="var(--color-teal)" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="var(--font)">{d.hours}h</text>}
            <text x={x} y={H - 8} fill={isToday ? "var(--color-teal)" : "var(--text-sub)"} fontSize="10" fontWeight={isToday ? "700" : "400"} textAnchor="middle" fontFamily="var(--font)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyStudyHoursLineChart({ weekHours, weekLabels, activeWeekIdx }: { weekHours: number[]; weekLabels: string[]; activeWeekIdx: number }) {
  const data = weekHours;
  const maxH = Math.max(...data, 1);
  const W = 460, H = 180, PL = 36, PR = 16, PT = 28, PB = 36;
  const gW = W - PL - PR;
  const gH = H - PT - PB;
  const n = data.length;
  const pts = data.map((v, i) => ({
    x: n < 2 ? PL + gW / 2 : PL + (i / (n - 1)) * gW,
    y: PT + gH - (v / maxH) * gH
  }));
  const linePath = pts.length > 1 ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") : "";
  const areaPath = pts.length > 1
    ? `M${pts[0].x},${PT + gH} ${pts.map(p => `L${p.x},${p.y}`).join(" ")} L${pts[n - 1].x},${PT + gH} Z`
    : "";
  const yTicks = Array.from(new Set(Array.from({ length: 5 }, (_, i) => Math.round((maxH * i) / 4))));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ep-mlg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-teal)" /><stop offset="50%" stopColor="var(--color-teal)" /><stop offset="100%" stopColor="var(--color-teal)" />
        </linearGradient>
        <linearGradient id="ep-mag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0" />
        </linearGradient>
        <filter id="ep-mlgw"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {yTicks.map(v => {
        const y = PT + gH - (v / maxH) * gH;
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} fill="var(--text-sub)" fontSize="10" textAnchor="end" fontFamily="var(--font)">{v}</text>
          </g>
        );
      })}

      {areaPath && <path d={areaPath} fill="url(#ep-mag)" />}
      {linePath && <path d={linePath} fill="none" stroke="url(#ep-mlg)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#ep-mlgw)" />}

      {pts.map((p, i) => (
        <g key={i}>
          {i === activeWeekIdx && <rect x={p.x - 16} y={PT} width={32} height={gH} fill="rgba(var(--color-teal-rgb),0.08)" rx="4" />}
          <circle cx={p.x} cy={p.y} r={i === activeWeekIdx ? 5 : 3.5} fill={i === activeWeekIdx ? "var(--color-teal)" : "var(--bg-card)"} stroke="url(#ep-mlg)" strokeWidth="2" />
        </g>
      ))}

      {weekLabels.map((label, i) => (
        <text key={label} x={n < 2 ? PL + gW / 2 : PL + (i / (n - 1)) * gW} y={H - 4} fill={i === activeWeekIdx ? "var(--color-teal)" : "var(--text-sub)"} fontSize="10" textAnchor="middle" fontFamily="var(--font)" fontWeight={i === activeWeekIdx ? 700 : 500}>
          {label}
        </text>
      ))}
    </svg>
  );
}

function HeatMapChart({ logs }: { logs: DailyLog[] }) {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  const COLS = 13; // ~13 weeks
  const ROWS = 7;  // days Mon–Sun
  const cellSize = 13, gap = 3;
  const totalDays = COLS * ROWS; // 91 days
  const days: { date: string; hours: number }[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = localDateString(d);
    days.push({ date: ds, hours: logs.find(l => l.date === ds)?.hours || 0 });
  }
  const maxH = Math.max(...days.map(d => d.hours), 1);
  const colorFor = (h: number) => {
    if (h === 0) return 'var(--bg-subtle)';
    const t = h / maxH;
    if (t < 0.3) return 'rgba(var(--color-teal-rgb),0.25)';
    if (t < 0.6) return 'rgba(var(--color-teal-rgb),0.4)';
    if (t < 0.85) return 'rgba(var(--color-teal-rgb),0.75)';
    return 'var(--color-teal)';
  };
  const W = COLS * (cellSize + gap) + 24;
  const H = ROWS * (cellSize + gap) + 28;
  // Month labels
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  days.forEach((d, idx) => {
    const col = Math.floor(idx / ROWS);
    const m = new Date(d.date).getMonth();
    if (m !== lastMonth) { monthLabels.push({ x: 24 + col * (cellSize + gap), label: MONTHS[m] }); lastMonth = m; }
  });
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <text x={0} y={16 + 1 * (cellSize + gap) + 10} fill="var(--text-sub)" fontSize="8" fontFamily="var(--font)" fontWeight="500">Mon</text>
        <text x={0} y={16 + 3 * (cellSize + gap) + 10} fill="var(--text-sub)" fontSize="8" fontFamily="var(--font)" fontWeight="500">Wed</text>
        <text x={0} y={16 + 5 * (cellSize + gap) + 10} fill="var(--text-sub)" fontSize="8" fontFamily="var(--font)" fontWeight="500">Fri</text>
        
        {monthLabels.map((ml, i) => <text key={i} x={ml.x} y={10} fill="var(--text-sub)" fontSize="8" fontFamily="var(--font)" fontWeight="600">{ml.label}</text>)}
        {days.map((d, idx) => {
          const col = Math.floor(idx / ROWS);
          const row = idx % ROWS;
          const x = 24 + col * (cellSize + gap);
          const y = 16 + row * (cellSize + gap);
          return (
            <rect key={idx} x={x} y={y} width={cellSize} height={cellSize} rx="2"
              fill={colorFor(d.hours)}
              opacity={d.date === localDateString() ? 1 : 0.9}
              style={{ cursor: "pointer", transition: "transform 0.1s" }}
              onMouseEnter={() => setTooltip({ x: x + cellSize / 2, y, text: `${d.date}: ${d.hours.toFixed(1)}h` })}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => {
                setTooltip({ x: x + cellSize / 2, y, text: `${d.date}: ${d.hours.toFixed(1)}h` });
                setTimeout(() => setTooltip(null), 2000);
              }}
            >
              <title>{d.date}: {d.hours}h</title>
            </rect>
          );
        })}
      </svg>
      {tooltip && (
        <div style={{ position: "absolute", left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100}%`, transform: "translate(-50%, -100%)", background: "var(--text)", color: "var(--bg)", padding: "4px 8px", borderRadius: 4, fontSize: "0.65rem", fontWeight: 700, pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontFamily: "var(--font)" }}>
          {tooltip.text}
          <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid var(--text)" }} />
        </div>
      )}
    </div>
  );
}

// ─── GATE Planner Choice Screen ───────────────────────────────────────────────
function GatePlannerChoice({ examDate, targetHours, onDone, onBack }: {
  examDate: string; targetHours: number;
  onDone: (s: ExamStore) => void; onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<SubjectTemplate[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadDefaultPlanner = async () => {
    setLoading(true);
    try {
      const template = await getGateTemplate();
      const subjects: Subject[] = template.map((t, idx) => ({
        id: uid(),
        name: t.name.toUpperCase(),
        deadline: examDate,
        startDate: localDateString(),
        color: t.color,
        dpps: false, pyqs: false, notes: false, shortnotes: false, lec: false, test: false, revs: 0, subjectDone: false,
        chapters: t.chapters.map(ch => ({ id: uid(), name: ch.name, done: false, dpps: 0 })),
      }));
      onDone({ ...DEFAULT_STORE, examName: "GATE", examDate, targetHours, subjects });
    } catch (e) {
      console.error("Failed to load GATE template:", e);
      setLoading(false);
    }
  };

  const startCustom = () => {
    onDone({ ...DEFAULT_STORE, examName: "GATE", examDate, targetHours });
  };

  const previewTemplate = async () => {
    if (templatePreview) { setShowPreview(true); return; }
    const template = await getGateTemplate();
    setTemplatePreview(template);
    setShowPreview(true);
  };

  const totalChapters = templatePreview ? templatePreview.reduce((a, s) => a + s.chapters.length, 0) : 0;

  return (
    <div className="exam-planner-theme" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font)" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes floatBadge{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        .gate-card{cursor:pointer;transition:all 0.3s ease;border:1px solid var(--border)}
        .gate-card:hover{transform:translateY(-8px);box-shadow:0 24px 64px rgba(0,0,0,0.4)}
        .gate-default:hover{border-color:rgba(var(--color-teal-rgb),0.5)!important;box-shadow:0 24px 64px rgba(var(--color-teal-rgb),0.15)!important}
        .gate-custom:hover{border-color:rgba(74,144,255,0.5)!important;box-shadow:0 24px 64px rgba(74,144,255,0.15)!important}
      `}</style>
      <div style={{ maxWidth: 780, width: "100%", animation: "fadeUp 0.5s ease both" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40, position: "relative" }}>
          <button onClick={onBack} style={{ position: "absolute", left: 0, top: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 4 }}>
            ← Back
          </button>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,var(--color-teal),#4A90FF)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 12px 40px rgba(var(--color-teal-rgb),0.35)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "2rem", color: "var(--text)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>GATE Exam Planner</h1>
          <p style={{ color: "var(--text-sub)", fontSize: "0.92rem", maxWidth: 460, margin: "0 auto" }}>Choose how you want to set up your GATE preparation</p>
        </div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20, marginBottom: 24 }}>

          {/* Default Planner Card */}
          <div className="gate-card gate-default" onClick={loadDefaultPlanner} style={{
            background: "var(--bg-card)", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden",
            opacity: loading ? 0.6 : 1, pointerEvents: loading ? "none" : "auto"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,var(--color-teal),#9e7dff,var(--color-teal))", backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite" }} />
            {/* Recommended badge */}
            <div style={{ position: "absolute", top: 14, right: 14, background: "linear-gradient(135deg,rgba(var(--color-teal-rgb),0.2),rgba(var(--color-teal-rgb),0.1))", border: "1px solid rgba(var(--color-teal-rgb),0.35)", borderRadius: 100, padding: "4px 12px", fontSize: "0.65rem", fontWeight: 800, color: "var(--color-teal)", letterSpacing: "0.05em", animation: "floatBadge 2s ease infinite" }}>
              ★ RECOMMENDED
            </div>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(var(--color-teal-rgb),0.12)", border: "1px solid rgba(var(--color-teal-rgb),0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--text)", marginBottom: 8 }}>Default Planner</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: 20 }}>
              Ready-made GATE CS syllabus with all subjects & chapters pre-loaded. Curated and trusted — start tracking immediately.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {["11 Subjects", "70+ Chapters", "One-Click Setup", "Expert Curated"].map(tag => (
                <span key={tag} style={{ fontSize: "0.68rem", padding: "4px 10px", borderRadius: 100, background: "rgba(var(--color-teal-rgb),0.1)", color: "var(--color-teal)", fontWeight: 700, border: "1px solid rgba(var(--color-teal-rgb),0.2)" }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, color: "var(--color-teal)", fontWeight: 700, fontSize: "0.88rem" }}>
                {loading ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Loading...</>
                ) : (
                  <>Start with Default <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>
                )}
              </div>
            </div>
          </div>

          {/* Custom Planner Card */}
          <div className="gate-card gate-custom" onClick={startCustom} style={{
            background: "var(--bg-card)", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden",
            opacity: loading ? 0.6 : 1, pointerEvents: loading ? "none" : "auto"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#4A90FF,#28D7FF)" }} />
            <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(74,144,255,0.12)", border: "1px solid rgba(74,144,255,0.25)", borderRadius: 100, padding: "4px 12px", fontSize: "0.65rem", fontWeight: 800, color: "#4A90FF", letterSpacing: "0.05em" }}>
              FLEXIBLE
            </div>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(74,144,255,0.12)", border: "1px solid rgba(74,144,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A90FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--text)", marginBottom: 8 }}>Custom Planner</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: 20 }}>
              Build your own planner from scratch. Pick only the subjects you need and add chapters manually for full flexibility.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {["Your Subjects", "Your Chapters", "Full Control", "Personalized"].map(tag => (
                <span key={tag} style={{ fontSize: "0.68rem", padding: "4px 10px", borderRadius: 100, background: "rgba(74,144,255,0.1)", color: "#4A90FF", fontWeight: 700, border: "1px solid rgba(74,144,255,0.2)" }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A90FF", fontWeight: 700, fontSize: "0.88rem" }}>
              Start from Scratch <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>

        {/* Preview Template Button */}
        <div style={{ textAlign: "center" }}>
          <button onClick={previewTemplate} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-muted)", padding: "10px 24px", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, fontSize: "0.82rem", transition: "all 0.2s" }}>
            Preview Default Syllabus
          </button>
        </div>

        {/* Preview Modal */}
        {showPreview && templatePreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}
            onClick={e => e.target === e.currentTarget && setShowPreview(false)}>
            <div style={{ marginTop: "6vh", marginBottom: 40, background: "var(--bg-card)", border: "1px solid rgba(var(--color-teal-rgb),0.25)", borderRadius: 20, width: "100%", maxWidth: 600, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)" }}>GATE CS Default Syllabus</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>{templatePreview.length} subjects · {totalChapters} chapters</div>
                </div>
                <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "4px 12px", fontWeight: 600, fontFamily: "var(--font)" }}>✕</button>
              </div>
              <div style={{ padding: "16px 24px 24px", maxHeight: "60vh", overflowY: "auto" }}>
                {templatePreview.map((sub, si) => (
                  <div key={si} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: sub.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text)" }}>{sub.name}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 100, fontWeight: 600 }}>{sub.chapters.length} ch</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 20 }}>
                      {sub.chapters.map((ch, ci) => (
                        <span key={ci} style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 100, background: `${sub.color}15`, color: sub.color, border: `1px solid ${sub.color}30`, fontWeight: 600 }}>{ch.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
                <button onClick={() => setShowPreview(false)} style={{ flex: 1, padding: "11px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}>Close</button>
                <button onClick={() => { setShowPreview(false); loadDefaultPlanner(); }} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg,var(--color-teal),#4A90FF)", border: "none", borderRadius: 8, color: "var(--sidebar-text)", fontFamily: "var(--font)", fontWeight: 800, cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 18px rgba(var(--color-teal-rgb),0.35)" }}>Use This Planner →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
function SetupWizard({ onDone, onCancel }: { onDone: (s: ExamStore) => void, onCancel?: () => void }) {
  const [examName, setExamName] = useState("GATE");
  const [customName, setCustomName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [targetHours, setTargetHours] = useState(8);
  const [showGateChoice, setShowGateChoice] = useState(false);
  const finalName = examName === "Custom" ? customName : examName;

  // If GATE is selected and user clicked Start, show the choice screen
  if (showGateChoice) {
    return <GatePlannerChoice examDate={examDate} targetHours={targetHours} onDone={onDone} onBack={() => setShowGateChoice(false)} />;
  }

  const handleStart = () => {
    if (!finalName || !examDate) return;
    // For GATE, show the choice screen instead of directly creating empty store
    if (examName === "GATE") {
      setShowGateChoice(true);
      return;
    }
    onDone({ ...DEFAULT_STORE, examName: finalName, examDate, targetHours });
  };

  return (
    <div className="exam-planner-theme" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font)" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .ep-preset:hover{border-color:var(--border-act)!important;background:rgba(var(--color-teal-rgb),0.12)!important;color:var(--grad-start)!important}
      `}</style>
      <div style={{ maxWidth: 540, width: "100%", animation: "fadeUp 0.5s ease both" }}>
        <div style={{ textAlign: "center", marginBottom: 24, position: "relative" }}>
          {onCancel && (
            <button onClick={onCancel} style={{ position: "absolute", left: 0, top: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 4 }}>
              ← Back
            </button>
          )}
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--gradient)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(var(--color-teal-rgb),0.3)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "2rem", color: "var(--text)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Exam Planner</h1>
          <p style={{ color: "var(--text-sub)", fontSize: "0.88rem" }}>Your personalised competitive exam command center</p>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 32 }}>
            <div>
              <label style={{ display: "block", color: "var(--text-sub)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Choose your exam</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXAM_PRESETS.map(e => (
                  <button key={e} className="ep-preset" onClick={() => setExamName(e)} style={{
                    fontFamily: "var(--font)", fontSize: "0.8rem", fontWeight: 700, padding: "8px 16px", borderRadius: 8,
                    border: "1px solid", cursor: "pointer", transition: "all 0.18s",
                    borderColor: examName === e ? "var(--border-act)" : "var(--border)",
                    background: examName === e ? "rgba(var(--color-teal-rgb),0.14)" : "transparent",
                    color: examName === e ? "var(--grad-start)" : "var(--text-muted)"
                  }}>{e}</button>
                ))}
              </div>
              {examName === "Custom" && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: "block", color: "var(--text-sub)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Custom Exam Name</label>
                  <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. TOEFL, IELTS..." autoFocus style={{ width: "100%", padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border-act)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem", outline: "none", boxShadow: "0 0 0 2px rgba(var(--color-teal-rgb),0.2)" }} />
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", color: "var(--text-sub)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Exam Date</label>
              <CustomDatePicker value={examDate} onChange={setExamDate} fullWidth />
            </div>
            
            <div>
              <label style={{ display: "block", color: "var(--text-sub)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Daily Target (hrs)</label>
              <input type="number" min="1" max="20" value={targetHours} onChange={e => setTargetHours(Number(e.target.value))} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem" }} />
            </div>
          </div>

          <button onClick={handleStart}
            disabled={!finalName || !examDate}
            style={{ width: "100%", padding: "14px", background: finalName && examDate ? "var(--gradient)" : "var(--bg-subtle)", color: finalName && examDate ? "#fff" : "var(--text-muted)", border: "none", borderRadius: 10, fontFamily: "var(--font)", fontWeight: 800, fontSize: "1rem", cursor: finalName && examDate ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: finalName && examDate ? "0 6px 24px rgba(var(--color-teal-rgb),0.35)" : "none" }}>
            {examName === "GATE" ? "Continue → Choose Planner" : "Start Tracking →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function Countdown({ examDate }: { examDate: string }) {
  const getRemaining = () => {
    const end = new Date(examDate).getTime();
    const diffMs = Math.max(0, end - Date.now());
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return { days, hours, mins, secs, done: diffMs <= 0 };
  };

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    setRemaining(getRemaining());
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, [examDate]);

  const urgency = remaining.days < 30 ? "#ff6b6b" : remaining.days < 90 ? "#ffa94d" : "var(--color-teal)";

  if (remaining.done) {
    return (
      <div style={{ display: "flex", alignItems: "center", borderRadius: 14, padding: "10px 16px", background: "linear-gradient(135deg,rgba(255,107,107,0.14),rgba(255,166,77,0.1))", border: "1px solid rgba(255,107,107,0.25)", boxShadow: "0 10px 30px rgba(255,107,107,0.15)" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3L2 6M22 6l-3-3" /></svg></div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ff6b6b", lineHeight: 1.2 }}>Exam Day Reached</div>
          <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>Countdown finished</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "12px 16px",
      borderRadius: 18,
      border: "1px solid var(--border)",
      background: "linear-gradient(135deg,rgba(var(--color-teal-rgb),0.09),rgba(var(--color-teal-rgb),0.06))",
      boxShadow: "0 10px 24px rgba(0,0,0,0.16)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${urgency}1f`, border: `1px solid ${urgency}44`, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={urgency} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22" /><path d="M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" /></svg></div>
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: "2.2rem", fontWeight: 900, color: urgency, letterSpacing: "-0.03em" }}>{remaining.days}</div>
          <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>Days Left</div>
        </div>
      </div>
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#4A90FF" }}>{String(remaining.hours).padStart(2, "0")}</span>
          <span style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 700 }}>h</span>
        </div>
        <span style={{ color: "var(--text-muted)", opacity: 0.4 }}>:</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-teal)" }}>{String(remaining.mins).padStart(2, "0")}</span>
          <span style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 700 }}>m</span>
        </div>
        <span style={{ color: "var(--text-muted)", opacity: 0.4 }}>:</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3, minWidth: 56 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffa94d" }}>{String(remaining.secs).padStart(2, "0")}</span>
          <span style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 700 }}>s</span>
        </div>
      </div>
    </div>
  );
}

// DashboardSubjectRow removed in favor of direct Subject table

function CustomSelect({ options, value, onChange, placeholder }: { options: { value: string; label: string }[]; value: string; onChange: (val: string) => void; placeholder?: string; }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", fontFamily: "var(--font)", fontSize: "0.9rem" }}>
      <button
        type="button"
        onClick={e => { e.preventDefault(); setOpen(p => !p); }}
        style={{ width: "100%", padding: "10px 14px", background: "var(--bg-subtle)", border: open ? "1px solid var(--border-act)" : "1px solid var(--border)", borderRadius: 8, color: value ? "var(--text)" : "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s" }}
      >
        <span style={{ fontWeight: 600 }}>{selectedOption ? selectedOption.label : placeholder || "Select..."}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", opacity: 0.6 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, zIndex: 100, display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", maxHeight: 200, overflowY: "auto" }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={e => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(var(--color-teal-rgb),0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = opt.value === value ? "rgba(var(--color-teal-rgb),0.08)" : "transparent")}
              style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: opt.value === value ? "rgba(var(--color-teal-rgb),0.08)" : "transparent", color: opt.value === value ? "var(--text)" : "var(--text-sub)", border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", fontWeight: opt.value === value ? 600 : 500, fontSize: "0.85rem", letterSpacing: "0.02em" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Subject Card ─────────────────────────────────────────────────────────────

function DailyJournalSection({ initialJournal, onSave }: { initialJournal: string, onSave: (val: string) => void }) {
  const [draft, setDraft] = useState(initialJournal);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(initialJournal);
  }, [initialJournal]);

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, position: "relative" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Daily Journal</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 16 }}>What did you study today? Topics covered, struggles, breakthroughs...</div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={`Day's reflection... e.g. Finished Calculus topics, faced issues in Integration substitution...`}
        rows={6}
        className="ep-input"
        style={{ width: "100%", padding: "16px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem", lineHeight: 1.7, resize: "vertical", transition: "border-color 0.2s", display: "block" }}
      />
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {draft.length} characters written {draft !== initialJournal ? "• Unsaved changes" : ""}
        </div>
        <button type="button" onClick={handleSave} style={{ background: saved ? "rgba(105,219,122,0.15)" : "linear-gradient(135deg,rgba(var(--color-teal-rgb),0.15),rgba(var(--color-teal-rgb),0.15))", border: saved ? "1px solid var(--color-teal)" : "1px solid var(--border-act)", color: saved ? "var(--color-teal)" : "var(--grad-start)", padding: "10px 20px", borderRadius: 8, fontFamily: "var(--font)", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8 }}>
          {saved ? "✓ Saved Successfully!" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}

function CustomDatePicker({ value, onChange, fullWidth, openUp, allowClear, bare }: { value: string; onChange: (v: string) => void; fullWidth?: boolean; openUp?: boolean; allowClear?: boolean; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const vDate = new Date(value);
  const isInvalid = isNaN(vDate.getTime());
  const validValue = isInvalid ? today() : value;

  const [viewDate, setViewDate] = useState(isInvalid ? new Date() : new Date(validValue));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div ref={containerRef} style={{ position: "relative", width: fullWidth ? "100%" : "auto" }}>
      <button type="button" onClick={() => { setViewDate(new Date(validValue)); setOpen(!open); }} style={{ width: fullWidth ? "100%" : "auto", justifyContent: fullWidth ? "space-between" : "flex-start", background: bare ? "transparent" : "var(--bg-subtle)", border: bare ? "none" : (open ? "1px solid var(--border-act)" : "1px solid var(--border)"), padding: bare ? "0" : "10px 14px", borderRadius: bare ? 0 : 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", transition: "all 0.2s", outline: "none" }}>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>{value ? new Date(validValue).toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : "No deadline"}</span>
        {fullWidth && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>}
      </button>

      {open && (
        <div className="ep-calendar-popup" style={{ position: "absolute", ...(openUp ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }), left: fullWidth ? "auto" : 0, right: fullWidth ? 0 : "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", zIndex: 100, width: 300, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, transform: "scale(1.2)" }}>◀</button>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</div>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, transform: "scale(1.2)" }}>▶</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 8 }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>{d}</div>)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isSelected = dateStr === validValue;
              const isToday = dateStr === today();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  style={{
                    height: 36, borderRadius: 8, border: isToday && !isSelected ? "1px solid var(--border-act)" : "1px solid transparent",
                    background: isSelected ? "var(--grad-start)" : "transparent",
                    color: isSelected ? "#fff" : "var(--text)", fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Close</button>
            {allowClear && <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Clear</button>}
            <button type="button" onClick={() => { onChange(today()); setOpen(false); setViewDate(new Date()); }} style={{ background: "transparent", border: "none", color: "var(--grad-start)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Go to Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomMonthPicker({ value, onChange, fullWidth, openUp }: { value: string; onChange: (v: string) => void; fullWidth?: boolean; openUp?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parts = (value || "").split("-");
  const year = parts[0] ? parseInt(parts[0]) : new Date().getFullYear();
  const month = parts[1] ? parseInt(parts[1]) - 1 : new Date().getMonth();

  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div ref={containerRef} style={{ position: "relative", width: fullWidth ? "100%" : "auto" }}>
      <button type="button" onClick={() => { setViewYear(year); setOpen(!open); }} style={{ width: fullWidth ? "100%" : "auto", justifyContent: fullWidth ? "space-between" : "flex-start", background: "var(--bg-subtle)", border: open ? "1px solid var(--border-act)" : "1px solid var(--border)", padding: "9px 12px", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", transition: "all 0.2s" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg> {monthNames[month]} {year}</span>
        {fullWidth && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>}
      </button>

      {open && (
        <div className="ep-calendar-popup" style={{ position: "absolute", ...(openUp ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }), left: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", zIndex: 100, width: 260, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button type="button" onClick={() => setViewYear(y => y - 1)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, transform: "scale(1.2)" }}>◀</button>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{viewYear}</div>
            <button type="button" onClick={() => setViewYear(y => y + 1)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, transform: "scale(1.2)" }}>▶</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {monthNames.map((m, i) => {
              const dateStr = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
              const isSelected = dateStr === value;
              const isCurrentMonth = viewYear === new Date().getFullYear() && i === new Date().getMonth();
              return (
                <button
                  key={i} type="button"
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  style={{
                    height: 40, borderRadius: 8, border: isCurrentMonth && !isSelected ? "1px solid var(--border-act)" : "1px solid transparent",
                    background: isSelected ? "var(--grad-start)" : "var(--bg-subtle)",
                    color: isSelected ? "#fff" : "var(--text)", fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Close</button>
            <button type="button" onClick={() => { const d = new Date(); onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setOpen(false); }} style={{ background: "transparent", border: "none", color: "var(--grad-start)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>This Month</button>
          </div>
        </div>
      )}
    </div>
  );
}
// removed DashboardSubjectRow

function SubjectCard({ sub, onToggleChapter, onUpdateChapter, onUpdateSubject, onDelete }: {
  sub: Subject;
  onToggleChapter: (chId: string) => void;
  onUpdateChapter: (chId: string, updates: Partial<Chapter>) => void;
  onUpdateSubject: (updates: Partial<Subject>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sub.name);
  const [editStartDate, setEditStartDate] = useState(sub.startDate || "");
  const [editDeadline, setEditDeadline] = useState(sub.deadline);
  const [editChapters, setEditChapters] = useState<Chapter[]>(sub.chapters);
  const [newChapName, setNewChapName] = useState("");
  const [editingChapId, setEditingChapId] = useState<string | null>(null);
  const [editChapText, setEditChapText] = useState("");
  const done = sub.chapters.filter(c => c.done).length;
  const total = sub.chapters.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const dl = daysLeft(sub.deadline);
  const deadlineColor = dl < 7 ? "#ff6b6b" : dl < 21 ? "#ffa94d" : "var(--text-sub)";
  const saveEdit = () => {
    onUpdateSubject({ name: editName.trim().toUpperCase() || sub.name, startDate: editStartDate, deadline: editDeadline, chapters: editChapters });
    setEditing(false);
    setNewChapName("");
    setEditingChapId(null);
  };
  const cancelEdit = () => {
    setEditName(sub.name);
    setEditStartDate(sub.startDate || "");
    setEditDeadline(sub.deadline);
    setEditChapters(sub.chapters);
    setEditing(false);
    setNewChapName("");
    setEditingChapId(null);
  };
  const startEditing = () => {
    setEditName(sub.name);
    setEditStartDate(sub.startDate || "");
    setEditDeadline(sub.deadline);
    setEditChapters([...sub.chapters]);
    setEditing(true);
  };
  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid var(--border)`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${sub.color}` }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div onClick={() => !editing && setExpanded(e => !e)} style={{ cursor: editing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: sub.color, boxShadow: `0 0 10px ${sub.color}88`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }} onClick={e => e.stopPropagation()}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Subject name" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", fontWeight: 700 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Start Date</div>
                    <CustomDatePicker value={editStartDate} onChange={setEditStartDate} fullWidth allowClear />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Due Date</div>
                    <CustomDatePicker value={editDeadline} onChange={setEditDeadline} fullWidth allowClear />
                  </div>
                </div>

                {/* Chapter management in edit mode */}
                <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Chapters ({editChapters.length})</div>
                  {editChapters.length === 0 && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8 }}>No chapters yet</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    {editChapters.map(ch => (
                      <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "var(--bg-card)", borderRadius: 6, border: "1px solid var(--border)" }}>
                        {editingChapId === ch.id ? (
                          <>
                            <input value={editChapText} onChange={e => setEditChapText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && editChapText.trim()) { setEditChapters(prev => prev.map(c => c.id === ch.id ? { ...c, name: editChapText.trim() } : c)); setEditingChapId(null); } }} autoFocus style={{ flex: 1, padding: "4px 6px", borderRadius: 5, border: "1px solid var(--border-act)", background: "var(--bg-subtle)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.78rem", outline: "none" }} />
                            <button type="button" onClick={() => { if (editChapText.trim()) { setEditChapters(prev => prev.map(c => c.id === ch.id ? { ...c, name: editChapText.trim() } : c)); setEditingChapId(null); } }} style={{ background: sub.color, border: "none", borderRadius: 5, color: "var(--sidebar-text)", padding: "3px 8px", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer" }}>OK</button>
                            <button type="button" onClick={() => setEditingChapId(null)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-muted)", padding: "3px 8px", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>✕</button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 500, color: "var(--text)" }}>{ch.name}</span>
                            <button type="button" onClick={() => { setEditingChapId(ch.id); setEditChapText(ch.name); }} title="Edit" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                            </button>
                            <button type="button" onClick={() => setEditChapters(prev => prev.filter(c => c.id !== ch.id))} title="Delete" style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", padding: 2, display: "flex" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={newChapName} onChange={e => setNewChapName(e.target.value)} placeholder="New chapter name..." onKeyDown={e => { if (e.key === 'Enter' && newChapName.trim()) { setEditChapters(prev => [...prev, { id: uid(), name: newChapName.trim(), done: false, dpps: 0 }]); setNewChapName(""); } }} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.78rem", outline: "none" }} />
                    <button type="button" onClick={() => { if (newChapName.trim()) { setEditChapters(prev => [...prev, { id: uid(), name: newChapName.trim(), done: false, dpps: 0 }]); setNewChapName(""); } }} disabled={!newChapName.trim()} style={{ padding: "6px 10px", background: newChapName.trim() ? `linear-gradient(135deg,${sub.color},${sub.color}cc)` : "var(--bg-card)", border: newChapName.trim() ? "none" : "1px solid var(--border)", borderRadius: 6, color: newChapName.trim() ? "#fff" : "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, cursor: newChapName.trim() ? "pointer" : "default", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>+ Add</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={saveEdit} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${sub.color},${sub.color}cc)`, color: "var(--sidebar-text)", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", fontFamily: "var(--font)" }}>Save</button>
                  <button type="button" onClick={cancelEdit} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.72rem", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>{sub.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 2 }}>
                  {sub.startDate && <div style={{ fontSize: "0.7rem", color: "var(--text-sub)", fontWeight: 600 }}>• Start: {sub.startDate}</div>}
                  <div style={{ fontSize: "0.7rem", color: deadlineColor, fontWeight: 600 }}>Due: {sub.deadline || "No deadline"} · {dl}d left</div>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {!editing && (
            <button type="button" title="Edit subject" onClick={e => { e.stopPropagation(); startEditing(); }}
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-sub)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
            </button>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: sub.color }}>{pct}%</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{done}/{total} ch</div>
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); setExpanded(prev => !prev); }} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--bg-subtle)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${sub.color},${sub.color}88)`, transition: "width 0.4s ease" }} />
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          {sub.chapters.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontStyle: "italic" }}>No chapters added yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
              {sub.chapters.map(ch => (
                <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: ch.done ? `${sub.color}12` : "var(--bg-subtle)", border: "1px solid var(--border)", transition: "background 0.15s" }}>
                  <div onClick={() => onToggleChapter(ch.id)} style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${ch.done ? sub.color : "var(--border-act)"}`, background: ch.done ? sub.color : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s" }}>
                    {ch.done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: ch.done ? "var(--text-sub)" : "var(--text)", textDecoration: ch.done ? "line-through" : "none", fontWeight: ch.done ? 400 : 500, flex: 1, minWidth: 0 }}>{ch.name}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={onDelete} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 6, color: "rgba(255,100,100,0.6)", padding: "4px 10px", cursor: "pointer", fontSize: "0.72rem", fontFamily: "var(--font)", fontWeight: 600 }}>Delete Subject</button>
        </div>
      )}
    </div>
  );
}

// ─── Add Subject Modal ────────────────────────────────────────────────────────
function AddSubjectModal({ onAdd, onClose }: { onAdd: (s: Subject) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [chapInput, setChapInput] = useState("");

  const addChap = () => {
    const val = chapInput.trim();
    if (val && !chapters.includes(val)) setChapters(p => [...p, val]);
    setChapInput("");
  };
  const removeChap = (ch: string) => setChapters(p => p.filter(c => c !== ch));

  const handleChapKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChap(); }
    if (e.key === "Backspace" && !chapInput && chapters.length) setChapters(p => p.slice(0, -1));
  };

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim().toUpperCase(), startDate, deadline, color, dpps: false, pyqs: false, notes: false, shortnotes: false, lec: false, test: false, revs: 0, subjectDone: false, chapters: chapters.map(n => ({ id: uid(), name: n, done: false, dpps: 0 })) });
    onClose();
  };

  const colorNames: Record<string, string> = {
    "var(--color-teal)": "Purple", "#4A90FF": "Blue", "#28D7FF": "Cyan",
    "#9e7dff": "Indigo", "#ff6b6b": "Red", "#ffa94d": "Orange",
    "#69db7c": "Green", "#4dabf7": "Sky", "#f783ac": "Pink", "#a9e34b": "Lime"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ marginTop: "10vh", marginBottom: 40, background: "var(--bg-card)", border: "1px solid rgba(var(--color-teal-rgb),0.3)", borderRadius: 18, width: "100%", maxWidth: 480, overflow: "visible", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${color},${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sidebar-text)", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>Add Subject</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 1 }}>Chapters become individual checkboxes</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "4px 10px", fontWeight: 600 }}>✕ Close</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px 22px" }}>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Subject Name <span style={{ color: "#ff6b6b" }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering Mathematics, DSA, Calculus..."
              autoFocus
              style={{ width: "100%", padding: "10px 13px", background: "var(--bg-subtle)", border: `1px solid ${name ? color : "var(--border)"}`, borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.92rem", fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
          </div>

          {/* Color + Deadline in a row */}
          <div className="ep-grid-2" style={{ marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Color <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({colorNames[color]})</span></label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SUBJECT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} title={colorNames[c]}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid white" : "3px solid transparent", boxShadow: color === c ? `0 0 10px ${c}` : "none", transition: "all 0.15s", flexShrink: 0 }} />
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Finish By <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
              <CustomDatePicker value={deadline} onChange={setDeadline} fullWidth allowClear />
            </div>
          </div>

          {/* Start Date */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Start Date <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
            <CustomDatePicker value={startDate} onChange={setStartDate} fullWidth allowClear />
          </div>

          {/* Chapters chip input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
              Chapters / Topics {chapters.length > 0 && <span style={{ color, fontWeight: 800 }}>({chapters.length})</span>}
            </label>
            <div style={{ background: "var(--bg-subtle)", border: `1px solid ${chapters.length > 0 ? color + "44" : "var(--border)"}`, borderRadius: 8, padding: "8px 10px", minHeight: 46, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              {chapters.map(ch => (
                <span key={ch} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${color}22`, color: color, border: `1px solid ${color}44`, borderRadius: 100, padding: "3px 9px 3px 10px", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.4 }}>
                  {ch}
                  <span onClick={() => removeChap(ch)} style={{ cursor: "pointer", fontWeight: 800, fontSize: "0.9rem", marginLeft: 2, opacity: 0.7 }}>×</span>
                </span>
              ))}
              <input value={chapInput} onChange={e => setChapInput(e.target.value)} onKeyDown={handleChapKey}
                placeholder={chapters.length === 0 ? "Type chapter name..." : "Add another..."}
                style={{ border: "none", background: "transparent", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", outline: "none", flexGrow: 1, minWidth: 120 }} />
              <button type="button" onClick={addChap} disabled={!chapInput.trim()}
                style={{ padding: "5px 12px", background: chapInput.trim() ? `linear-gradient(135deg,${color},var(--color-teal))` : "var(--bg-subtle)", border: chapInput.trim() ? "none" : "1px solid var(--border)", borderRadius: 6, color: chapInput.trim() ? "#fff" : "var(--text-muted)", fontFamily: "var(--font)", fontSize: "0.75rem", fontWeight: 700, cursor: chapInput.trim() ? "pointer" : "default", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>+ Add</button>
            </div>
            <div style={{ marginTop: 5, fontSize: "0.68rem", color: "var(--text-muted)" }}>
              Type a chapter name and tap <strong>+ Add</strong> or press <strong>Enter</strong> · <strong>Backspace</strong> to remove last
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>Cancel</button>
            <button onClick={submit} disabled={!name.trim()}
              style={{ flex: 2, padding: "11px", background: name.trim() ? `linear-gradient(135deg,${color},var(--color-teal))` : "var(--bg-subtle)", border: "none", borderRadius: 8, color: name.trim() ? "#fff" : "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 800, cursor: name.trim() ? "pointer" : "not-allowed", fontSize: "0.88rem", boxShadow: name.trim() ? `0 4px 16px ${color}44` : "none", transition: "all 0.2s" }}>
              {name.trim() ? `Add "${name.trim().toUpperCase()}"${chapters.length ? ` (${chapters.length} ch)` : ""}` : "Add Subject"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

function ProductionLockScreen() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      color: "var(--sidebar-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Poppins',sans-serif",
      padding: "24px",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", marginBottom: 12 }}>
          Exam Planner
        </h1>
        <p style={{ color: "var(--text-sub)", marginBottom: 20 }}>
          Coming soon. We are polishing this feature for a better experience.
        </p>
        <button
          onClick={() => { router.push("/choose"); }}
          style={{
            border: "1px solid var(--border)",
            background: "var(--border)",
            color: "var(--sidebar-text)",
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
const CATEGORY_ORDER = ["DM", "EM", "DL", "DBMS", "C", "TOC", "CN", "CD", "COA", "OS", "DS", "Algo", "FLT", "Mock"];

function TestTrackerTab({ goTests, onUpdate }: { goTests: GOTest[]; onUpdate: (tests: GOTest[]) => void }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const categoryOrder = CATEGORY_ORDER.filter(cat => goTests.some(t => t.category === cat));
  const totalTests = goTests.length;
  const completedTests = goTests.filter(t => t.completed).length;
  const attemptedTests = goTests.filter(t => t.obtainedMarks !== null);
  const overallPct = attemptedTests.length > 0 ? Math.round(attemptedTests.reduce((a, t) => a + (t.obtainedMarks! / t.totalMarks) * 100, 0) / attemptedTests.length) : 0;
  const bestScore = attemptedTests.length > 0 ? Math.max(...attemptedTests.map(t => Math.round((t.obtainedMarks! / t.totalMarks) * 100))) : 0;
  
  const updateTest = (id: string, updates: Partial<GOTest>) => {
    onUpdate(goTests.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const toggleCollapse = (cat: string) => setCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  
  const filteredTests = goTests.filter(t => {
    if (catFilter !== "All" && t.category !== catFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.topic.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  
  const filteredCategories = catFilter !== "All" ? [catFilter] : categoryOrder.filter(cat => filteredTests.some(t => t.category === cat));
  
  const pctColor = (pct: number) => pct >= 80 ? "#69db7c" : pct >= 60 ? "#ffd43b" : pct >= 40 ? "#ffa94d" : "#ff6b6b";
  const marksBadgeColor = (m: number) => m >= 100 ? "#ff8787" : m >= 40 ? "#ffa94d" : "#69db7c";
  
  // Subject-wise chart data
  const chartCats = categoryOrder;
  const chartData = chartCats.map(cat => {
    const info = GO_CATEGORY_INFO[cat] || { label: cat, color: "#888" };
    const catAttempted = goTests.filter(t => t.category === cat && t.obtainedMarks !== null);
    const avg = catAttempted.length > 0 ? Math.round(catAttempted.reduce((a, t) => a + (t.obtainedMarks! / t.totalMarks) * 100, 0) / catAttempted.length) : 0;
    return { cat, label: info.label, color: info.color, avg, attempted: catAttempted.length > 0 };
  });
  const hasChartData = chartData.some(d => d.attempted);
  
  return (
    <div style={{ animation: "fadeUp 0.4s ease both", paddingBottom: 20 }}>
      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Completed", value: `${completedTests}/${totalTests}`, color: "var(--color-teal)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg> },
          { label: "Overall Avg", value: attemptedTests.length > 0 ? `${overallPct}%` : "—", color: attemptedTests.length > 0 ? pctColor(overallPct) : "var(--text-muted)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A90FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg> },
          { label: "Best Score", value: attemptedTests.length > 0 ? `${bestScore}%` : "—", color: "#69db7c", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#69db7c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> },
          { label: "Attempted", value: `${attemptedTests.length}`, color: "#ffa94d", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa94d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></svg> },
        ].map(s => (
          <div key={s.label} className="ep-stat" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", transition: "all 0.2s", cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: s.color, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subject-wise Score Chart */}
      {hasChartData && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            Subject Performance
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100, paddingBottom: 20, position: "relative" }}>
            {/* Y-axis lines */}
            {[25, 50, 75, 100].map(v => (
              <div key={v} style={{ position: "absolute", left: 0, right: 0, bottom: `${20 + (v / 100) * 80}px`, borderBottom: "1px dashed var(--border)", pointerEvents: "none" }} />
            ))}
            {chartData.map(d => (
              <div key={d.cat} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: "0.58rem", fontWeight: 800, color: d.attempted ? d.color : "var(--text-muted)", opacity: d.attempted ? 1 : 0.4 }}>
                  {d.attempted ? `${d.avg}%` : "—"}
                </div>
                <div style={{
                  width: "100%", maxWidth: 28, borderRadius: "4px 4px 0 0",
                  height: d.attempted ? `${Math.max(4, (d.avg / 100) * 60)}px` : 4,
                  background: d.attempted ? `linear-gradient(180deg, ${d.color}, ${d.color}88)` : "var(--bg-subtle)",
                  transition: "height 0.4s ease", minHeight: 4,
                }} />
                <div style={{ fontSize: "0.52rem", fontWeight: 700, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.1, width: "100%", overflow: "hidden" }}>
                  {d.cat}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input className="ep-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tests..."
          style={{ width: "100%", padding: "9px 12px 9px 34px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.82rem" }}
        />
      </div>
      
      {/* Category Chips */}
      <div className="ep-hide-scrollbar" style={{ display: "flex", gap: 5, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        <button onClick={() => setCatFilter("All")} style={{
          padding: "5px 12px", borderRadius: 8, border: "1px solid",
          borderColor: catFilter === "All" ? "var(--color-teal)88" : "var(--border)",
          background: catFilter === "All" ? "var(--color-teal)18" : "transparent",
          color: catFilter === "All" ? "var(--color-teal)" : "var(--text-muted)",
          fontFamily: "var(--font)", fontSize: "0.68rem", fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s"
        }}>All ({totalTests})</button>
        {categoryOrder.map(cat => {
          const info = GO_CATEGORY_INFO[cat] || { label: cat, color: "#888" };
          const catTests = goTests.filter(t => t.category === cat);
          const catDone = catTests.filter(t => t.completed).length;
          return (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? "All" : cat)} style={{
              padding: "5px 12px", borderRadius: 8, border: "1px solid",
              borderColor: catFilter === cat ? `${info.color}88` : "var(--border)",
              background: catFilter === cat ? `${info.color}18` : "transparent",
              color: catFilter === cat ? info.color : "var(--text-muted)",
              fontFamily: "var(--font)", fontSize: "0.68rem", fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s"
            }}>{info.label} ({catDone}/{catTests.length})</button>
          );
        })}
      </div>
      
      {/* Test Sections */}
      {filteredCategories.map(cat => {
        const info = GO_CATEGORY_INFO[cat] || { label: cat, color: "#888" };
        const catTests = filteredTests.filter(t => t.category === cat);
        const catCompleted = catTests.filter(t => t.completed).length;
        const catAttempted = catTests.filter(t => t.obtainedMarks !== null);
        const catAvg = catAttempted.length > 0 ? Math.round(catAttempted.reduce((a, t) => a + (t.obtainedMarks! / t.totalMarks) * 100, 0) / catAttempted.length) : 0;
        const isCollapsed = collapsed.has(cat);
        
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <button onClick={() => toggleCollapse(cat)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
              cursor: "pointer", transition: "all 0.2s", borderLeft: `3px solid ${info.color}`,
              marginBottom: isCollapsed ? 0 : 6
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text)", flex: 1, textAlign: "left" }}>{info.label}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: info.color, marginRight: 6 }}>{catCompleted}/{catTests.length}</span>
              {catAttempted.length > 0 && (
                <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: `${pctColor(catAvg)}18`, color: pctColor(catAvg) }}>{catAvg}%</span>
              )}
              <div style={{ width: 50, height: 3, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ height: "100%", width: `${catTests.length > 0 ? (catCompleted / catTests.length) * 100 : 0}%`, background: info.color, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
            </button>
            
            {!isCollapsed && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {catTests.map(test => {
                  const pct = test.obtainedMarks !== null ? Math.round((test.obtainedMarks / test.totalMarks) * 100) : null;
                  const isEditing = editingId === test.id;
                  return (
                    <div key={test.id} style={{
                      display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 8,
                      padding: "8px 12px", background: test.completed ? `${info.color}06` : "var(--bg-card)",
                      border: `1px solid ${test.completed ? `${info.color}25` : "var(--border)"}`,
                      borderRadius: 8, transition: "all 0.2s", cursor: "pointer",
                    }} onClick={() => setEditingId(isEditing ? null : test.id)}>
                      <div onClick={e => { e.stopPropagation(); updateTest(test.id, { completed: !test.completed }); }}
                        style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${test.completed ? info.color : "var(--border)"}`,
                          background: test.completed ? `${info.color}25` : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s",
                        }}>
                        {test.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{test.name}</div>
                        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{test.topic}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {pct !== null && <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 6px", borderRadius: 5, background: `${pctColor(pct)}18`, color: pctColor(pct), minWidth: 36, textAlign: "center" }}>{pct}%</span>}
                        <span style={{ fontSize: "0.64rem", fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: `${marksBadgeColor(test.totalMarks)}12`, color: marksBadgeColor(test.totalMarks), whiteSpace: "nowrap" }}>{test.totalMarks}m</span>
                        <span style={{ fontSize: "0.64rem", fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "rgba(74,144,255,0.10)", color: "#4A90FF", whiteSpace: "nowrap" }}>{test.timeMinutes >= 60 ? `${Math.floor(test.timeMinutes/60)}h${test.timeMinutes%60 > 0 ? `${test.timeMinutes%60}m` : ""}` : `${test.timeMinutes}m`}</span>
                      </div>
                      {isEditing && (
                        <div onClick={e => e.stopPropagation()} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6, padding: "10px 0 2px", borderTop: "1px solid var(--border)" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Marks (/{test.totalMarks})</label>
                            <input type="number" min="0" max={test.totalMarks} value={test.obtainedMarks ?? ""}
                              onChange={e => { const v = e.target.value === "" ? null : Math.min(test.totalMarks, Math.max(0, Number(e.target.value))); updateTest(test.id, { obtainedMarks: v, completed: v !== null ? true : test.completed }); }}
                              placeholder="—" className="ep-input"
                              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", fontWeight: 800, textAlign: "center" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Time Taken (min)</label>
                            <input type="number" min="0" value={test.timeTakenMinutes ?? ""}
                              onChange={e => { const v = e.target.value === "" ? null : Math.max(0, Number(e.target.value)); updateTest(test.id, { timeTakenMinutes: v }); }}
                              placeholder="—" className="ep-input"
                              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", fontWeight: 800, textAlign: "center" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {filteredTests.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: "0.88rem" }}>No tests match your search.</div>
      )}
    </div>
  );
}


function DailySessionsManager({ store, selDate, todayLog, updateStore }: { store: ExamStore; selDate: string; todayLog: DailyLog; updateStore: (fn: (s: ExamStore) => ExamStore) => void }) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState(store.subjects[0]?.id || "");
  const [topic, setTopic] = React.useState("");
  const [startTime, setStartTime] = React.useState("10:00");
  const [endTime, setEndTime] = React.useState("11:00");
  const [durationHrs, setDurationHrs] = React.useState<number>(1);

  // Sync default subject if none selected
  React.useEffect(() => {
    if (!subjectId && store.subjects.length > 0) setSubjectId(store.subjects[0].id);
  }, [store.subjects, subjectId]);

  const handleAdd = () => {
    if (!topic || !subjectId) return alert("Please enter subject and topic");
    
    // Convert 24h to 12h AM/PM
    const formatTime = (time: string) => {
      if (!time) return "";
      const [h, m] = time.split(":");
      let hh = parseInt(h, 10);
      const ampm = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;
      return `${hh}:${m} ${ampm}`;
    };

    const newSession = { 
      id: Date.now().toString(), 
      subjectId, 
      topic, 
      startTime: formatTime(startTime) || startTime, 
      endTime: formatTime(endTime) || endTime, 
      durationHrs 
    };

    updateStore(s => {
      const logs = [...s.dailyLogs];
      const idx = logs.findIndex(l => l.date === selDate);
      if (idx >= 0) { logs[idx] = { ...logs[idx], sessions: [...(logs[idx].sessions || []), newSession] }; }
      else { logs.push({ date: selDate, hours: 0, dpps: 0, journal: "", sessions: [newSession] }); }
      return { ...s, dailyLogs: logs };
    });
    setShowAdd(false);
    setTopic("");
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(var(--color-teal-rgb),0.15)", color: "var(--color-teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>Today's Study Sessions</h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Add and track what you studied today</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: "0 4px 10px rgba(var(--color-teal-rgb),0.3)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{showAdd ? <line x1="18" y1="6" x2="6" y2="18"></line> : <line x1="12" y1="5" x2="12" y2="19"></line>}{showAdd ? <line x1="6" y1="6" x2="18" y2="18"></line> : <line x1="5" y1="12" x2="19" y2="12"></line>}</svg> {showAdd ? 'Close' : 'Add Session'}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: "16px", background: "var(--bg-subtle)", borderRadius: 12, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, border: "1px solid var(--border)", animation: "fadeUp 0.3s ease both" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Subject</label>
            <CustomSelect options={store.subjects.map(s => ({ value: s.id, label: s.name }))} value={subjectId} onChange={setSubjectId} placeholder="Select Subject..." />
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Topic / Notes</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Recursion problems" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", outline: "none" }} />
          </div>
          <div style={{ width: 110 }}>
             <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Start Time</label>
             <input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); if (endTime && e.target.value) { const s = new Date(`1970/01/01 ${e.target.value}`); const eDate = new Date(`1970/01/01 ${endTime}`); if (eDate > s) setDurationHrs(Math.round((eDate.getTime() - s.getTime()) / 36000) / 100); } }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", outline: "none" }} />
          </div>
          <div style={{ width: 110 }}>
             <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>End Time</label>
             <input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); if (startTime && e.target.value) { const s = new Date(`1970/01/01 ${startTime}`); const eDate = new Date(`1970/01/01 ${e.target.value}`); if (eDate > s) setDurationHrs(Math.round((eDate.getTime() - s.getTime()) / 36000) / 100); } }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", outline: "none" }} />
          </div>
          <div style={{ width: 90 }}>
             <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Hours</label>
             <input type="number" step="0.25" min="0" value={durationHrs} onChange={e => setDurationHrs(Number(e.target.value))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", outline: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginLeft: "auto" }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: "9px 16px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
            <button onClick={handleAdd} style={{ padding: "9px 16px", background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", boxShadow: "0 4px 10px rgba(var(--color-teal-rgb),0.2)" }}>Save Session</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>#</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Subject</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Topic / Notes</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Start Time</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>End Time</th>
              <th style={{ padding: "12px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Duration</th>
              <th style={{ padding: "12px", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(todayLog.sessions || []).length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No sessions logged yet today. Click + Add Session to begin!</td></tr>
            ) : (
              (todayLog.sessions || []).map((sess, idx) => {
                const sub = store.subjects.find(s => s.id === sess.subjectId);
                return (
                  <tr key={sess.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>{idx + 1}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ background: `${sub?.color || "var(--color-teal)"}22`, border: `1px solid ${sub?.color || "var(--color-teal)"}55`, color: sub?.color || "var(--color-teal)", padding: "4px 8px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 800 }}>
                        {sub?.name.substring(0, 4).toUpperCase() || "SUBJ"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "0.85rem", color: "var(--text)", fontWeight: 600 }}>{sess.topic}</td>
                    <td style={{ padding: "12px", fontSize: "0.8rem", color: "var(--text-sub)", fontWeight: 600 }}>{sess.startTime}</td>
                    <td style={{ padding: "12px", fontSize: "0.8rem", color: "var(--text-sub)", fontWeight: 600 }}>{sess.endTime}</td>
                    <td style={{ padding: "12px", fontSize: "0.85rem", color: "var(--text)", fontWeight: 700 }}>{sess.durationHrs}h</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button onClick={() => {
                        updateStore(s => {
                          const logs = [...s.dailyLogs];
                          const i = logs.findIndex(l => l.date === selDate);
                          if (i >= 0) { logs[i] = { ...logs[i], sessions: (logs[i].sessions || []).filter(ss => ss.id !== sess.id) }; }
                          return { ...s, dailyLogs: logs };
                        });
                      }} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, width: 28, height: 28, color: "var(--color-red)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


﻿

// Just to get the TS syntax right, we will drop this into page.tsx replacing the old function.
// We assume we have `uid()` and `localDateString()` available in page.tsx (we do).


function PlannerTabManager({ store, selDate, updateStore, setSelDate, todayLog, setShowAddWeek, setShowAddMonth, setWpWeekStart, setMpMonth }: any) {
  const [planView, setPlanView] = React.useState<"daily" | "weekly" | "monthly">("daily");

  const sDate = new Date(selDate);
  if (isNaN(sDate.getTime())) return null;

  // Custom Modal States
  const [showSessionModal, setShowSessionModal] = React.useState<string | null>(null);
  const [sessionForm, setSessionForm] = React.useState({ subjectId: store.subjects[0]?.id || "", topic: "", durationHrs: 1, startTime: "09:00 AM", endTime: "10:00 AM" });

  const [showTaskModal, setShowTaskModal] = React.useState(false);
  const [taskForm, setTaskForm] = React.useState("");

  const [showGoalModal, setShowGoalModal] = React.useState<{type: "week"|"month", planId: string} | null>(null);
  const [goalForm, setGoalForm] = React.useState("");

  // Helpers
  const goPrev = () => {
    const d = new Date(sDate);
    if (planView === "daily") d.setDate(d.getDate() - 1);
    else if (planView === "weekly") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelDate(d.toISOString().split("T")[0]);
  };
  const goNext = () => {
    const d = new Date(sDate);
    if (planView === "daily") d.setDate(d.getDate() + 1);
    else if (planView === "weekly") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelDate(d.toISOString().split("T")[0]);
  };
  const goToday = () => {
    const d = new Date();
    setSelDate(d.toISOString().split("T")[0]);
  };

  const getDayStr = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // --- WEEKLY DATA ---
  const weekStart = new Date(sDate);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartStr = getDayStr(weekStart);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = getDayStr(weekEnd);

  const weekPlan = store.weekPlans?.find((wp: any) => wp.weekStart === weekStartStr);
  const weekLogs = store.dailyLogs.filter((l: any) => l.date >= weekStartStr && l.date <= weekEndStr);
  
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dStr = getDayStr(d);
    const log = weekLogs.find((l: any) => l.date === dStr);
    const totalHrs = log?.sessions?.reduce((acc: number, s: any) => acc + (s.durationHrs || 0), 0) || 0;
    return {
      dateObj: d,
      dateStr: dStr,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dateFormatted: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      plannedHrs: totalHrs,
      sessions: log?.sessions || []
    };
  });

  const weekTargetHrs = weekPlan?.targetHours || 40;
  const weekPlannedHrs = weekDays.reduce((acc, d) => acc + d.plannedHrs, 0);
  const weekCompletedHrs = weekLogs.reduce((acc: number, l: any) => acc + (l.hours || 0), 0);
  const weekRemainingHrs = Math.max(0, weekTargetHrs - weekCompletedHrs);

  // --- MONTHLY DATA ---
  const monthStart = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
  const monthEnd = new Date(sDate.getFullYear(), sDate.getMonth() + 1, 0);
  const monthPlan = store.monthPlans?.find((mp: any) => mp.month === `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, "0")}`);
  const monthLogs = store.dailyLogs.filter((l: any) => l.date >= getDayStr(monthStart) && l.date <= getDayStr(monthEnd));

  const firstDayIdx = (monthStart.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = monthEnd.getDate();
  const calendarCells = Array.from({ length: 35 }).map((_, i) => {
    const dayNum = i - firstDayIdx + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const dStr = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const log = monthLogs.find((l: any) => l.date === dStr);
    return { dayNum, dateStr: dStr, sessions: log?.sessions || [] };
  });

  // Goal toggling helper
  const toggleGoal = (planType: "week" | "month", planId: string, goalId: string) => {
    updateStore((s: any) => {
      const arr = planType === "week" ? s.weekPlans : s.monthPlans;
      if (!arr) return s;
      const idx = arr.findIndex((p: any) => p.id === planId);
      if (idx === -1) return s;
      const plan = { ...arr[idx] };
      const gIdx = plan.goals?.findIndex((g: any) => g.id === goalId);
      if (gIdx !== undefined && gIdx !== -1) {
        plan.goals[gIdx] = { ...plan.goals[gIdx], checked: !plan.goals[gIdx].checked };
      }
      const newArr = [...arr];
      newArr[idx] = plan;
      return { ...s, [planType === "week" ? "weekPlans" : "monthPlans"]: newArr };
    });
  };

  const handleAddGoalSubmit = () => {
    if (!showGoalModal || !goalForm.trim()) return;
    updateStore((s: any) => {
      const arr = showGoalModal.type === "week" ? s.weekPlans : s.monthPlans;
      if (!arr) return s;
      const idx = arr.findIndex((p: any) => p.id === showGoalModal.planId);
      if (idx === -1) return s;
      const plan = { ...arr[idx] };
      plan.goals = [...(plan.goals || []), { id: Date.now().toString(), t: goalForm, checked: false }];
      const newArr = [...arr];
      newArr[idx] = plan;
      return { ...s, [showGoalModal.type === "week" ? "weekPlans" : "monthPlans"]: newArr };
    });
    setShowGoalModal(null);
    setGoalForm("");
  };

  // Task toggling
  const toggleTask = (taskId: string) => {
    updateStore((s: any) => {
      const logs = [...s.dailyLogs];
      const idx = logs.findIndex((l: any) => l.date === selDate);
      if (idx >= 0 && logs[idx].tasks) {
        logs[idx] = { ...logs[idx], tasks: logs[idx].tasks.map((t: any) => t.id === taskId ? { ...t, completed: !t.completed } : t) };
      }
      return { ...s, dailyLogs: logs };
    });
  };
  
  const handleAddTaskSubmit = () => {
    if (!taskForm.trim()) return;
    updateStore((s: any) => {
      const logs = [...s.dailyLogs];
      const idx = logs.findIndex((l: any) => l.date === selDate);
      const nt = { id: Date.now().toString(), text: taskForm, completed: false };
      if (idx >= 0) {
        logs[idx] = { ...logs[idx], tasks: [...(logs[idx].tasks || []), nt] };
      } else {
        logs.push({ date: selDate, hours: 0, dpps: 0, journal: "", tasks: [nt] });
      }
      return { ...s, dailyLogs: logs };
    });
    setShowTaskModal(false);
    setTaskForm("");
  };

  const handleAddSessionSubmit = () => {
    if (!showSessionModal || !sessionForm.topic.trim()) return;
    
    updateStore((s: any) => {
      const logs = [...s.dailyLogs];
      const idx = logs.findIndex((l: any) => l.date === showSessionModal);
      const ns = { id: Date.now().toString(), ...sessionForm, durationHrs: parseFloat(sessionForm.durationHrs as any) || 1 };
      if (idx >= 0) {
        logs[idx] = { ...logs[idx], sessions: [...(logs[idx].sessions || []), ns] };
      } else {
        logs.push({ date: showSessionModal, hours: 0, dpps: 0, journal: "", sessions: [ns] });
      }
      return { ...s, dailyLogs: logs };
    });
    
    setShowSessionModal(null);
    setSessionForm({ subjectId: store.subjects[0]?.id || "", topic: "", durationHrs: 1, startTime: "09:00 AM", endTime: "10:00 AM" });
  };

  const delSession = (dStr: string, sessId: string) => {
    updateStore((s: any) => {
      const logs = [...s.dailyLogs];
      const i = logs.findIndex((l: any) => l.date === dStr);
      if (i >= 0) { logs[i] = { ...logs[i], sessions: (logs[i].sessions || []).filter((ss: any) => ss.id !== sessId) }; }
      return { ...s, dailyLogs: logs };
    });
  };

  return (
    <div style={{ animation: "fadeUp 0.4s ease both", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 60 }}>
      {/* MODALS */}
      
      {showSessionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 28, borderRadius: 16, width: "100%", maxWidth: 450, border: "1px solid var(--border-act)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Add Study Block</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>Subject</label>
                <CustomSelect value={sessionForm.subjectId} onChange={(val) => setSessionForm({...sessionForm, subjectId: val})} options={store.subjects.map((s: any) => ({ value: s.id, label: s.name }))} />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>Topic / Notes</label>
                <input autoFocus type="text" value={sessionForm.topic} onChange={e => setSessionForm({...sessionForm, topic: e.target.value})} placeholder="e.g. Arrays, PYQs" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              </div>
              
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>Start Time</label>
                  <input type="text" value={sessionForm.startTime} onChange={e => setSessionForm({...sessionForm, startTime: e.target.value})} placeholder="09:00 AM" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>End Time</label>
                  <input type="text" value={sessionForm.endTime} onChange={e => setSessionForm({...sessionForm, endTime: e.target.value})} placeholder="10:00 AM" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
                </div>
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>Duration (hours)</label>
                <input type="number" step="0.5" value={sessionForm.durationHrs} onChange={e => setSessionForm({...sessionForm, durationHrs: e.target.value as any})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button onClick={() => setShowSessionModal(null)} style={{ flex: 1, padding: "12px", background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddSessionSubmit} style={{ flex: 2, padding: "12px", background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-teal-rgb),0.3)" }}>Add Block</button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 28, borderRadius: 16, width: "100%", maxWidth: 400, border: "1px solid var(--border-act)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Add Daily Task</h3>
            <input autoFocus type="text" value={taskForm} onChange={e => setTaskForm(e.target.value)} placeholder="e.g. Revise formula sheet" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "1rem" }} />
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowTaskModal(false)} style={{ flex: 1, padding: "12px", background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddTaskSubmit} style={{ flex: 2, padding: "12px", background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-blue-rgb),0.3)" }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 28, borderRadius: 16, width: "100%", maxWidth: 400, border: "1px solid var(--border-act)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Add {showGoalModal.type === "week" ? "Weekly" : "Monthly"} Goal</h3>
            <input autoFocus type="text" value={goalForm} onChange={e => setGoalForm(e.target.value)} placeholder="e.g. Complete 50 PYQs" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "1rem" }} />
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowGoalModal(null)} style={{ flex: 1, padding: "12px", background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddGoalSubmit} style={{ flex: 2, padding: "12px", background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-teal-rgb),0.3)" }}>Save Goal</button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["daily", "weekly", "monthly"] as const).map(v => (
            <button key={v} onClick={() => setPlanView(v)} style={{ fontFamily: "var(--font)", fontWeight: 700, fontSize: "0.85rem", padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer", transition: "all 0.2s", background: planView === v ? "var(--color-teal)" : "transparent", color: planView === v ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              {v === "daily" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
              {v === "weekly" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></svg>}
              {v === "monthly" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>}
              {v === "daily" ? "Daily" : v === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {/* DATE NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
          <button onClick={goPrev} style={{ padding: "10px 16px", background: "transparent", border: "none", borderRight: "1px solid var(--border)", borderRadius: "12px 0 0 12px", cursor: "pointer", color: "var(--text)", fontWeight: 800 }}>&lt;</button>
          <div style={{ padding: "10px 24px", fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            {planView === "daily" && <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> {sDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</>}
            {planView === "weekly" && <>{weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
            {planView === "monthly" && <>{sDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</>}
          </div>
          <button onClick={goNext} style={{ padding: "10px 16px", background: "transparent", border: "none", borderLeft: "1px solid var(--border)", borderRadius: "0 12px 12px 0", cursor: "pointer", color: "var(--text)", fontWeight: 800 }}>&gt;</button>
        </div>
        <button onClick={goToday} style={{ padding: "10px 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontWeight: 700, color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          {planView === "daily" ? "Today" : planView === "weekly" ? "This Week" : "This Month"}
        </button>
      </div>

      {/* DAILY VIEW */}
      {planView === "daily" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(var(--color-teal-rgb),0.15)", color: "var(--color-teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Today's Plan</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>Plan your study blocks for today.</p>
                </div>
              </div>
              <button onClick={() => {
                if(store.subjects.length === 0) return alert("Add a subject first!");
                setSessionForm({...sessionForm, subjectId: store.subjects[0].id});
                setShowSessionModal(selDate);
              }} style={{ background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-teal-rgb),0.3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Study Block
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(!todayLog.sessions || todayLog.sessions.length === 0) ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-subtle)", borderRadius: 12 }}>No study sessions planned for today yet.</div>
              ) : (
                todayLog.sessions.map((b: any, i: number) => {
                  const sub = store.subjects.find((s: any) => s.id === b.subjectId);
                  const c1 = sub?.color || "var(--color-teal)";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)" }}>
                      <div style={{ width: 180, fontWeight: 700, fontSize: "0.85rem", color: "var(--text-sub)" }}>{b.startTime} - {b.endTime}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", marginBottom: 8 }}>{b.topic || "Study Session"}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ padding: "4px 10px", background: `${c1}22`, color: c1, borderRadius: 6, fontSize: "0.75rem", fontWeight: 800, border: `1px solid ${c1}55`, display: "flex", alignItems: "center", gap: 4 }}>
                            {sub?.name || "General"}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text)", width: 80, textAlign: "center" }}>{b.durationHrs}h</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => delSession(selDate, b.id)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.1)", color: "#ff6b6b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(var(--color-blue-rgb),0.15)", color: "var(--color-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Tasks / Checklist</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>Keep track of what you want to complete today.</p>
                </div>
              </div>
              <button onClick={() => setShowTaskModal(true)} style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Task
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(!todayLog.tasks || todayLog.tasks.length === 0) ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No tasks for today.</div>
              ) : (
                todayLog.tasks.map((tsk: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div onClick={() => toggleTask(tsk.id)} style={{ cursor: "pointer", width: 20, height: 20, borderRadius: 6, border: tsk.completed ? "none" : "2px solid var(--border-act)", background: tsk.completed ? "var(--color-teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      {tsk.completed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                    <div style={{ flex: 1, fontSize: "0.95rem", fontWeight: 600, color: tsk.completed ? "var(--text-muted)" : "var(--text)", textDecoration: tsk.completed ? "line-through" : "none" }}>{tsk.text}</div>
                    <button onClick={() => {
                      updateStore((s: any) => {
                        const logs = [...s.dailyLogs];
                        const idx = logs.findIndex((l: any) => l.date === selDate);
                        if (idx >= 0 && logs[idx].tasks) logs[idx] = { ...logs[idx], tasks: logs[idx].tasks.filter((t: any) => t.id !== tsk.id) };
                        return { ...s, dailyLogs: logs };
                      });
                    }} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.5)", cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY VIEW */}
      {planView === "weekly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeUp 0.3s ease both" }}>
          
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(var(--color-blue-rgb),0.15)", color: "var(--color-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Weekly Planner</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>Plan your week. Break it down by subjects and tasks.</p>
              </div>
              <button onClick={() => { if(setWpWeekStart) setWpWeekStart(weekStartStr); setShowAddWeek(true); }} style={{ marginLeft: "auto", background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-teal-rgb),0.3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Plan
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150, border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ color: "var(--color-teal)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></div>
                <div><div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Weekly Target</div><div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)", display: "flex", alignItems: "center", borderBottom: "1px dashed var(--text-muted)" }}><input type="number" value={weekTargetHrs} onChange={e => { const val = parseInt(e.target.value) || 0; updateStore((s: any) => { const wps = [...(s.weekPlans || [])]; const idx = wps.findIndex((p: any) => p.weekStart === weekStartStr); if (idx >= 0) { wps[idx] = { ...wps[idx], targetHours: val }; } else { wps.push({ id: Date.now().toString(), weekStart: weekStartStr, targetHours: val, targetDpps: 0, chapterTargets: [], notes: "" }); } return { ...s, weekPlans: wps }; }); }} style={{ width: 45, background: "transparent", border: "none", color: "inherit", fontWeight: "inherit", fontSize: "inherit", fontFamily: "inherit", outline: "none", padding: 0 }} />h</div></div>
              </div>
              <div style={{ flex: 1, minWidth: 150, border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ color: "var(--color-blue)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg></div>
                <div><div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Planned</div><div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)" }}>{weekPlannedHrs}h</div></div>
              </div>
              <div style={{ flex: 1, minWidth: 150, border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ color: "var(--color-teal)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
                <div><div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Completed</div><div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)" }}>{weekCompletedHrs}h</div></div>
              </div>
              <div style={{ flex: 1, minWidth: 150, border: "1px solid var(--border)", borderRadius: 12, padding: "16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ color: "var(--color-amber)" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
                <div><div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Remaining</div><div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text)" }}>{weekRemainingHrs}h</div></div>
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {weekDays.map((d, i) => (
                  <div key={i} style={{ padding: "16px 12px", textAlign: "center", borderRight: i < 6 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)" }}>{d.dayName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-sub)", fontWeight: 600, marginTop: 4 }}>{d.dateFormatted}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-teal)", fontWeight: 700, marginTop: 4 }}>{d.plannedHrs}h planned</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", minHeight: 400 }}>
                {weekDays.map((d, i) => (
                  <div key={i} style={{ padding: "12px", borderRight: i < 6 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: 12 }}>
                    {d.sessions.map((b: any, j: number) => {
                      const sub = store.subjects.find((s: any) => s.id === b.subjectId);
                      const color = sub?.color || "var(--color-teal)";
                      return (
                        <div key={j} style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8, padding: "10px", color: color, position: "relative" }}>
                          <button onClick={() => delSession(d.dateStr, b.id)} style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", color: "currentColor", opacity: 0.5, cursor: "pointer", fontSize: "0.7rem" }}>&times;</button>
                          <div style={{ fontSize: "0.75rem", fontWeight: 800, marginBottom: 2 }}>{sub?.name || "General"}</div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.9 }}>{b.topic || "Study"} ({b.durationHrs}h)</div>
                        </div>
                      )
                    })}
                    <button onClick={() => {
                      if(store.subjects.length === 0) return alert("Add a subject first!");
                      setSessionForm({...sessionForm, subjectId: store.subjects[0].id});
                      setShowSessionModal(d.dateStr);
                    }} style={{ marginTop: "auto", background: "var(--bg-subtle)", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--text-muted)", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, justifyContent: "center", padding: "8px" }}>
                      + Add Block
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>Weekly Subject Targets</h3>
              {(!weekPlan || !weekPlan.chapterTargets || weekPlan.chapterTargets.length === 0) ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No subject targets set for this week. Use the Add Plan button!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {weekPlan.chapterTargets.map((st: any, i: number) => {
                    const sub = store.subjects.find((s: any) => s.id === st.subjectId);
                    if (!sub) return null;
                    const doneCh = sub.chapters.filter((c: any) => st.chapIds.includes(c.id) && c.done).length;
                    const totalCh = st.chapIds.length;
                    const pct = totalCh > 0 ? Math.round((doneCh / totalCh) * 100) : 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 90, fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub.name}>{sub.name}</div>
                        <div style={{ flex: 1, height: 8, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--color-teal)" : sub.color, borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 80, fontSize: "0.8rem", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>{pct}% <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.7rem" }}>({doneCh}/{totalCh})</span></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>Weekly Goals</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => weekPlan ? setShowGoalModal({type: "week", planId: weekPlan.id}) : alert("Please create a Week Plan first!")} style={{ background: "transparent", color: "var(--text)", border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>+ Add Goal</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(!weekPlan?.goals || weekPlan.goals.length === 0) ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No goals added yet.</div>
                ) : (
                  weekPlan.goals.map((g: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={() => toggleGoal("week", weekPlan.id, g.id)} style={{ cursor: "pointer", width: 18, height: 18, borderRadius: 4, border: g.checked ? "none" : "2px solid var(--border-act)", background: g.checked ? "var(--color-teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                        {g.checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: g.checked ? "var(--text-muted)" : "var(--text)", textDecoration: g.checked ? "line-through" : "none", flex: 1 }}>{g.t}</div>
                      <button onClick={() => {
                        updateStore((s: any) => {
                          const wps = [...s.weekPlans];
                          const idx = wps.findIndex((p: any) => p.id === weekPlan.id);
                          if (idx >= 0) { wps[idx].goals = wps[idx].goals.filter((gg: any) => gg.id !== g.id); }
                          return { ...s, weekPlans: wps };
                        });
                      }} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.5)", cursor: "pointer" }}>&times;</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY VIEW */}
      {planView === "monthly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeUp 0.3s ease both" }}>
          
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(var(--color-teal-rgb),0.15)", color: "var(--color-teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>Monthly Planner</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>Plan your month and track subject-wise progress.</p>
                </div>
              </div>
              <button onClick={() => { if(setMpMonth) setMpMonth(`${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, "0")}`); setShowAddMonth(true); }} style={{ background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: "0 4px 12px rgba(var(--color-teal-rgb),0.3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Plan
              </button>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(100px, 1fr))", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <div key={i} style={{ padding: "12px", textAlign: "center", fontWeight: 800, fontSize: "0.85rem", color: "var(--text)", borderRight: i < 6 ? "1px solid var(--border)" : "none" }}>{d}</div>
                ))}
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(100px, 1fr))", gridAutoRows: "minmax(90px, auto)" }}>
                {calendarCells.map((c, i) => {
                  return (
                    <div key={i} onClick={() => {
                        if (c) {
                          setSelDate(c.dateStr);
                          setPlanView("daily");
                        }
                      }} style={{ borderRight: (i + 1) % 7 !== 0 ? "1px solid var(--border)" : "none", borderBottom: i < 28 ? "1px solid var(--border)" : "none", padding: "8px", background: c?.dateStr === selDate ? "var(--bg-subtle)" : "transparent", cursor: c ? "pointer" : "default", transition: "all 0.15s" }}>
                      {c && (
                        <>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: c.dateStr === selDate ? "var(--color-teal)" : "var(--text)", marginBottom: 8, textAlign: "right", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              if(store.subjects.length === 0) return alert("Add a subject first!");
                              setSessionForm({...sessionForm, subjectId: store.subjects[0].id});
                              setShowSessionModal(c.dateStr);
                            }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--border-act)", fontSize: "1.1rem" }}>+</button>
                            {c.dayNum}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {c.sessions.map((sess: any, j: number) => {
                              const sub = store.subjects.find((s: any) => s.id === sess.subjectId);
                              const color = sub?.color || "var(--color-teal)";
                              return (
                                <div key={j} style={{ background: `${color}22`, color: color, border: `1px solid ${color}55`, padding: "4px 6px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={sess.topic}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                                  {sub?.name || "Topic"}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {!c && (
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--border-act)", marginBottom: 8, textAlign: "right" }}></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>Monthly Subject Targets</h3>
              {(!monthPlan || !monthPlan.subjectTargets || monthPlan.subjectTargets.length === 0) ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No subject targets set for this month.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {monthPlan.subjectTargets.map((st: any, i: number) => {
                    const sub = store.subjects.find((s: any) => s.id === st.subjectId);
                    if (!sub) return null;
                    const doneCh = sub.chapters.filter((c: any) => c.done).length;
                    const totalCh = sub.chapters.length;
                    const pct = totalCh > 0 ? Math.round((doneCh / totalCh) * 100) : 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 140, fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub.name}>{sub.name}</div>
                        <div style={{ flex: 1, height: 8, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-blue)", borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 40, fontSize: "0.8rem", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>Monthly Goals</h3>
                <button onClick={() => monthPlan ? setShowGoalModal({type: "month", planId: monthPlan.id}) : alert("Please create a Month Plan first!")} style={{ background: "transparent", color: "var(--text)", border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>+ Add Goal</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(!monthPlan?.goals || monthPlan.goals.length === 0) ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No goals added yet.</div>
                ) : (
                  monthPlan.goals.map((g: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={() => toggleGoal("month", monthPlan.id, g.id)} style={{ cursor: "pointer", width: 18, height: 18, borderRadius: 4, border: g.checked ? "none" : "2px solid var(--border-act)", background: g.checked ? "var(--color-teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                        {g.checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: g.checked ? "var(--text-muted)" : "var(--text)", textDecoration: g.checked ? "line-through" : "none", flex: 1 }}>{g.t}</div>
                      <button onClick={() => {
                        updateStore((s: any) => {
                          const wps = [...s.monthPlans];
                          const idx = wps.findIndex((p: any) => p.id === monthPlan.id);
                          if (idx >= 0) { wps[idx].goals = wps[idx].goals.filter((gg: any) => gg.id !== g.id); }
                          return { ...s, monthPlans: wps };
                        });
                      }} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.5)", cursor: "pointer" }}>&times;</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function CompetitiveExamPlanner({ onSwitchMode }: { onSwitchMode?: () => void }) {
  const router = useRouter();
  const [store, setStore] = useState<ExamStore>(DEFAULT_STORE);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "subjects" | "daily" | "tests" | "plans" | "tracker">("dashboard");
  const [selDate, setSelDate] = useState(today());
  const [showAddSub, setShowAddSub] = useState(false);
  const now = new Date();
  const initialDashYear = now.getFullYear();
  const initialDashMonth = now.getMonth();
  const initialDashWeek = getWeekIndexForDate(getWeeksInMonth(initialDashYear, initialDashMonth), now);
  const [dashYear, setDashYear] = useState(initialDashYear);
  const [dashMonth, setDashMonth] = useState(initialDashMonth);
  const [dashWeek, setDashWeek] = useState(initialDashWeek);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [testFilterSubId, setTestFilterSubId] = useState<string>("all");
  const toggleSubjectExpand = (subId: string) => setExpandedSubjects(prev => { const ns = new Set(prev); ns.has(subId) ? ns.delete(subId) : ns.add(subId); return ns; });
  // Suppress realtime echo from our own saves to prevent checkbox flicker
  const localSavingRef = useRef(false);
  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plan state
  const [planView, setPlanView] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAddDaily, setShowAddDaily] = useState(false);
  const [dpDate, setDpDate] = useState(today());
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [showAddMonth, setShowAddMonth] = useState(false);
  // Week plan form
  const [wpWeekStart, setWpWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDateString(d); });
  const [wpTargetHours, setWpTargetHours] = useState(0);
  const [wpTargetDpps, setWpTargetDpps] = useState(0);
  const [wpNotes, setWpNotes] = useState("");
  const [wpChapSel, setWpChapSel] = useState<Record<string, Set<string>>>({});
  // Month plan form
  const [mpMonth, setMpMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [mpSubTargets, setMpSubTargets] = useState<{ subjectId: string; chapCount: number }[]>([]);
  const [mpNotes, setMpNotes] = useState("");
  const [newTestSubId, setNewTestSubId] = useState("");
  const [newTestType, setNewTestType] = useState(TEST_TYPES[0]);
  const [newTestScore, setNewTestScore] = useState("");
  const [newTestMax, setNewTestMax] = useState("100");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");

    let channel: any = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); setShowSetup(true); return; }
      const uid_str = session.user.id;
      setUserId(uid_str);
      const userKey = STORAGE_KEY + "-" + uid_str;

      // Always load from DB first — DB is the source of truth
      loadExam(uid_str).then(dbStore => {
        if (dbStore && dbStore.examName) {
          // ✓ DB has data — use it and cache it locally
          setStore(dbStore as ExamStore);
          try { localStorage.setItem(userKey, JSON.stringify(dbStore)); } catch (e) { }
          setLoading(false);
        } else {
          // DB is empty — check if there's local data to migrate to DB
          try {
            const raw = localStorage.getItem(userKey);
            if (raw) {
              const ls = JSON.parse(raw) as ExamStore;
              if (ls && ls.examName) {
                // Migrate localStorage → DB
                setStore(ls);
                saveExam(uid_str, ls).then(() => {
                  console.log("[ExamPlanner] Migrated localStorage data → Supabase");
                });
              } else {
                setShowSetup(true);
              }
            } else {
              // No data anywhere — fresh setup
              setShowSetup(true);
            }
          } catch (e) { setShowSetup(true); }
          setLoading(false);
        }
      }).catch(() => {
        // DB fetch failed — fall back to localStorage cache
        try {
          const raw = localStorage.getItem(userKey);
          if (raw) { const ls = JSON.parse(raw); if (ls?.examName) setStore(ls); else setShowSetup(true); }
          else setShowSetup(true);
        } catch (e) { setShowSetup(true); }
        setLoading(false);
      });

      // Real-time sync: if data changes from ANOTHER device/tab, update state
      channel = supabase.channel("exam-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "exam_store", filter: `user_id=eq.${uid_str}` }, (payload: any) => {
          // Skip if we triggered this save ourselves (prevents checkbox flicker)
          if (localSavingRef.current) return;
          if (payload.new?.store) {
            setStore(payload.new.store);
            try { localStorage.setItem(userKey, JSON.stringify(payload.new.store)); } catch (e) { }
          }
        }).subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const updateStore = useCallback((fn: (s: ExamStore) => ExamStore) => {
    setStore(p => {
      const next = fn(p);
      // Always save to DB (primary store)
      if (userId) {
        // Mark as local save so realtime echo is ignored
        localSavingRef.current = true;
        if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
        localSaveTimer.current = setTimeout(() => { localSavingRef.current = false; }, 3000);
        saveExam(userId, next);
        // Also cache locally for fast reload
        try { localStorage.setItem(STORAGE_KEY + "-" + userId, JSON.stringify(next)); } catch (e) { }
      } else {
        // Not logged in — save only to localStorage as temporary
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { }
      }
      return next;
    });
  }, [userId]);


  if (loading) return <div style={{ height: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.9rem", letterSpacing: "0.05em" }}>Loading...</div>;

  if (showSetup || !store.examName) {
    return <SetupWizard onDone={s => { setStore(s); setShowSetup(false); updateStore(() => s); }} onCancel={onSwitchMode} />;
  }

  // ── Computed Stats ──
  const todayLog = store.dailyLogs.find(l => l.date === selDate) || { date: selDate, hours: 0, dpps: 0, journal: "" };
  const validLogDates = store.dailyLogs
    .map(l => new Date(l.date))
    .filter(d => !Number.isNaN(d.getTime()));
  const startBoundary = validLogDates.length > 0
    ? new Date(Math.min(...validLogDates.map(d => d.getTime())))
    : new Date();
  const endBoundaryRaw = new Date(store.examDate);
  const endBoundary = Number.isNaN(endBoundaryRaw.getTime()) ? new Date() : endBoundaryRaw;
  const rangeStart = startBoundary <= endBoundary ? startBoundary : endBoundary;
  const rangeEnd = startBoundary <= endBoundary ? endBoundary : startBoundary;
  const monthRange = buildMonthRange(rangeStart, rangeEnd);
  const availableMonths = monthRange.length > 0 ? monthRange : [{ year: now.getFullYear(), month: now.getMonth() }];
  const availableYears = Array.from(new Set(availableMonths.map(m => m.year)));
  const monthExists = availableMonths.some(m => m.year === dashYear && m.month === dashMonth);
  const activeDashYear = monthExists ? dashYear : availableMonths[0].year;
  const monthsInActiveYear = availableMonths.filter(m => m.year === activeDashYear);
  const activeDashMonth = monthExists ? dashMonth : monthsInActiveYear[0].month;

  const dashWeeks = getWeeksInMonth(activeDashYear, activeDashMonth);
  const safeDashWeek = Math.min(dashWeek, Math.max(0, dashWeeks.length - 1));
  const selectedWeekDates = dashWeeks[safeDashWeek] ?? [];
  const selectedMonthLogs = store.dailyLogs.filter(l => {
    const d = new Date(l.date);
    return d.getFullYear() === activeDashYear && d.getMonth() === activeDashMonth;
  });
  const selectedWeekHours = selectedWeekDates.reduce((sum, d) => {
    const h = store.dailyLogs.find(l => l.date === dateKey(d))?.hours || 0;
    return sum + h;
  }, 0);
  const selectedMonthHours = selectedMonthLogs.reduce((sum, l) => sum + l.hours, 0);
  const monthlyWeekHours = dashWeeks.map(week => week.reduce((sum, d) => sum + (store.dailyLogs.find(l => l.date === dateKey(d))?.hours || 0), 0));
  const avgDailyHrs = selectedMonthLogs.length ? (selectedMonthHours / selectedMonthLogs.length).toFixed(1) : "0.0";
  const totalChaps = store.subjects.reduce((a, s) => a + s.chapters.length, 0);
  const doneChaps = store.subjects.reduce((a, s) => a + s.chapters.filter(c => c.done).length, 0);
  const sylPct = totalChaps === 0 ? 0 : Math.round((doneChaps / totalChaps) * 100);
  const totalDpps = store.dailyLogs.reduce((a, l) => a + l.dpps, 0);
  const allScores = store.testScores;
  const avgTestScore = allScores.length ? Math.round(allScores.reduce((a, t) => a + (t.score / t.maxScore) * 100, 0) / allScores.length) : 0;
  const dl = daysLeft(store.examDate);
  const urgencyGrad = dl < 30 ? "linear-gradient(135deg,#ff6b6b,#ffa94d)" : dl < 90 ? "linear-gradient(135deg,#ffa94d,var(--color-teal))" : "linear-gradient(135deg,var(--color-teal),#4A90FF)";

  const setDayField = (field: keyof DailyLog, val: any) => {
    updateStore(s => {
      const idx = s.dailyLogs.findIndex(l => l.date === selDate);
      const newLog = { ...todayLog, [field]: val };
      if (idx >= 0) { const nl = [...s.dailyLogs]; nl[idx] = newLog; return { ...s, dailyLogs: nl }; }
      return { ...s, dailyLogs: [...s.dailyLogs, newLog] };
    });
  };

  const addSubject = (sub: Subject) => updateStore(s => ({ ...s, subjects: [...s.subjects, sub] }));
  const updateChapter = (subId: string, chId: string, updates: Partial<Chapter>) => {
    updateStore(s => ({
      ...s,
      subjects: s.subjects.map(sub => {
        if (sub.id !== subId) return sub;
        return {
          ...sub,
          chapters: sub.chapters.map(ch => ch.id === chId ? { ...ch, ...updates } : ch)
        };
      })
    }));
  };

  const updateSubject = (id: string, updates: Partial<Subject>) => {
    updateStore(s => ({
      ...s,
      subjects: s.subjects.map(sub => sub.id === id ? { ...sub, ...updates } : sub)
    }));
  };

  const deleteSubject = (id: string) => updateStore(s => ({ ...s, subjects: s.subjects.filter(sub => sub.id !== id) }));
  const toggleChapter = (subId: string, chId: string) => {
    updateStore(s => ({ ...s, subjects: s.subjects.map(sub => sub.id !== subId ? sub : { ...sub, chapters: sub.chapters.map(ch => ch.id !== chId ? ch : { ...ch, done: !ch.done }) }) }));
  };
  const addTestScore = () => {
    if (!newTestSubId || !newTestScore) return;
    updateStore(s => ({ ...s, testScores: [...s.testScores, { id: uid(), date: today(), subjectId: newTestSubId, testType: newTestType, score: Number(newTestScore), maxScore: Number(newTestMax) }] }));
    setNewTestScore("");
  };

  const tabIcons: Record<string, React.ReactNode> = {
    dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
    subjects: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
    daily: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    tests: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg>,
    plans: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    tracker: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
  };

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "subjects", label: "Subjects" },
    { id: "daily", label: "Daily Log" },
    { id: "tests", label: "Test Scores" },
    { id: "plans", label: "Planner" },
    { id: "tracker", label: "Test Tracker" },
  ];

  return (
    <div className="exam-planner-theme" style={{ height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "var(--font)", color: "var(--text)", display: "flex" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 20px rgba(var(--color-teal-rgb),0.3)}50%{box-shadow:0 0 40px rgba(var(--color-teal-rgb),0.6)}}
        @keyframes timerPulse{0%,100%{opacity:0.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}}
        .ep-tab:hover{color:var(--text)!important}
        .ep-stat:hover{border-color:rgba(var(--color-teal-rgb),0.4)!important;transform:translateY(-2px)}
        .ep-sub-btn:hover{border-color:var(--color-teal)!important;color:var(--color-teal)!important}
        .ep-input:focus{border-color:rgba(var(--color-teal-rgb),0.5)!important;outline:none!important}
        .ep-hide-scrollbar::-webkit-scrollbar { display: none; }
        @media (max-width: 680px) {
          .ep-header-wrap { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .ep-header-actions { flex-wrap: wrap !important; justify-content: flex-start !important; }
        }
        @media (max-width: 480px) {
          .ep-calendar-popup {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 280px !important;
            padding: 12px 14px !important;
          }
        }
        .ep-grid-2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .ep-grid-3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .ep-grid-sidebar { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
        @media (min-width: 640px) {
          .ep-grid-2 { grid-template-columns: 1fr 1fr; }
          .ep-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
        }
        @media (min-width: 900px) {
          .ep-grid-sidebar { grid-template-columns: 380px 1fr; }
        }
      `}</style>

      {/* SIDEBAR BACKDROP FOR MOBILE */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 9998,
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`ep-sidebar ${mobileMenuOpen ? "open" : ""}`} style={{ width: 240, background: "var(--sidebar-bg)", height: "100vh", display: "flex", flexDirection: "column", flexShrink: 0, padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, padding: "0 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/icons/icon-192.png" alt="LifeStack Logo" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--sidebar-text)", lineHeight: 1.1 }}>{store.examName}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--sidebar-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Planner</div>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="ep-close-drawer-btn" style={{ background: "rgba(255, 255, 255, 0.08)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--sidebar-text)", cursor: "pointer", padding: "6px", display: "none", alignItems: "center", justifyContent: "center" }} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileMenuOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 12, background: isActive ? "var(--bg-hover)" : "transparent",
                border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer", transition: "all 0.2s",
                color: isActive ? "var(--sidebar-text)" : "var(--sidebar-muted)", fontWeight: isActive ? 700 : 600, fontSize: "0.85rem", textAlign: "left"
              }}>
                <span style={{ opacity: isActive ? 1 : 0.6 }}>{tabIcons[t.id]}</span>
                {t.label}
              </button>
            )
          })}
        </nav>

        <div style={{ marginTop: "auto", padding: "16px 8px" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-teal)", marginBottom: 4 }}>•</div>
          <div style={{ fontSize: "0.7rem", color: "var(--sidebar-muted)", fontStyle: "italic", lineHeight: 1.4 }}>"Consistent progress beats perfect plans."</div>
        </div>
      </aside>

      <div className="ep-main-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
      {/* ── Header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, padding: "12px 20px 0 20px", background: "var(--bg-card)", backdropFilter: "blur(20px)" }}>
        <div className="ep-header-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="ep-hamburger-btn"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                padding: "6px 10px",
                cursor: "pointer",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button onClick={() => router.push("/choose")} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font)", fontSize: "0.72rem", fontWeight: 600, transition: "all 0.18s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-teal)"; (e.currentTarget as HTMLElement).style.color = "var(--color-teal)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
              ← Home
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/icons/icon-192.png" alt="LifeStack Logo" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: "1.3rem", color: "var(--color-teal)" }}>{store.examName}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Exam Planner</span>
                </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> {store.examDate}</span>
                <span>·</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg> {store.targetHours}h/day target</span>
                <span>·</span>
                <span style={{ color: sylPct >= 80 ? "var(--color-teal)" : sylPct >= 50 ? "#FF8C00" : "var(--color-teal)" }}>{sylPct}% syllabus done</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ep-header-actions" style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 60 }}>
          <Countdown examDate={store.examDate} />
          <button onClick={() => { 
            if (window.confirm("Are you sure you want to reset everything? All your subjects, logs, and test scores will be permanently deleted.")) {
              updateStore(() => DEFAULT_STORE);
              setShowSetup(true);
            }
          }} title="Reset Progress" style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: 8, padding: "0 14px", height: 34, display: "flex", alignItems: "center", gap: 6, color: "#ff6b6b", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,107,107,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,107,107,0.1)"}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 102.6-6.4L2 9" /></svg>
            Reset
          </button>
        </div>
        </div>

      </header>

      <main className="ep-main-content" style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>

            {/* ── ROW 1: Stats (all 6 in one row) ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
              {[
                { label: "This Week", val: selectedWeekHours.toFixed(1), unit: "hrs", color: "#4A90FF", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> },
                { label: "This Month", val: selectedMonthHours.toFixed(1), unit: "hrs", color: "#9e7dff", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg> },
                { label: "Avg Daily", val: avgDailyHrs, unit: "hrs", color: "#28D7FF", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> },
                { label: "Total DPPs", val: totalDpps, unit: "qs", color: "#7f8cff", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7f8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg> },
                { label: "Syllabus", val: sylPct, unit: "%", color: "var(--color-teal)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg> },
                { label: "Test Avg", val: avgTestScore, unit: "%", color: "#ffa94d", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa94d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg> },
              ].map(s => (
                <div key={s.label} className="ep-stat" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s", cursor: "default", minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{s.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.58rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{s.label}</div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.val}<span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: 3 }}>{s.unit}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dashboard selectors */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <select value={activeDashYear} onChange={e => {
                const y = Number(e.target.value);
                setDashYear(y);
                const firstMonthInYear = availableMonths.find(m => m.year === y)?.month ?? 0;
                setDashMonth(firstMonthInYear);
                setDashWeek(0);
              }}
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.8rem", fontWeight: 700, padding: "7px 12px", cursor: "pointer" }}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
                {monthsInActiveYear.map(({ month }) => (
                  <button key={`${activeDashYear}-${month}`} onClick={() => { setDashYear(activeDashYear); setDashMonth(month); setDashWeek(0); }}
                    style={{ fontFamily: "var(--font)", fontSize: "0.7rem", fontWeight: 700, padding: "5px 9px", borderRadius: 7, border: "1px solid", borderColor: activeDashMonth === month ? "var(--color-teal)" : "var(--border)", background: activeDashMonth === month ? "rgba(var(--color-teal-rgb),0.14)" : "transparent", color: activeDashMonth === month ? "var(--color-teal)" : "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {MONTHS[month]}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
                {dashWeeks.map((w, i) => (
                  <button key={i} onClick={() => setDashWeek(i)}
                    style={{ fontFamily: "var(--font)", fontSize: "0.68rem", fontWeight: 700, padding: "5px 8px", borderRadius: 7, border: "1px solid", borderColor: safeDashWeek === i ? "var(--color-teal)" : "var(--border)", background: safeDashWeek === i ? "rgba(var(--color-teal-rgb),0.14)" : "transparent", color: safeDashWeek === i ? "var(--color-teal)" : "var(--text-muted)", cursor: "pointer" }}>
                    W{i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* ── ROW 2: 3 Charts side-by-side ── */}
            <div className="ep-grid-3" style={{ gap: 10, marginBottom: 14 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 10px" }}>
                <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>Week {safeDashWeek + 1}</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>· daily study hours</span>
                </div>
                <div style={{ height: 148 }}><WeeklyBarChart logs={store.dailyLogs} dates={selectedWeekDates} /></div>
                <div style={{ marginTop: 8, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  Total weekly hours: <strong style={{ color: "var(--color-teal)" }}>{selectedWeekHours.toFixed(1)}h</strong>
                </div>
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 10px" }}>
                <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>{MONTHS[activeDashMonth]} {activeDashYear}</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>· weekly study hours (W1..)</span>
                </div>
                <div style={{ height: 180 }}><MonthlyStudyHoursLineChart weekHours={monthlyWeekHours} weekLabels={dashWeeks.map((_, i) => `W${i + 1}`)} activeWeekIdx={safeDashWeek} /></div>
                <div style={{ marginTop: 8, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  Total monthly hours: <strong style={{ color: "var(--color-teal)" }}>{selectedMonthHours.toFixed(1)}h</strong>
                </div>
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 10px" }}>
                <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 6, justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>Activity</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>· 91 day heatmap</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>less</span>
                    {['var(--border)', 'rgba(var(--color-teal-rgb),0.2)', 'rgba(var(--color-teal-rgb),0.55)', 'var(--color-teal)'].map((c, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />)}
                    <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>more</span>
                  </div>
                </div>
                <div style={{ height: 148 }}><HeatMapChart logs={store.dailyLogs} /></div>
              </div>
            </div>

            {/* Syllabus Progress Overview */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>Syllabus Overview</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{doneChaps}/{totalChaps} chapters done</span>
              </div>
              {store.subjects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>No subjects added yet. Go to Subjects tab to add some!</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>Subject</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Lec</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Notes</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Short Notes</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>DPP</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>PYQs</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Test</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Rev</th>
                        <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.subjects.map(sub => {
                        const isExpanded = expandedSubjects.has(sub.id);
                        const chDone = sub.chapters.filter(c => c.done).length;
                        return (
                          <React.Fragment key={sub.id}>
                            {/* ── Subject Row ── */}
                            <tr style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border)", background: sub.subjectDone ? "rgba(105,219,122,0.05)" : "transparent", transition: "background 0.2s" }}>
                              <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: sub.subjectDone ? 500 : 700, color: sub.subjectDone ? "var(--text-muted)" : "var(--text)", textDecoration: sub.subjectDone ? "line-through" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sub.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0 }}>{sub.name}</span>
                                {sub.chapters.length > 0 && (
                                  <button onClick={() => toggleSubjectExpand(sub.id)} title={isExpanded ? "Collapse chapters" : "Expand chapters"}
                                    style={{ background: isExpanded ? `${sub.color}22` : "var(--bg-subtle)", border: `1px solid ${isExpanded ? sub.color + "55" : "var(--border)"}`, borderRadius: 5, cursor: "pointer", padding: "2px 6px", display: "flex", alignItems: "center", gap: 4, color: isExpanded ? sub.color : "var(--text-muted)", fontSize: "0.65rem", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.18s" }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
                                    {chDone}/{sub.chapters.length}
                                  </button>
                                )}
                              </td>
                              {['lec', 'notes', 'shortnotes', 'dpps', 'pyqs', 'test'].map(field => {
                                const isChecked = !!sub[field as keyof Subject];
                                return (
                                  <td key={field} style={{ textAlign: "center", padding: "12px 8px" }}>
                                    <div onClick={() => updateSubject(sub.id, { [field]: !isChecked })} style={{ width: 18, height: 18, margin: "0 auto", borderRadius: 5, border: `2px solid ${isChecked ? sub.color : "var(--border-act)"}`, background: isChecked ? sub.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                                      {isChecked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: "center", padding: "12px 8px" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--bg-subtle)", padding: "2px", borderRadius: 6, border: "1px solid var(--border)" }}>
                                  <button onClick={() => updateSubject(sub.id, { revs: Math.max(0, (sub.revs || 0) - 1) })} style={{ width: 22, height: 22, borderRadius: 4, background: "var(--bg-card)", border: "none", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem" }}>-</button>
                                  <span style={{ fontSize: "0.8rem", fontWeight: 700, width: 14, textAlign: "center" }}>{sub.revs || 0}</span>
                                  <button onClick={() => updateSubject(sub.id, { revs: (sub.revs || 0) + 1 })} style={{ width: 22, height: 22, borderRadius: 4, background: "var(--bg-card)", border: "none", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem" }}>+</button>
                                </div>
                              </td>
                              <td style={{ textAlign: "center", padding: "12px 8px" }}>
                                <div onClick={() => updateSubject(sub.id, { subjectDone: !sub.subjectDone })} style={{ width: 20, height: 20, margin: "0 auto", borderRadius: 6, border: `2px solid ${sub.subjectDone ? "var(--color-teal)" : "var(--border-act)"}`, background: sub.subjectDone ? "var(--color-teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                                  {sub.subjectDone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                              </td>
                            </tr>

                            {/* ── Chapter Rows (expanded) ── */}
                            {isExpanded && sub.chapters.map((ch, chIdx) => (
                              <tr key={ch.id} style={{ borderBottom: chIdx === sub.chapters.length - 1 ? "1px solid var(--border)" : `1px solid var(--bg-subtle)`, background: ch.done ? `${sub.color}0d` : `${sub.color}05` }}>
                                <td style={{ padding: "7px 8px 7px 26px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 7 }}>
                                  <div style={{ width: 1, height: 14, background: `${sub.color}55`, flexShrink: 0 }} />
                                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sub.color, opacity: 0.6, flexShrink: 0 }} />
                                  <span style={{ color: ch.done ? "var(--text-muted)" : "var(--text-sub)", textDecoration: ch.done ? "line-through" : "none", fontWeight: ch.done ? 400 : 500, flex: 1, minWidth: 0 }}>{ch.name}</span>
                                </td>
                                {/* Lec, Notes, Short Notes */}
                                {(['lec', 'notes', 'shortnotes'] as const).map(field => {
                                  const isChecked = !!(ch as any)[field];
                                  return (
                                    <td key={field} style={{ textAlign: "center", padding: "7px 8px" }}>
                                      <div onClick={() => updateChapter(sub.id, ch.id, { [field]: !isChecked })} style={{ width: 15, height: 15, margin: "0 auto", borderRadius: 4, border: `2px solid ${isChecked ? sub.color : "var(--border-act)"}`, background: isChecked ? sub.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                                        {isChecked && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                      </div>
                                    </td>
                                  );
                                })}
                                {/* DPP counter */}
                                <td style={{ textAlign: "center", padding: "7px 4px" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <button onClick={() => updateChapter(sub.id, ch.id, { dpps: Math.max(0, (ch.dpps || 0) - 1) })} style={{ width: 16, height: 16, borderRadius: 3, background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 700, minWidth: 16, textAlign: "center", color: (ch.dpps || 0) > 0 ? sub.color : "var(--text-muted)" }}>{ch.dpps || 0}</span>
                                    <button onClick={() => updateChapter(sub.id, ch.id, { dpps: (ch.dpps || 0) + 1 })} style={{ width: 16, height: 16, borderRadius: 3, background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                  </div>
                                </td>
                                {/* PYQs, Test */}
                                {(['pyqs', 'test'] as const).map(field => {
                                  const isChecked = !!(ch as any)[field];
                                  return (
                                    <td key={field} style={{ textAlign: "center", padding: "7px 8px" }}>
                                      <div onClick={() => updateChapter(sub.id, ch.id, { [field]: !isChecked })} style={{ width: 15, height: 15, margin: "0 auto", borderRadius: 4, border: `2px solid ${isChecked ? sub.color : "var(--border-act)"}`, background: isChecked ? sub.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                                        {isChecked && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                      </div>
                                    </td>
                                  );
                                })}
                                {/* Rev counter */}
                                <td style={{ textAlign: "center", padding: "7px 4px" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <button onClick={() => updateChapter(sub.id, ch.id, { rev: Math.max(0, (ch.rev || 0) - 1) })} style={{ width: 16, height: 16, borderRadius: 3, background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{ch.rev || 0}</span>
                                    <button onClick={() => updateChapter(sub.id, ch.id, { rev: (ch.rev || 0) + 1 })} style={{ width: 16, height: 16, borderRadius: 3, background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                  </div>
                                </td>
                                {/* Done (chapter done toggle) */}
                                <td style={{ textAlign: "center", padding: "7px 8px" }}>
                                  <div onClick={() => toggleChapter(sub.id, ch.id)} style={{ width: 16, height: 16, margin: "0 auto", borderRadius: 4, border: `2px solid ${ch.done ? sub.color : "var(--border-act)"}`, background: ch.done ? sub.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                                    {ch.done && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Test Scores */}
            {store.testScores.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 14 }}>Recent Tests</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...store.testScores].reverse().slice(0, 5).map(ts => {
                    const sub = store.subjects.find(s => s.id === ts.subjectId);
                    const pct = Math.round((ts.score / ts.maxScore) * 100);
                    return (
                      <div key={ts.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 9 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{ts.testType}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{sub?.name || "Unknown"} · {ts.date}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{ts.score}/{ts.maxScore}</div>
                          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: pct >= 70 ? "var(--color-teal)" : pct >= 40 ? "#ffa94d" : "#ff6b6b" }}>{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUBJECTS ── */}
        {activeTab === "subjects" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem" }}>Your Subjects</h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{store.subjects.length} subjects · {doneChaps}/{totalChaps} chapters done · {sylPct}% complete</p>
              </div>
              <button onClick={() => setShowAddSub(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,var(--color-teal),#4A90FF)", border: "none", borderRadius: 9, color: "var(--sidebar-text)", padding: "10px 20px", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 700, fontSize: "0.85rem", boxShadow: "0 4px 20px rgba(var(--color-teal-rgb),0.35)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Add Subject
              </button>
            </div>

            {store.subjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-act)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg></div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8, color: "var(--text-sub)" }}>No subjects yet</div>
                <div style={{ fontSize: "0.85rem" }}>Add your exam subjects with chapters and set completion deadlines</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
                gap: 14,
                alignItems: "start"
              }}>
                {store.subjects.map(sub => (
                  <SubjectCard key={sub.id} sub={sub}
                    onToggleChapter={chId => toggleChapter(sub.id, chId)}
                    onUpdateChapter={(chId, updates) => updateChapter(sub.id, chId, updates)}
                    onUpdateSubject={u => updateSubject(sub.id, u)}
                    onDelete={() => deleteSubject(sub.id)} />
                ))}
              </div>
            )}

          </div>
        )}

        {/* ── DAILY LOG ── */}{activeTab === "daily" && (
          <div style={{ animation: "fadeUp 0.4s ease both", display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Top Bar: Logging for */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", padding: "12px 20px", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8, color: "var(--text)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  Logging for:
                </span>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <button onClick={() => { const d = new Date(selDate); d.setDate(d.getDate() - 1); setSelDate(localDateString(d)); }} style={{ padding: "8px 12px", background: "var(--bg-subtle)", border: "none", borderRight: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontWeight: 800, borderRadius: "8px 0 0 8px" }}>&lt;</button>
                  <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", background: "transparent", minWidth: 160, textAlign: "center" }}>
                    <CustomDatePicker value={selDate} onChange={setSelDate} bare />
                  </div>
                  <button onClick={() => { const d = new Date(selDate); d.setDate(d.getDate() + 1); setSelDate(localDateString(d)); }} style={{ padding: "8px 12px", background: "var(--bg-subtle)", border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontWeight: 800, borderRadius: "0 8px 8px 0" }}>&gt;</button>
                </div>
              </div>
              <button onClick={() => setSelDate(today())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontWeight: 700, cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> Today
              </button>
            </div>

            {/* ROW 1: Study & DPPs */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
              
              {/* Today's Study */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(var(--color-teal-rgb),0.15)", color: "var(--color-teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>Today's Study</h3>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Enter the total time you studied today</p>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-teal)", background: "rgba(var(--color-teal-rgb),0.1)", padding: "6px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Daily Target: {store.targetHours || 8} hours
                  </div>
                </div>

                <div style={{ display: "flex", gap: 40, marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Hours</div>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                        <button onClick={() => { const m = Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60); setDayField("hours", Math.max(0, Math.floor(todayLog.hours || 0) - 1) + m / 60); }} style={{ padding: "12px 16px", background: "transparent", border: "none", borderRight: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontSize: "1.2rem", fontWeight: 800 }}>-</button>
                        <input type="number" min="0" value={Math.floor(todayLog.hours || 0)} onChange={e => { const m = Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60); setDayField("hours", Number(e.target.value) + m / 60); }} style={{ width: 60, textAlign: "center", fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", background: "transparent", border: "none", outline: "none", padding: 0 }} />
                        <button onClick={() => { const m = Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60); setDayField("hours", Math.floor(todayLog.hours || 0) + 1 + m / 60); }} style={{ padding: "12px 16px", background: "transparent", border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontSize: "1.2rem", fontWeight: 800 }}>+</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Minutes</div>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                        <button onClick={() => { const h = Math.floor(todayLog.hours || 0); const m = Math.round(((todayLog.hours || 0) - h) * 60); setDayField("hours", h + Math.max(0, m - 5) / 60); }} style={{ padding: "12px 16px", background: "transparent", border: "none", borderRight: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontSize: "1.2rem", fontWeight: 800 }}>-</button>
                        <input type="number" min="0" max="59" value={Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60)} onChange={e => { const h = Math.floor(todayLog.hours || 0); setDayField("hours", h + Number(e.target.value) / 60); }} style={{ width: 60, textAlign: "center", fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", background: "transparent", border: "none", outline: "none", padding: 0 }} />
                        <button onClick={() => { const h = Math.floor(todayLog.hours || 0); const m = Math.round(((todayLog.hours || 0) - h) * 60); setDayField("hours", h + Math.min(59, m + 5) / 60); }} style={{ padding: "12px 16px", background: "transparent", border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer", color: "var(--text)", fontSize: "1.2rem", fontWeight: 800 }}>+</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, borderLeft: "1px dashed var(--border)", paddingLeft: 40 }}>
                    <div style={{ color: "var(--color-teal)" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>Total Study Time</div>
                      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--text)" }}>
                        {Math.floor(todayLog.hours || 0)}h {Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60)}m
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar line */}
                <div style={{ position: "relative", marginBottom: 20 }}>
                  <div style={{ height: 12, background: "var(--bg-subtle)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (todayLog.hours / (store.targetHours || 8)) * 100)}%`, background: "var(--color-teal)", borderRadius: 6, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ position: "absolute", top: -8, right: 0, fontSize: "0.75rem", fontWeight: 800, color: "var(--text)" }}>
                    {((todayLog.hours / (store.targetHours || 8)) * 100).toFixed(2)}%
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ color: "var(--color-teal)" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Remaining</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{Math.max(0, (store.targetHours || 8) - todayLog.hours).toFixed(1).replace('.0','')}h {Math.max(0, (store.targetHours || 8) - todayLog.hours) % 1 > 0 ? Math.round((Math.max(0, (store.targetHours || 8) - todayLog.hours) % 1) * 60) + 'm' : ''}</div>
                    </div>
                  </div>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ color: "var(--color-teal)" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Daily Target</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{store.targetHours || 8}h</div>
                    </div>
                  </div>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ color: "var(--color-teal)" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Progress</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{((todayLog.hours / (store.targetHours || 8)) * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>

                <button style={{ width: "100%", padding: "14px", background: "var(--color-teal)", color: "#fff", border: "none", borderRadius: 10, fontSize: "1rem", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 14px rgba(var(--color-teal-rgb),0.3)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  Save Study Hours
                </button>
              </div>

              {/* DPPs & Practice */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(var(--color-blue-rgb),0.15)", color: "var(--color-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>DPPs & Practice</h3>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>Track questions solved today</p>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", background: "var(--bg)", padding: "6px 12px", borderRadius: 20, border: "1px solid var(--border)" }}>
                    Total all time: {totalDpps}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setDayField("dpps", Math.max(0, todayLog.dpps - 1))} style={{ width: 50, height: 50, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: "1.5rem", cursor: "pointer" }}>-</button>
                    <div style={{ fontSize: "3rem", fontWeight: 900, color: "var(--text)", width: 80, textAlign: "center" }}>{todayLog.dpps.toString().padStart(2, '0')}</div>
                    <button onClick={() => setDayField("dpps", todayLog.dpps + 1)} style={{ width: 50, height: 50, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: "1.5rem", cursor: "pointer" }}>+</button>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-sub)", marginLeft: 4 }}>qs</span>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "var(--color-amber-soft)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ color: "var(--color-amber)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-amber)" }}>Today's Goal</span>
                      </div>
                      <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>20 qs</span>
                    </div>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ color: "var(--color-teal)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg></div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-teal)" }}>Today's Progress</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 60, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (todayLog.dpps / 20) * 100)}%`, height: "100%", background: "var(--color-teal)" }} />
                        </div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{Math.round((todayLog.dpps / 20) * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ background: "rgba(var(--color-teal-rgb), 0.05)", border: "1px dashed var(--color-teal)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 12 }}>
                      <div style={{ color: "var(--color-teal)", marginTop: 2 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"></path><polyline points="16 6 23 6 23 13"></polyline></svg></div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text)" }}>Keep solving!</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Practice makes perfect.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: Sessions & Reflection */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20 }}>
              
              <DailySessionsManager store={store} selDate={selDate} todayLog={todayLog} updateStore={updateStore} />

              {/* Daily Reflection */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(var(--color-teal-rgb),0.15)", color: "var(--color-teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>Daily Reflection</h3>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>What did you study today? Topics covered, struggles, breakthroughs...</p>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", marginBottom: 20 }}>
                  <textarea
                    value={todayLog.journal}
                    onChange={e => setDayField("journal", e.target.value)}
                    placeholder="Today's reflection... e.g. Finished Calculus topics, faced issues in Integration substitution..."
                    style={{ flex: 1, minHeight: 120, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, color: "var(--text)", fontFamily: "var(--font)", fontSize: "0.85rem", resize: "none", outline: "none", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "var(--color-teal)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                  />
                  <div style={{ position: "absolute", bottom: 12, right: 12 }}>
                    <button style={{ background: "rgba(var(--color-teal-rgb),0.1)", color: "var(--color-teal)", border: "1px solid rgba(var(--color-teal-rgb),0.3)", borderRadius: 8, padding: "6px 12px", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Reflection
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={{ background: "rgba(var(--color-amber-rgb), 0.08)", border: "1px solid rgba(var(--color-amber-rgb), 0.15)", borderRadius: 10, padding: 12, display: "flex", gap: 10 }}>
                    <div style={{ color: "var(--color-amber)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path></svg></div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>What did you learn today?</div>
                  </div>
                  <div style={{ background: "rgba(var(--color-teal-rgb), 0.08)", border: "1px solid rgba(var(--color-teal-rgb), 0.15)", borderRadius: 10, padding: 12, display: "flex", gap: 10 }}>
                    <div style={{ color: "var(--color-teal)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>What felt difficult?</div>
                  </div>
                  <div style={{ background: "rgba(var(--grad-start-rgb), 0.08)", border: "1px solid rgba(var(--grad-start-rgb), 0.15)", borderRadius: 10, padding: 12, display: "flex", gap: 10 }}>
                    <div style={{ color: "var(--grad-start)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>What will you do tomorrow?</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: Today at a glance */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, width: 220 }}>
                <div style={{ color: "var(--color-teal)" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text)" }}>Today at a glance</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>A quick summary of your day</p>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", gap: 16 }}>
                <div style={{ flex: 1, background: "rgba(var(--color-blue-rgb),0.06)", border: "1px solid rgba(var(--color-blue-rgb),0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--color-blue)", background: "var(--bg)", padding: 8, borderRadius: 50, border: "1px solid rgba(var(--color-blue-rgb),0.2)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Study Hours</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>{Math.floor(todayLog.hours || 0)}h {Math.round(((todayLog.hours || 0) - Math.floor(todayLog.hours || 0)) * 60)}m</div>
                  </div>
                </div>
                <div style={{ flex: 1, background: "rgba(var(--color-blue-rgb),0.06)", border: "1px solid rgba(var(--color-blue-rgb),0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--color-blue)", background: "var(--bg)", padding: 8, borderRadius: 50, border: "1px solid rgba(var(--color-blue-rgb),0.2)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Questions Solved</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>{todayLog.dpps.toString().padStart(2, '0')} qs</div>
                  </div>
                </div>
                <div style={{ flex: 1, background: "rgba(var(--color-amber-rgb),0.06)", border: "1px solid rgba(var(--color-amber-rgb),0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--color-amber)", background: "var(--bg)", padding: 8, borderRadius: 50, border: "1px solid rgba(var(--color-amber-rgb),0.2)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg></div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-amber)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subjects Touched</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>{new Set((todayLog.sessions || []).map(s => s.subjectId)).size || (todayLog.hours > 0 ? 1 : 0)}</div>
                  </div>
                </div>
                <div style={{ flex: 1, background: "rgba(var(--color-teal-rgb),0.06)", border: "1px solid rgba(var(--color-teal-rgb),0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--color-teal)", background: "var(--bg)", padding: 8, borderRadius: 50, border: "1px solid rgba(var(--color-teal-rgb),0.2)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg></div>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-teal)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Focus Score</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>{Math.round(Math.min(100, ((todayLog.hours || 0) / (store.targetHours || 8)) * 100))}%</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
        
        {activeTab === "tests" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div className="ep-grid-sidebar">

              {/* Log Form */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, position: "sticky", top: 140 }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> Log a Test Score</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>Subject</label>
                    <CustomSelect
                      value={newTestSubId}
                      onChange={setNewTestSubId}
                      placeholder="Select subject..."
                      options={store.subjects.map(s => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>Test Type</label>
                    <CustomSelect
                      value={newTestType}
                      onChange={setNewTestType}
                      placeholder="Select test type"
                      options={TEST_TYPES.map(t => ({ value: t, label: t }))}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <div>
                      <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>Score</label>
                      <input type="number" min="0" value={newTestScore} onChange={e => setNewTestScore(e.target.value)} placeholder="75" className="ep-input" style={{ width: "100%", padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "1rem", fontWeight: 700, textAlign: "center", transition: "border-color 0.2s" }} />
                    </div>
                    <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "1.2rem", paddingTop: 20 }}>/</span>
                    <div>
                      <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>Max</label>
                      <input type="number" min="1" value={newTestMax} onChange={e => setNewTestMax(e.target.value)} className="ep-input" style={{ width: "100%", padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)", fontSize: "1rem", fontWeight: 700, textAlign: "center", transition: "border-color 0.2s" }} />
                    </div>
                  </div>
                  {newTestScore && newTestMax && (
                    <div style={{ textAlign: "center", padding: "10px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: "1.2rem", fontWeight: 800, color: (Number(newTestScore) / Number(newTestMax) * 100) >= 70 ? "var(--color-teal)" : (Number(newTestScore) / Number(newTestMax) * 100) >= 40 ? "#ffa94d" : "#ff6b6b" }}>
                      {Math.round(Number(newTestScore) / Number(newTestMax) * 100)}%
                    </div>
                  )}
                  <button onClick={addTestScore} disabled={!newTestSubId || !newTestScore} style={{ padding: "12px", background: newTestSubId && newTestScore ? "linear-gradient(135deg,var(--color-teal),#4A90FF)" : "var(--bg-subtle)", color: newTestSubId && newTestScore ? "#fff" : "var(--text-muted)", border: "none", borderRadius: 9, fontFamily: "var(--font)", fontWeight: 800, fontSize: "0.9rem", cursor: newTestSubId && newTestScore ? "pointer" : "not-allowed", boxShadow: newTestSubId && newTestScore ? "0 4px 20px rgba(var(--color-teal-rgb),0.35)" : "none", transition: "all 0.2s" }}>
                    Log Score →
                  </button>
                </div>
              </div>

              {/* Scores History */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>
                    <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg></span> {testFilterSubId === "all" ? "All" : store.subjects.find(s => s.id === testFilterSubId)?.name} Test Scores ({store.testScores.filter(t => testFilterSubId === "all" || t.subjectId === testFilterSubId).length})
                  </div>
                  <div style={{ width: 180 }}>
                    <CustomSelect
                      value={testFilterSubId}
                      onChange={setTestFilterSubId}
                      options={[{ value: "all", label: "All Subjects" }, ...store.subjects.map(s => ({ value: s.id, label: s.name }))]}
                    />
                  </div>
                </div>
                {store.testScores.filter(t => testFilterSubId === "all" || t.subjectId === testFilterSubId).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-act)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /><path d="M13 18l1-1 3 3 4-4" /></svg></div>
                    <div>No test scores found.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...store.testScores].filter(t => testFilterSubId === "all" || t.subjectId === testFilterSubId).reverse().map(ts => {
                      const sub = store.subjects.find(s => s.id === ts.subjectId);
                      const pct = Math.round((ts.score / ts.maxScore) * 100);
                      const grade = pct >= 80 ? { color: "var(--color-teal)", label: "Excellent" } : pct >= 60 ? { color: "var(--color-teal)", label: "Good" } : pct >= 40 ? { color: "#ffa94d", label: "Average" } : { color: "#ff6b6b", label: "Below Avg" };
                      return (
                        <div key={ts.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${sub?.color || "var(--color-teal)"}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: sub?.color || "var(--color-teal)" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{ts.testType}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10 }}>
                              <span>{sub?.name || "Unknown Subject"}</span>
                              <span>·</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> {ts.date}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{ts.score}<span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>/{ts.maxScore}</span></div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                <span style={{ fontSize: "1rem", fontWeight: 900, color: grade.color }}>{pct}%</span>
                                <span style={{ fontSize: "0.65rem", background: `${grade.color}18`, color: grade.color, border: `1px solid ${grade.color}44`, borderRadius: 100, padding: "2px 8px", fontWeight: 700 }}>{grade.label}</span>
                              </div>
                            </div>
                            <button onClick={() => { if (window.confirm("Delete this test score?")) updateStore(s => ({ ...s, testScores: s.testScores.filter(t => t.id !== ts.id) })); }} title="Delete score" style={{ background: "none", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 7, padding: "6px", cursor: "pointer", color: "rgba(255,100,100,0.5)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,100,100,0.5)"; e.currentTarget.style.color = "#ff6b6b"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,100,100,0.2)"; e.currentTarget.style.color = "rgba(255,100,100,0.5)"; }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* PLANNER TAB */}
        {activeTab === "plans" && (
          <PlannerTabManager store={store} selDate={selDate} updateStore={updateStore} setSelDate={setSelDate} todayLog={todayLog} setShowAddWeek={setShowAddWeek} setShowAddMonth={setShowAddMonth} setWpWeekStart={setWpWeekStart} setMpMonth={setMpMonth} />
        )}

        {/* ── TEST TRACKER ── */}
        {activeTab === "tracker" && (
          <TestTrackerTab goTests={store.goTests ?? DEFAULT_GO_TESTS} onUpdate={(tests: GOTest[]) => updateStore(s => ({ ...s, goTests: tests }))} />
        )}
      </main>

      {/* Footer Overall Progress Bar */}
      <div style={{ padding: "16px 32px", background: "var(--bg-card)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 24, zIndex: 40, flexShrink: 0 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{store.examName}   <span style={{ color: "var(--text-sub)", fontWeight: 600 }}>{daysLeft(store.examDate)} days left</span></span>
        <div style={{ flex: 1, height: 8, background: "#EAF2F3", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${sylPct}%`, background: "var(--color-teal)", borderRadius: 4, transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{sylPct}% syllabus <span style={{ color: "var(--text-sub)", fontWeight: 600 }}>  {doneChaps}/{totalChaps} ch</span></span>
      </div>
      {/* Modal — rendered at root level to avoid header stacking context */}
      {showAddSub && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}
          onClick={e => e.target === e.currentTarget && setShowAddSub(false)}>
          <AddSubjectModal onAdd={addSubject} onClose={() => setShowAddSub(false)} />
        </div>
      )}

      {/* ─── ADD WEEK PLAN MODAL ─── */}
      {showAddWeek && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "block", padding: "1px 20px", overflowY: "auto" }}>
          <div style={{ margin: "10vh auto 40px", background: "var(--bg-card)", border: "1px solid var(--border-act)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, overflow: "visible" }}>
            <h3 style={{ fontFamily: "var(--font)", fontWeight: 800, color: "var(--text)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> New Weekly Plan</h3>
            <div className="ep-grid-3" style={{ marginBottom: 16 }}>
              <div style={{ position: "relative", zIndex: 10 }}>
                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Week Start (Mon)</label>
                <CustomDatePicker value={wpWeekStart} onChange={setWpWeekStart} fullWidth />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Hour Target</label>
                <input type="number" value={wpTargetHours} onChange={e => setWpTargetHours(Number(e.target.value))} placeholder="50" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)" }} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>DPP Target</label>
                <input type="number" value={wpTargetDpps} onChange={e => setWpTargetDpps(Number(e.target.value))} placeholder="100" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)" }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Select Chapters to Cover This Week</label>
              {store.subjects.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "12px", background: "var(--bg-subtle)", borderRadius: 8 }}>Add subjects first in the Subjects tab.</div> :
                store.subjects.map(sub => (
                  <div key={sub.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: sub.color }} />
                      <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{sub.name}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {sub.chapters.map(ch => {
                        const sel = wpChapSel[sub.id]?.has(ch.id) ?? false;
                        return (
                          <button key={ch.id} onClick={() => {
                            setWpChapSel(prev => {
                              const ns = new Set(prev[sub.id] ?? []);
                              sel ? ns.delete(ch.id) : ns.add(ch.id);
                              return { ...prev, [sub.id]: ns };
                            });
                          }} style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 100, cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, border: `1px solid ${sel ? sub.color : "var(--border)"}`, background: sel ? `${sub.color}22` : "transparent", color: sel ? sub.color : "var(--text-muted)", transition: "all 0.15s" }}>{ch.name}</button>
                        );
                      })}
                    </div>
                  </div>
                ))
              }
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Notes (optional)</label>
              <input value={wpNotes} onChange={e => setWpNotes(e.target.value)} placeholder="e.g. Focus on Linear Algebra revision + Integration" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddWeek(false)} style={{ flex: 1, padding: "11px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                const chapterTargets = Object.entries(wpChapSel).filter(([, s]) => s.size > 0).map(([subjectId, s]) => ({ subjectId, chapIds: [...s] }));
                const newPlan: WeekPlan = { id: uid(), weekStart: wpWeekStart, targetHours: wpTargetHours, targetDpps: wpTargetDpps, chapterTargets, notes: wpNotes };
                updateStore(s => { const wps = [...(s.weekPlans ?? [])]; const idx = wps.findIndex(p => p.weekStart === wpWeekStart); if (idx >= 0) { wps[idx] = { ...wps[idx], targetHours: wpTargetHours, targetDpps: wpTargetDpps, chapterTargets: newPlan.chapterTargets, notes: wpNotes }; } else { wps.push(newPlan); } return { ...s, weekPlans: wps }; });
                setShowAddWeek(false); setWpChapSel({}); setWpNotes("");
              }} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg,var(--color-teal),#4A90FF)", border: "none", borderRadius: 8, color: "var(--sidebar-text)", fontFamily: "var(--font)", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(var(--color-teal-rgb),0.35)" }}>Create Week Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD DAILY PLAN MODAL ─── */}
      {showAddDaily && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "block", padding: "1px 20px", overflowY: "auto" }}>
          <div style={{ margin: "10vh auto 40px", background: "var(--bg-card)", border: "1px solid var(--border-act)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, overflow: "visible" }}>
            <h3 style={{ fontFamily: "var(--font)", fontWeight: 800, color: "var(--text)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> New Daily Planner</h3>
            <div style={{ marginBottom: 16, position: "relative", zIndex: 10 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Date</label>
              <CustomDatePicker value={dpDate} onChange={setDpDate} fullWidth />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddDaily(false)} style={{ flex: 1, padding: "11px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                updateStore(s => {
                  const idx = s.dailyLogs.findIndex(l => l.date === dpDate);
                  if (idx >= 0) {
                    // Already exists — ensure it has a tasks array so it shows up in daily view
                    const logs = [...s.dailyLogs];
                    logs[idx] = { ...logs[idx], tasks: logs[idx].tasks || [] };
                    return { ...s, dailyLogs: logs };
                  }
                  return { ...s, dailyLogs: [...s.dailyLogs, { date: dpDate, hours: 0, dpps: 0, journal: "", tasks: [] }] };
                });
                setShowAddDaily(false);
              }} style={{ flex: 2, padding: "11px", background: "var(--gradient)", border: "none", borderRadius: 8, color: "var(--sidebar-text)", fontFamily: "var(--font)", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(var(--color-teal-rgb),0.35)" }}>Create Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD MONTH PLAN MODAL ─── */}
      {showAddMonth && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 10000, display: "block", padding: "1px 20px", overflowY: "auto" }}>
          <div style={{ margin: "10vh auto 40px", background: "var(--bg-card)", border: "1px solid var(--border-act)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, overflow: "visible" }}>
            <h3 style={{ fontFamily: "var(--font)", fontWeight: 800, color: "var(--text)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg> New Monthly Plan</h3>
            <div style={{ marginBottom: 16, position: "relative", zIndex: 10 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Month</label>
              <CustomMonthPicker value={mpMonth} onChange={setMpMonth} fullWidth />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Subject Targets (how many chapters per subject)</label>
              {store.subjects.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "12px", background: "var(--bg-subtle)", borderRadius: 8 }}>Add subjects first in the Subjects tab.</div> :
                store.subjects.map(sub => {
                  const existing = mpSubTargets.find(t => t.subjectId === sub.id);
                  return (
                    <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 9, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sub.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: "0.88rem" }}>{sub.name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sub.chapters.length} ch total</span>
                      <input type="number" min="0" max={sub.chapters.length} placeholder="0" value={existing?.chapCount ?? ""}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setMpSubTargets(prev => {
                            const others = prev.filter(t => t.subjectId !== sub.id);
                            return val > 0 ? [...others, { subjectId: sub.id, chapCount: val }] : others;
                          });
                        }}
                        style={{ width: 56, padding: "6px 8px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontFamily: "var(--font)", fontWeight: 700, textAlign: "center" }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ch</span>
                    </div>
                  );
                })}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Notes (optional)</label>
              <input value={mpNotes} onChange={e => setMpNotes(e.target.value)} placeholder="e.g. Complete Maths + Networks, start Data Structures" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font)" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddMonth(false)} style={{ flex: 1, padding: "11px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontFamily: "var(--font)", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                const newPlan: MonthPlan = { id: uid(), month: mpMonth, subjectTargets: mpSubTargets, notes: mpNotes };
                updateStore(s => { const mps = [...(s.monthPlans ?? [])]; const idx = mps.findIndex(p => p.month === mpMonth); if (idx >= 0) { mps[idx] = { ...mps[idx], subjectTargets: newPlan.subjectTargets, notes: mpNotes }; } else { mps.push(newPlan); } return { ...s, monthPlans: mps }; });
                setShowAddMonth(false); setMpSubTargets([]); setMpNotes("");
              }} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg,var(--color-teal),#4A90FF)", border: "none", borderRadius: 8, color: "var(--sidebar-text)", fontFamily: "var(--font)", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(var(--color-teal-rgb),0.35)" }}>Create Month Plan</button>
            </div>
          </div>
        </div>
      )}
        {/* ── TEST TRACKER ── */}
        {activeTab === "tracker" && null}

      </div>
    </div>
  );
}

// ─── Mode Chooser ─────────────────────────────────────────────────────────────
function PlannerModeChooser({ onSelect }: { onSelect: (m: "competitive" | "jobprep") => void }) {
  const router = useRouter();
  return (
    <div className="exam-planner-theme" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font)" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .mode-card{cursor:pointer;transition:all 0.25s ease;border:1px solid var(--border)}
        .mode-card:hover{transform:translateY(-6px);border-color:rgba(var(--color-teal-rgb),0.5);box-shadow:0 20px 60px rgba(var(--color-teal-rgb),0.15)}
      `}</style>
      <div style={{ maxWidth: 720, width: "100%", animation: "fadeUp 0.5s ease both" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--gradient)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(var(--color-teal-rgb),0.3)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "2.2rem", color: "var(--text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>Choose Your Path</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: 460, margin: "0 auto" }}>Select the type of preparation you want to track</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {/* Competitive Exam Card */}
          <div className="mode-card" onClick={() => onSelect("competitive")} style={{ background: "var(--bg-card)", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,var(--color-teal),#4A90FF)" }}/>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(var(--color-teal-rgb),0.12)", border: "1px solid rgba(var(--color-teal-rgb),0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--text)", marginBottom: 8 }}>Competitive Exam</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: 16 }}>Track syllabus, daily study hours, test scores, and chapter-wise progress for competitive exams.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["GATE","JEE","NEET","UPSC","CAT"].map(e => <span key={e} style={{ fontSize: "0.68rem", padding: "4px 10px", borderRadius: 100, background: "rgba(var(--color-teal-rgb),0.1)", color: "var(--color-teal)", fontWeight: 700, border: "1px solid rgba(var(--color-teal-rgb),0.2)" }}>{e}</span>)}
            </div>
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, color: "var(--color-teal)", fontWeight: 700, fontSize: "0.85rem" }}>
              Get Started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
          {/* Job Prep Card */}
          <div className="mode-card" onClick={() => onSelect("jobprep")} style={{ background: "var(--bg-card)", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#3B82F6,#10B981)" }}/>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--text)", marginBottom: 8 }}>Tech Job Prep</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: 16 }}>DSA practice, projects, interview prep, study planning, and resources for landing your dream tech job.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["DSA","Web Dev","System Design","Projects","Interviews"].map(e => <span key={e} style={{ fontSize: "0.68rem", padding: "4px 10px", borderRadius: 100, background: "rgba(59,130,246,0.1)", color: "#3B82F6", fontWeight: 700, border: "1px solid rgba(59,130,246,0.2)" }}>{e}</span>)}
            </div>
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, color: "#3B82F6", fontWeight: 700, fontSize: "0.85rem" }}>
              Get Started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button onClick={() => router.push("/choose")} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", padding: "8px 18px", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, fontSize: "0.82rem" }}>← Back to Home</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────
export default function ExamPlannerPage() {
  const [mode, setMode] = useState<"competitive" | "jobprep" | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PLANNER_MODE_KEY);
    if (saved === "competitive" || saved === "jobprep") setMode(saved);
    setLoaded(true);
  }, []);

  const selectMode = (m: "competitive" | "jobprep") => {
    localStorage.setItem(PLANNER_MODE_KEY, m);
    setMode(m);
  };
  const resetMode = () => {
    localStorage.removeItem(PLANNER_MODE_KEY);
    setMode(null);
  };

  if (!loaded) return <div style={{ height: "100vh", background: "#060A17" }}/>;
  if (!mode) return <PlannerModeChooser onSelect={selectMode} />;
  if (mode === "jobprep") return <JobPrepPlanner onSwitchMode={resetMode} />;
  return <CompetitiveExamPlanner onSwitchMode={resetMode} />;
}












