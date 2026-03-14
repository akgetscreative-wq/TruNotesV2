import { format, addDays, subDays, startOfDay, isAfter, isBefore } from "date-fns"
import { hybridSearch, prepareSearchItems } from "./embedding"
import type { SearchableItem } from "./embedding"

import { storage } from "../../lib/storage"
import type { Note, Todo } from "../../types"

export interface ContextData {
  notes: Note[]
  todos: Todo[]
  hourlyLogs: Record<number, string>
  persistentMemories: string[]
  aiConfig: any
}

// -------------------------------
// CONTEXT CACHE
// -------------------------------

let contextCache = {
  recentNotes: [] as Note[],
  pendingTodos: [] as Todo[],
  recentLogs: "" as string,
  searchableItems: [] as SearchableItem[],
  lastUpdated: 0,
  dataHash: ""
}

// Max chars for context data — keeps total prompt under ~1000 tokens (safe for n_ctx=1280)
// Budget: n_ctx(1280) - system(130) - history(240) - user(40) - generation(200) ≈ 670 tokens ≈ 2680 chars
const MAX_CONTEXT_CHARS = 2500

// -------------------------------
// TEXT CLEANING
// -------------------------------

export const processContent = (text: string) => {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/data:image\/[^;]+;base64,[^\s"']+/g, "[IMAGE]")
    .replace(/\s+/g, " ")
    .substring(0, 500)
    .trim()
}

// -------------------------------
// CACHE REBUILD
// -------------------------------

export const rebuildContextCache = async (data: ContextData) => {

  const { notes, todos, hourlyLogs } = data

  const latestNote = Math.max(...notes.map(n => n.updatedAt ?? n.createdAt), 0)
  const latestTodo = Math.max(...todos.map(t => t.updatedAt ?? t.createdAt), 0)

  const newHash =
    `${latestNote}-${latestTodo}-${Object.keys(hourlyLogs).length}`

  if (
    newHash === contextCache.dataHash &&
    contextCache.searchableItems.length > 0 &&
    Date.now() - contextCache.lastUpdated < 300000
  ) {
    return
  }

  console.log("RAG: rebuilding context cache")

  const allHistoricalLogs = await storage.getAllHourlyLogs()

  contextCache.recentNotes = [...notes]
    .filter(n => !n.deleted)
    .sort((a, b) =>
      (b.updatedAt ?? b.createdAt) -
      (a.updatedAt ?? a.createdAt)
    )
    .slice(0, 8)

  contextCache.pendingTodos = [...todos]
    .filter(t => !t.deleted && !t.completed)
    .slice(0, 10)

  contextCache.searchableItems =
    prepareSearchItems(notes, todos, allHistoricalLogs)

  contextCache.recentLogs = Object.entries(hourlyLogs)
    .filter(([_, v]) => v && v.trim())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([h, v]) => `${String(h).padStart(2, "0")}:00 — ${v}`)
    .join("\n")

  contextCache.lastUpdated = Date.now()
  contextCache.dataHash = newHash
}

// -------------------------------
// CONTEXT BUILDER
// -------------------------------

export const getRelevantContext = async (
  userInput: string,
  data: ContextData
) => {

  const { persistentMemories, aiConfig } = data

  if (aiConfig.directMode) return ""

  try {

    const now = new Date()
    const lowerInput = userInput.toLowerCase()

    await rebuildContextCache(data)

    // -------------------------
    // INTENT DETECTION
    // -------------------------

    const isNoteRequest = /\bnotes?\b/.test(lowerInput)
    const isTaskRequest = /\btasks?\b|\btodos?\b|\bto-?dos?\b/.test(lowerInput)
    const isSummaryRequest = /\bsummar(ise|ize|y)?\b|\blist (my|all|the)|\bwhat are (my|the)|\bshow (me )?(my|all)|\bwhat do i have|\bhow many (notes?|tasks?|todos?)/.test(lowerInput)
    const isGeneralDataRequest = /\bwhat'?s (going on|happening|up|new)\b|\bcatch me up\b|\boverview\b|\bbrief me\b|\bupdate me\b|\bwhat did i (do|work on)\b/.test(lowerInput)

    const isCompletedTaskRequest = /\bcompleted?\b|\bdone\b|\bfinished?\b|\bticked off\b/.test(lowerInput) && isTaskRequest
    const isTomorrowRequest = /\btomorrow\b/.test(lowerInput) && isTaskRequest
    const isYesterdayRequest = /\byesterday\b/.test(lowerInput)
    const isLastWeekRequest = /\blast\s*week\b|\bthis\s*week\b|\bpast\s*week\b|\bpast 7 days\b/.test(lowerInput)
    const isLastMonthRequest = /\blast\s*month\b|\bthis\s*month\b|\bpast\s*month\b/.test(lowerInput)
    const hasDateContext = isYesterdayRequest || isLastWeekRequest || isLastMonthRequest

    const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd')
    const todayStr = format(now, 'yyyy-MM-dd')

    // -------------------------
    // COMPLETED TASKS
    // -------------------------

    if (isCompletedTaskRequest) {
      const completedTodos = data.todos.filter(t => !t.deleted && t.completed && t.targetDate !== 'daily')
      if (completedTodos.length > 0) {
        let ctx = `[APP CONTEXT]\n### COMPLETED TASKS (${completedTodos.length} total)\n`
        let chars = ctx.length
        for (const t of completedTodos) {
          const line = `- [DONE] ${t.text}${t.targetDate && t.targetDate !== todayStr ? ` (${t.targetDate})` : ''}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS) break
          ctx += line
          chars += line.length
        }
        ctx += "\nInstruction: List these completed tasks accurately."
        return ctx
      } else {
        return "[APP CONTEXT]\n### COMPLETED TASKS\nNo completed tasks found."
      }
    }

    // -------------------------
    // TOMORROW'S TASKS
    // -------------------------

    if (isTomorrowRequest) {
      const tomorrowTodos = data.todos.filter(t => !t.deleted && !t.completed && t.targetDate === tomorrowStr)
      if (tomorrowTodos.length > 0) {
        let ctx = `[APP CONTEXT]\n### TASKS FOR TOMORROW (${tomorrowStr})\n`
        tomorrowTodos.forEach(t => { ctx += `- ${t.text}\n` })
        ctx += "\nInstruction: Tell the user what tasks they have scheduled for tomorrow."
        return ctx
      } else {
        return `[APP CONTEXT]\n### TASKS FOR TOMORROW (${tomorrowStr})\nNo tasks scheduled for tomorrow.`
      }
    }

    // -------------------------
    // DATE-BASED NOTES QUERY
    // -------------------------

    if (isNoteRequest && hasDateContext) {
      let cutoffStart: Date
      let cutoffEnd: Date = now
      let label: string

      if (isYesterdayRequest) {
        cutoffStart = startOfDay(subDays(now, 1))
        cutoffEnd = startOfDay(now)
        label = "yesterday"
      } else if (isLastWeekRequest) {
        cutoffStart = startOfDay(subDays(now, 7))
        label = "the past week"
      } else {
        cutoffStart = startOfDay(subDays(now, 30))
        label = "the past month"
      }

      const filteredNotes = data.notes
        .filter(n => !n.deleted)
        .filter(n => {
          const ts = n.updatedAt ?? n.createdAt
          return isAfter(ts, cutoffStart) && isBefore(ts, cutoffEnd)
        })
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

      if (filteredNotes.length > 0) {
        let ctx = `[APP CONTEXT]\n### NOTES FROM ${label.toUpperCase()} (${filteredNotes.length} found)\n`
        let chars = ctx.length
        for (const n of filteredNotes) {
          const date = format(n.updatedAt ?? n.createdAt, 'MMM d')
          const line = `- [${date}] ${n.title}: ${processContent(n.content).substring(0, 150)}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS) break
          ctx += line
          chars += line.length
        }
        ctx += "\nInstruction: Summarise or describe the notes from this time period accurately."
        return ctx
      } else {
        return `[APP CONTEXT]\n### NOTES FROM ${label.toUpperCase()}\nNo notes found from ${label}.`
      }
    }

    // -------------------------
    // LAST WEEK / HISTORICAL LOG SUMMARY
    // -------------------------

    if (isLastWeekRequest || (isYesterdayRequest && !isNoteRequest)) {
      const allLogs = await storage.getAllHourlyLogs()
      const daysBack = isYesterdayRequest ? 1 : 7
      const cutoff = subDays(now, daysBack)

      const recentLogs = allLogs
        .filter((log: any) => isAfter(new Date(log.date), cutoff))
        .sort((a: any, b: any) => a.date.localeCompare(b.date))

      if (recentLogs.length > 0) {
        const label = isYesterdayRequest ? "YESTERDAY" : "PAST WEEK"
        let ctx = `[APP CONTEXT]\n### ${label}'S ACTIVITY LOG\n`
        let chars = ctx.length
        for (const log of recentLogs) {
          const dayLabel = format(new Date((log as any).date), 'EEEE MMM d')
          const entries = Object.entries((log as any).logs as Record<number, string>)
            .filter(([, v]) => v && v.trim())
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([h, v]) => `  ${String(h).padStart(2, '0')}:00 — ${v}`)
            .join("\n")
          if (!entries) continue
          const section = `\n${dayLabel}:\n${entries}\n`
          if (chars + section.length > MAX_CONTEXT_CHARS) break
          ctx += section
          chars += section.length
        }
        ctx += "\nInstruction: Summarise the user's activity for this period from the logs above."
        return ctx
      } else {
        return `[APP CONTEXT]\n### ACTIVITY LOG\nNo activity logged for this period.`
      }
    }

    // Handle Note Summary — by default shows recent notes only (fast + reliable)
    // Date-specific queries (last week/month) are handled above with proper filters
    if (isSummaryRequest && isNoteRequest) {
      const allNotes = data.notes.filter(n => !n.deleted)
      const recentNotes = [...allNotes]
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
        .slice(0, 8)

      if (recentNotes.length > 0) {
        let notesContext = `[APP CONTEXT]\n### RECENT NOTES (${recentNotes.length} shown of ${allNotes.length} total)\n`
        let chars = notesContext.length
        for (const n of recentNotes) {
          const date = format(n.updatedAt ?? n.createdAt, 'MMM d')
          const line = `- [${date}] ${n.title}: ${processContent(n.content).substring(0, 120)}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS) break
          notesContext += line
          chars += line.length
        }
        notesContext += "\nInstruction: Summarise these recent notes. If the user wants notes from a specific period, they can ask e.g. 'notes from last week'."
        return notesContext
      }
    }

    // Handle Task Summary
    if (isSummaryRequest && isTaskRequest) {
      const activeTodos = data.todos.filter(t => !t.deleted && !t.completed && t.targetDate !== 'daily')
      if (activeTodos.length > 0) {
        let taskContext = `[APP CONTEXT]\n### PENDING TASKS (${activeTodos.length} total)\n`
        let chars = taskContext.length
        for (const t of activeTodos) {
          const line = `- ${t.text}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS) break
          taskContext += line
          chars += line.length
        }
        taskContext += "\nInstruction: List or summarise these actual pending tasks. Do not invent others."
        return taskContext
      } else {
        return "[APP CONTEXT]\n### PENDING TASKS\nYou have no pending tasks. Tell the user they are all caught up!"
      }
    }

    // Handle general "catch me up" / overview requests - return both notes + tasks + logs
    if (isGeneralDataRequest || (isSummaryRequest && !isNoteRequest && !isTaskRequest)) {
      let overviewContext = `[APP CONTEXT]\nDate: ${format(now, "eeee, yyyy-MM-dd p")}\n\n`
      let chars = overviewContext.length

      const activeTodos = data.todos.filter(t => !t.deleted && !t.completed && t.targetDate !== 'daily')
      if (activeTodos.length > 0) {
        const header = `### PENDING TASKS (${activeTodos.length})\n`
        overviewContext += header
        chars += header.length
        for (const t of activeTodos) {
          const line = `- ${t.text}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS * 0.4) break // tasks get 40% of budget
          overviewContext += line
          chars += line.length
        }
        overviewContext += "\n"
        chars += 1
      }

      const recentNotes = [...data.notes].filter(n => !n.deleted)
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
        .slice(0, 10)
      if (recentNotes.length > 0) {
        const header = `### RECENT NOTES\n`
        overviewContext += header
        chars += header.length
        for (const n of recentNotes) {
          const line = `- ${n.title}: ${processContent(n.content).substring(0, 120)}\n`
          if (chars + line.length > MAX_CONTEXT_CHARS * 0.85) break // notes get up to 85%
          overviewContext += line
          chars += line.length
        }
        overviewContext += "\n"
      }

      if (contextCache.recentLogs && chars < MAX_CONTEXT_CHARS * 0.9) {
        const logSection = `### TODAY'S LOG\n${contextCache.recentLogs}\n\n`
        overviewContext += logSection.substring(0, MAX_CONTEXT_CHARS - chars)
      }

      overviewContext += "Instruction: Give the user a concise overview of their current tasks, recent notes, and today's activity."
      return overviewContext
    }

    // -------------------------
    // SEMANTIC RETRIEVAL
    // -------------------------

    let retrievedItems: SearchableItem[] = []

    if (contextCache.searchableItems.length > 0) {

      retrievedItems = await hybridSearch(
        userInput,
        contextCache.searchableItems
      )

      retrievedItems = retrievedItems.slice(0, 5)

    }

    // -------------------------
    // CONTEXT BUILDING
    // -------------------------

    let contextStr = `[APP CONTEXT]\n`
    contextStr += `Date: ${format(now, "eeee, yyyy-MM-dd p")}\n\n`
    let ctxChars = contextStr.length

    if (persistentMemories.length > 0) {
      const mem = `### USER MEMORIES\n` + persistentMemories.map(m => `- ${m}`).join("\n") + "\n\n"
      contextStr += mem
      ctxChars += mem.length
    }

    // Always include today's pending tasks as baseline
    const activeTodos = data.todos.filter(t => !t.deleted && !t.completed && t.targetDate !== 'daily')
    if (activeTodos.length > 0) {
      const header = `### PENDING TASKS (${activeTodos.length})\n`
      contextStr += header
      ctxChars += header.length
      for (const t of activeTodos.slice(0, 10)) {
        const line = `- ${t.text}\n`
        if (ctxChars + line.length > MAX_CONTEXT_CHARS * 0.45) break
        contextStr += line
        ctxChars += line.length
      }
      contextStr += "\n"
      ctxChars += 1
    }

    // Always include today's hourly logs as baseline
    if (contextCache.recentLogs && ctxChars < MAX_CONTEXT_CHARS * 0.6) {
      const logSection = `### TODAY'S LOG\n${contextCache.recentLogs.substring(0, MAX_CONTEXT_CHARS * 0.3)}\n\n`
      contextStr += logSection
      ctxChars += logSection.length
    }

    if (retrievedItems.length > 0) {
      contextStr += "### RELEVANT RECORDS\n"
      ctxChars += 20
      for (const item of retrievedItems) {
        const prefix = item.type === "log" ? `[Log ${item.id}]` : `[${item.title}]`
        const line = `> ${prefix}: ${processContent(item.content).substring(0, 300)}\n`
        if (ctxChars + line.length > MAX_CONTEXT_CHARS) break
        contextStr += line
        ctxChars += line.length
      }
      contextStr += "\n"
    } else {
      const fallback = contextCache.recentNotes.slice(0, 3)
      if (fallback.length > 0) {
        contextStr += "### RECENT NOTES (POSSIBLY RELATED)\n"
        ctxChars += 35
        for (const n of fallback) {
          const line = `> ${n.title}: ${processContent(n.content).substring(0, 300)}\n`
          if (ctxChars + line.length > MAX_CONTEXT_CHARS) break
          contextStr += line
          ctxChars += line.length
        }
        contextStr += "\n"
      } else {
        contextStr += "### NOTE\nNo relevant notes, tasks, or logs were found.\nDo NOT invent information.\n\n"
      }
    }

    return contextStr.trim()

  } catch (err) {

    console.error("RAG Builder Error:", err)
    return ""

  }

}