#!/usr/bin/env node

/**
 * Task Tracker - Adds timestamps to markdown task files
 * 
 * Usage:
 *   node scripts/task-tracker.js start <task-file>
 *   node scripts/task-tracker.js complete <task-file>
 */

import fs from 'fs';
import readline from 'readline';

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

function promptForCredits() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Enter credits used (or press Enter to skip): ', (answer) => {
      rl.close();
      const credits = parseFloat(answer.trim());
      resolve(isNaN(credits) || credits < 0 ? null : credits.toFixed(2));
    });
  });
}

/**
 * Find the first uncompleted task and return its line index
 */
function findFirstUncompletedTaskLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^(\s*)- \[ \] \d+/)) {
      return i;
    }
  }
  return -1;
}

/**
 * Find the task with Started but no Completed timestamp
 */
function findTaskWithStartedNoCompleted(lines) {
  let latestTaskLine = -1;
  let latestStartTime = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this is a task line
    if (!line.match(/^(\s*)- \[[x\-\s]\] \d+/)) continue;
    
    const taskLineIndex = i;
    const taskIndent = line.match(/^(\s*)/)[1].length;
    
    // Look for Started and Completed in the task's child lines
    let hasStarted = false;
    let hasCompleted = false;
    let startTime = null;
    
    for (let j = i + 1; j < lines.length; j++) {
      const childLine = lines[j];
      
      // Empty line or another task at same/lower indent = end of this task
      if (childLine.trim() === '') break;
      const childMatch = childLine.match(/^(\s*)- \[[x\-\s]\] \d+/);
      if (childMatch && childMatch[1].length <= taskIndent) break;
      
      // Check for timestamps
      const startMatch = childLine.match(/_Started: ([\d\-: ]+)_/);
      if (startMatch) {
        hasStarted = true;
        startTime = parseTimestamp(startMatch[1]);
      }
      if (childLine.includes('_Completed:')) {
        hasCompleted = true;
      }
    }
    
    if (hasStarted && !hasCompleted) {
      if (!latestStartTime || (startTime && startTime > latestStartTime)) {
        latestStartTime = startTime;
        latestTaskLine = taskLineIndex;
      }
    }
  }
  
  return latestTaskLine;
}

/**
 * Find where to insert a timestamp for a task starting at taskLineIndex
 * Returns the line index where the timestamp should be inserted
 */
function findTimestampInsertLine(lines, taskLineIndex) {
  const taskLine = lines[taskLineIndex];
  const taskIndent = taskLine.match(/^(\s*)/)[1].length;
  
  // Start from the line after the task
  for (let i = taskLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Empty line = insert before it
    if (line.trim() === '') {
      return i;
    }
    
    // Another task at same or lower indent = insert before it
    const taskMatch = line.match(/^(\s*)- \[[x\-\s]\] \d+/);
    if (taskMatch && taskMatch[1].length <= taskIndent) {
      return i;
    }
    
    // If we hit an existing timestamp, insert after all timestamps
    if (line.match(/^\s+- _(?:Started|Completed|Duration|Credits):/)) {
      // Find the last timestamp line
      let lastTimestampLine = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^\s+- _(?:Started|Completed|Duration|Credits):/)) {
          lastTimestampLine = j;
        } else {
          break;
        }
      }
      return lastTimestampLine + 1;
    }
  }
  
  // If we reach end of file, insert at end
  return lines.length;
}

/**
 * Get the task number from a task line
 */
function getTaskNumber(taskLine) {
  const match = taskLine.match(/- \[[x\-\s]\] (\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

function startTask(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const taskLineIndex = findFirstUncompletedTaskLine(lines);
  
  if (taskLineIndex === -1) {
    console.error('Error: No uncompleted tasks found');
    process.exit(1);
  }
  
  const taskNumber = getTaskNumber(lines[taskLineIndex]);
  const taskIndent = lines[taskLineIndex].match(/^(\s*)/)[1];
  const timestamp = formatTimestamp();
  const timestampLine = `${taskIndent}  - _Started: ${timestamp}_`;
  
  const insertIndex = findTimestampInsertLine(lines, taskLineIndex);
  
  // Insert the timestamp line
  lines.splice(insertIndex, 0, timestampLine);
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  
  console.log(`✓ Started task ${taskNumber} at ${timestamp}`);
  console.log(`  File: ${filePath}`);
}

async function completeTask(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const taskLineIndex = findTaskWithStartedNoCompleted(lines);
  
  if (taskLineIndex === -1) {
    console.error('Error: No task with Started timestamp (and no Completed) found');
    process.exit(1);
  }
  
  const taskNumber = getTaskNumber(lines[taskLineIndex]);
  const taskIndent = lines[taskLineIndex].match(/^(\s*)/)[1];
  const timestamp = formatTimestamp();
  
  // Mark the task as completed by changing [ ] to [x]
  lines[taskLineIndex] = lines[taskLineIndex].replace(/- \[ \]/, '- [x]');
  
  // Find the Started timestamp for duration calculation
  let startTimestamp = null;
  for (let i = taskLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') break;
    const startMatch = line.match(/_Started: ([\d\-: ]+)_/);
    if (startMatch) {
      startTimestamp = startMatch[1];
      break;
    }
  }
  
  const insertIndex = findTimestampInsertLine(lines, taskLineIndex);
  
  // Build timestamp lines to insert
  const newLines = [];
  newLines.push(`${taskIndent}  - _Completed: ${timestamp}_`);
  
  if (startTimestamp) {
    const duration = calculateDuration(startTimestamp, timestamp);
    if (duration) {
      newLines.push(`${taskIndent}  - _Duration: ${duration}_`);
    }
  }
  
  const credits = await promptForCredits();
  if (credits !== null) {
    newLines.push(`${taskIndent}  - _Credits: ${credits}_`);
  }
  
  // Insert all new lines
  lines.splice(insertIndex, 0, ...newLines);
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  
  console.log(`✓ Completed task ${taskNumber} at ${timestamp}`);
  if (startTimestamp) {
    const duration = calculateDuration(startTimestamp, timestamp);
    if (duration) {
      console.log(`  Duration: ${duration}`);
    }
  }
  if (credits !== null) {
    console.log(`  Credits: ${credits}`);
  }
  console.log(`  File: ${filePath}`);
}

const [,, command, filePath] = process.argv;

if (!command) {
  console.log('Usage:');
  console.log('  node scripts/task-tracker.js start <task-file>');
  console.log('  node scripts/task-tracker.js complete <task-file>');
  process.exit(1);
}

switch (command) {
  case 'start':
    if (!filePath) {
      console.error('Error: Missing file path');
      console.log('Usage: node scripts/task-tracker.js start <task-file>');
      process.exit(1);
    }
    startTask(filePath);
    break;
    
  case 'complete':
    if (!filePath) {
      console.error('Error: Missing file path');
      console.log('Usage: node scripts/task-tracker.js complete <task-file>');
      process.exit(1);
    }
    await completeTask(filePath);
    break;
    
  default:
    console.error(`Error: Unknown command: ${command}`);
    console.log('Valid commands: start, complete');
    process.exit(1);
}
