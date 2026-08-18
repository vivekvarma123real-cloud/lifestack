import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ChapterTemplate = { name: string };
export type SubjectTemplate = {
  name: string;
  color: string;
  chapters: ChapterTemplate[];
};

// ─── Hardcoded Default GATE CS Syllabus ───────────────────────────────────────
export const DEFAULT_GATE_CS_TEMPLATE: SubjectTemplate[] = [
  {
    name: "Discrete Mathematics",
    color: "#C36BFF",
    chapters: [
      { name: "Propositional Logic" },
      { name: "First Order Logic" },
      { name: "Set Theory" },
      { name: "Relations" },
      { name: "Functions" },
      { name: "Lattices" },
      { name: "Group Theory" },
      { name: "Combinatorics" },
      { name: "Graph Theory" },
    ],
  },
  {
    name: "Engineering Mathematics",
    color: "#4A90FF",
    chapters: [
      { name: "Linear Algebra" },
      { name: "Probability" },
      { name: "Statistics" },
      { name: "Calculus" },
      { name: "Differential Equations" },
    ],
  },
  {
    name: "Digital Logic",
    color: "#28D7FF",
    chapters: [
      { name: "Boolean Algebra" },
      { name: "Number Systems" },
      { name: "Combinational Circuits" },
      { name: "Sequential Circuits" },
      { name: "Minimization" },
    ],
  },
  {
    name: "Computer Organization & Architecture",
    color: "#ff6b6b",
    chapters: [
      { name: "Machine Instructions & Addressing Modes" },
      { name: "ALU & Data Path" },
      { name: "CPU Control Design" },
      { name: "Pipelining" },
      { name: "Memory Hierarchy" },
      { name: "Cache Memory" },
      { name: "I/O Interface" },
    ],
  },
  {
    name: "Programming & Data Structures",
    color: "#69db7c",
    chapters: [
      { name: "C Programming Basics" },
      { name: "Arrays & Strings" },
      { name: "Pointers & Structures" },
      { name: "Linked Lists" },
      { name: "Stacks & Queues" },
      { name: "Trees & BST" },
      { name: "Heaps" },
      { name: "Hashing" },
      { name: "Graphs" },
    ],
  },
  {
    name: "Algorithms",
    color: "#ffd43b",
    chapters: [
      { name: "Asymptotic Analysis" },
      { name: "Searching & Sorting" },
      { name: "Divide & Conquer" },
      { name: "Greedy Algorithms" },
      { name: "Dynamic Programming" },
      { name: "Graph Algorithms" },
      { name: "Complexity Classes (P, NP)" },
    ],
  },
  {
    name: "Theory of Computation",
    color: "#f783ac",
    chapters: [
      { name: "Finite Automata (DFA/NFA)" },
      { name: "Regular Expressions & Languages" },
      { name: "Context Free Grammars" },
      { name: "Pushdown Automata" },
      { name: "Turing Machines" },
      { name: "Decidability & Undecidability" },
    ],
  },
  {
    name: "Compiler Design",
    color: "#a9e34b",
    chapters: [
      { name: "Lexical Analysis" },
      { name: "Parsing (Top-Down & Bottom-Up)" },
      { name: "Syntax Directed Translation" },
      { name: "Intermediate Code Generation" },
      { name: "Code Optimization" },
      { name: "Runtime Environment" },
    ],
  },
  {
    name: "Operating Systems",
    color: "#9e7dff",
    chapters: [
      { name: "Process Management" },
      { name: "CPU Scheduling" },
      { name: "Process Synchronization" },
      { name: "Deadlocks" },
      { name: "Memory Management" },
      { name: "Virtual Memory" },
      { name: "File Systems" },
      { name: "Disk Scheduling" },
    ],
  },
  {
    name: "DBMS",
    color: "#ffa94d",
    chapters: [
      { name: "ER Model" },
      { name: "Relational Model" },
      { name: "SQL" },
      { name: "Relational Algebra" },
      { name: "Normalization" },
      { name: "Transactions & Concurrency" },
      { name: "Indexing & B/B+ Trees" },
    ],
  },
  {
    name: "Computer Networks",
    color: "#4dabf7",
    chapters: [
      { name: "OSI & TCP/IP Models" },
      { name: "Data Link Layer" },
      { name: "Network Layer" },
      { name: "IP Addressing & Subnetting" },
      { name: "Routing Algorithms" },
      { name: "Transport Layer (TCP/UDP)" },
      { name: "Application Layer" },
      { name: "Network Security" },
    ],
  },
];

// ─── Database Operations ──────────────────────────────────────────────────────

export async function loadGatePlannerTemplate(
  templateId: string = "gate-cs"
): Promise<SubjectTemplate[] | null> {
  try {
    const { data, error } = await supabase
      .from("gate_planner_template")
      .select("template")
      .eq("id", templateId)
      .limit(1);

    if (error) {
      console.warn("[gatePlannerDb] loadTemplate error (using fallback):", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;
    return data[0]?.template ?? null;
  } catch (e) {
    console.warn("[gatePlannerDb] loadTemplate exception (using fallback):", e);
    return null;
  }
}

export async function saveGatePlannerTemplate(
  templateId: string = "gate-cs",
  template: SubjectTemplate[]
): Promise<{ error: any }> {
  const payload = {
    id: templateId,
    template,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("gate_planner_template")
    .upsert(payload, { onConflict: "id" });

  if (error) console.error("[gatePlannerDb] saveTemplate error:", error.message, error.code);
  return { error };
}

/**
 * Returns the best available GATE CS template:
 * 1. Try loading from DB (admin-managed)
 * 2. Fall back to hardcoded default
 */
export async function getGateTemplate(): Promise<SubjectTemplate[]> {
  const dbTemplate = await loadGatePlannerTemplate("gate-cs");
  return dbTemplate && dbTemplate.length > 0 ? dbTemplate : DEFAULT_GATE_CS_TEMPLATE;
}
