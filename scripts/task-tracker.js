#!/usr/bin/env node

/**
 * Task Tracker - Utility for managing task timestamps and credits in markdown files
 * 
 * Usage:
 *   node scripts/task-tracker.js start <task-file> <task-number>
 *   node scripts/task-tracker.js complete <task-file> <task-number>
 *   node scripts/task-tracker.js credits <task-file> <task-number> <credits>
 *   node scripts/task-tracker.js status <task-file>
 * 
 * Examples:
 *   node scripts/task-tracker.js start .kiro/specs/stage-03/tasks.md 1
 *   node scripts/task-tracker.js complete .kiro/specs/stage-03/tasks.md 1
 *   node scripts/task-tracker.js credits .kiro/specs/stage-03/tasks.md 1 0.11
 *   node scripts/task-tracker.js status .kiro/specs/stage-03/tasks.md
 */

import fs from 'fs';
import path from 'path';

const TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:MM';

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseTimestamp(timestampStr) {
  const match = timestampStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!match) return null;
  
  const [, year, month, day, hours, minutes] = match;
  return new Date(year, month - 1, day, hours, minutes);
}

function calculateDuration(startStr, endStr) {
  const start = parseTimestamp(startStr);
  const end = parseTimestamp(endStr);
  
  if (!start || !end) return null;
  
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function findTaskInContent(content, taskNumber) {
  // Match task patterns like "- [x] 1." or "- [ ] 1." or "  - [x] 1.1"
  const taskPattern = new RegExp(
    `^(\\s*- \\[[x ]\\] ${taskNumber}(?:\\.\\d+)?\\.)`,
    'gm'
  );
  
  const match = taskPattern.exec(content);
  if (!match) return null;
  
  const taskStart = match.index;
  const taskPrefix = match[1];
  
  // Find the end of this task (next task at same or higher level, or end of file)
  const indentLevel = taskPrefix.match(/^\s*/)[0].length;
  const nextTaskPattern = new RegExp(
    `^\\s{0,${indentLevel}}- \\[[x ]\\] \\d+`,
    'gm'
  );
  
  nextTaskPattern.lastIndex = taskStart + match[0].length;
  const nextMatch = nextTaskPattern.exec(content);
  const taskEnd = nextMatch ? nextMatch.index : content.length;
  
  return {
    start: taskStart,
    end: taskEnd,
    content: content.substring(taskStart, taskEnd),
    prefix: taskPrefix,
    indentLevel
  };
}

function addTimestamp(taskContent, type, timestamp) {
  const indent = taskContent.match(/^\s*/)[0];
  const timestampLine = `${indent}  - _${type}: ${timestamp}_\n`;
  
  // Check if timestamp already exists
  const existingPattern = new RegExp(`${indent}  - _${type}:.*_`, 'gm');
  if (existingPattern.test(taskContent)) {
    // Replace existing timestamp
    return taskContent.replace(existingPattern, timestampLine.trim());
  }
  
  // Add new timestamp before the next task or at the end
  const lines = taskContent.split('\n');
  let insertIndex = lines.length - 1;
  
  // Find the last line with content (before empty lines)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      insertIndex = i + 1;
      break;
    }
  }
  
  lines.splice(insertIndex, 0, timestampLine.trim());
  return lines.join('\n');
}

function markTaskComplete(taskContent) {
  return taskContent.replace(/^(\s*- )\[ \]/, '$1[x]');
}

function startTask(filePath, taskNumber) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = findTaskInContent(content, taskNumber);
  
  if (!task) {
    console.error(`Error: Task ${taskNumber} not found in ${filePath}`);
    process.exit(1);
  }
  
  const timestamp = formatTimestamp();
  const updatedTask = addTimestamp(task.content, 'Started', timestamp);
  const updatedContent = 
    content.substring(0, task.start) +
    updatedTask +
    content.substring(task.end);
  
  fs.writeFileSync(filePath, updatedContent, 'utf-8');
  
  console.log(`✓ Started task ${taskNumber} at ${timestamp}`);
  console.log(`  File: ${filePath}`);
}

function completeTask(filePath, taskNumber) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = findTaskInContent(content, taskNumber);
  
  if (!task) {
    console.error(`Error: Task ${taskNumber} not found in ${filePath}`);
    process.exit(1);
  }
  
  const timestamp = formatTimestamp();
  let updatedTask = markTaskComplete(task.content);
  updatedTask = addTimestamp(updatedTask, 'Completed', timestamp);
  
  // Calculate duration if start time exists
  const startMatch = task.content.match(/_Started: ([\d-: ]+)_/);
  if (startMatch) {
    const duration = calculateDuration(startMatch[1], timestamp);
    if (duration) {
      updatedTask = addTimestamp(updatedTask, 'Duration', duration);
    }
  }
  
  const updatedContent = 
    content.substring(0, task.start) +
    updatedTask +
    content.substring(task.end);
  
  fs.writeFileSync(filePath, updatedContent, 'utf-8');
  
  console.log(`✓ Completed task ${taskNumber} at ${timestamp}`);
  if (startMatch) {
    const duration = calculateDuration(startMatch[1], timestamp);
    if (duration) {
      console.log(`  Duration: ${duration}`);
    }
  }
  console.log(`  File: ${filePath}`);
}

function addCredits(filePath, taskNumber, credits) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = findTaskInContent(content, taskNumber);
  
  if (!task) {
    console.error(`Error: Task ${taskNumber} not found in ${filePath}`);
    process.exit(1);
  }
  
  const creditsNum = parseFloat(credits);
  if (isNaN(creditsNum) || creditsNum < 0) {
    console.error(`Error: Invalid credits value: ${credits}`);
    process.exit(1);
  }
  
  // Check if credits already exist
  const creditsMatch = task.content.match(/_Credits: ([\d.]+)_/);
  let updatedTask;
  
  if (creditsMatch) {
    // Add to existing credits
    const existingCredits = parseFloat(creditsMatch[1]);
    const totalCredits = (existingCredits + creditsNum).toFixed(2);
    updatedTask = task.content.replace(
      /_Credits: [\d.]+_/,
      `_Credits: ${totalCredits}_`
    );
    console.log(`✓ Added ${creditsNum.toFixed(2)} credits to task ${taskNumber}`);
    console.log(`  Previous: ${existingCredits.toFixed(2)}`);
    console.log(`  Total: ${totalCredits}`);
  } else {
    // Add new credits line
    updatedTask = addTimestamp(task.content, 'Credits', creditsNum.toFixed(2));
    console.log(`✓ Added ${creditsNum.toFixed(2)} credits to task ${taskNumber}`);
  }
  
  const updatedContent = 
    content.substring(0, task.start) +
    updatedTask +
    content.substring(task.end);
  
  fs.writeFileSync(filePath, updatedContent, 'utf-8');
  console.log(`  File: ${filePath}`);
}

function showStatus(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all tasks with timestamps
  const taskPattern = /^(\s*- \[([x ])\] (\d+(?:\.\d+)?)\.).*$/gm;
  const tasks = [];
  let match;
  
  while ((match = taskPattern.exec(content)) !== null) {
    const taskNumber = match[3];
    const isComplete = match[2] === 'x';
    const task = findTaskInContent(content, taskNumber);
    
    if (task) {
      const startMatch = task.content.match(/_Started: ([\d-: ]+)_/);
      const completeMatch = task.content.match(/_Completed: ([\d-: ]+)_/);
      const durationMatch = task.content.match(/_Duration: (.+)_/);
      const creditsMatch = task.content.match(/_Credits: ([\d.]+)_/);
      
      if (startMatch || completeMatch || creditsMatch) {
        tasks.push({
          number: taskNumber,
          complete: isComplete,
          started: startMatch ? startMatch[1] : null,
          completed: completeMatch ? completeMatch[1] : null,
          duration: durationMatch ? durationMatch[1] : null,
          credits: creditsMatch ? parseFloat(creditsMatch[1]) : null
        });
      }
    }
  }
  
  if (tasks.length === 0) {
    console.log('No tasks with timestamps found.');
    return;
  }
  
  console.log(`\nTask Status for ${path.basename(filePath)}:\n`);
  console.log('Task | Status   | Started          | Completed        | Duration | Credits');
  console.log('-----|----------|------------------|------------------|----------|--------');
  
  for (const task of tasks) {
    const status = task.complete ? '✓ Done' : '⧗ Active';
    const started = task.started || '-';
    const completed = task.completed || '-';
    const duration = task.duration || '-';
    const credits = task.credits !== null ? task.credits.toFixed(2) : '-';
    
    console.log(
      `${task.number.padEnd(4)} | ${status.padEnd(8)} | ${started.padEnd(16)} | ${completed.padEnd(16)} | ${duration.padEnd(8)} | ${credits}`
    );
  }
  
  // Calculate totals
  const completedTasks = tasks.filter(t => t.complete);
  const activeTasks = tasks.filter(t => !t.complete);
  
  console.log('\nSummary:');
  console.log(`  Total tasks tracked: ${tasks.length}`);
  console.log(`  Completed: ${completedTasks.length}`);
  console.log(`  Active: ${activeTasks.length}`);
  
  if (completedTasks.length > 0) {
    const totalMinutes = completedTasks.reduce((sum, task) => {
      if (!task.duration) return sum;
      const match = task.duration.match(/(?:(\d+)h )?(\d+)m/);
      if (!match) return sum;
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2]);
      return sum + (hours * 60) + minutes;
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    console.log(`  Total time: ${hours}h ${minutes}m`);
  }
  
  // Calculate total credits
  const totalCredits = tasks.reduce((sum, task) => {
    return sum + (task.credits || 0);
  }, 0);
  
  if (totalCredits > 0) {
    console.log(`  Total credits: ${totalCredits.toFixed(2)}`);
  }
}

// Main CLI
const [,, command, filePath, taskNumber, creditsOrExtra] = process.argv;

if (!command) {
  console.log('Usage:');
  console.log('  node scripts/task-tracker.js start <task-file> <task-number>');
  console.log('  node scripts/task-tracker.js complete <task-file> <task-number>');
  console.log('  node scripts/task-tracker.js credits <task-file> <task-number> <credits>');
  console.log('  node scripts/task-tracker.js status <task-file>');
  process.exit(1);
}

switch (command) {
  case 'start':
    if (!filePath || !taskNumber) {
      console.error('Error: Missing arguments');
      console.log('Usage: node scripts/task-tracker.js start <task-file> <task-number>');
      process.exit(1);
    }
    startTask(filePath, taskNumber);
    break;
    
  case 'complete':
    if (!filePath || !taskNumber) {
      console.error('Error: Missing arguments');
      console.log('Usage: node scripts/task-tracker.js complete <task-file> <task-number>');
      process.exit(1);
    }
    completeTask(filePath, taskNumber);
    break;
    
  case 'credits':
    if (!filePath || !taskNumber || !creditsOrExtra) {
      console.error('Error: Missing arguments');
      console.log('Usage: node scripts/task-tracker.js credits <task-file> <task-number> <credits>');
      process.exit(1);
    }
    addCredits(filePath, taskNumber, creditsOrExtra);
    break;
    
  case 'status':
    if (!filePath) {
      console.error('Error: Missing file path');
      console.log('Usage: node scripts/task-tracker.js status <task-file>');
      process.exit(1);
    }
    showStatus(filePath);
    break;
    
  default:
    console.error(`Error: Unknown command: ${command}`);
    console.log('Valid commands: start, complete, credits, status');
    process.exit(1);
}
