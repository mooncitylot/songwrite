const editorWrapper = document.getElementById("editorWrapper");
const editor = document.getElementById("editor");
const lineNumbers = document.getElementById("lineNumbers");
const syllableCounts = document.getElementById("syllableCounts");
const rhymeIndicators = document.getElementById("rhymeIndicators");
const flagGutter = document.getElementById("flagGutter");
const highlightInner = document.getElementById("highlightInner");
const flagSummary = document.getElementById("flagSummary");

// Everything that has to line up with the textarea, top to bottom
const scrollTracks = [
  flagGutter,
  syllableCounts,
  highlightInner,
  rhymeIndicators,
  lineNumbers,
];

// LocalStorage keys
const STORAGE_KEY = "songwriting-editor-content";
const FLAGS_KEY = "songwriting-editor-flags";

// Break marker constant
const BREAK_MARKER = "---";

const FLAG_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path d="M3.4 1.6v12.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M3.4 2.6h8.8l-2.1 2.9 2.1 2.9H3.4z" fill="currentColor"/></svg>`;

// Line indices (0-based) marked "Needs Improvement"
let flaggedLines = new Set();

// Snapshot of the lines from the previous render, used to keep flags attached
// to their lines when text is inserted or deleted above them.
let previousLines = [];

// Load saved content from localStorage on page load
function loadSavedContent() {
  const savedContent = localStorage.getItem(STORAGE_KEY);
  if (savedContent) {
    editor.value = savedContent;
  }

  try {
    const savedFlags = JSON.parse(localStorage.getItem(FLAGS_KEY) || "[]");
    if (Array.isArray(savedFlags)) {
      flaggedLines = new Set(savedFlags.filter((n) => Number.isInteger(n)));
    }
  } catch (err) {
    flaggedLines = new Set();
  }

  previousLines = editor.value.split("\n");
}

// Save content to localStorage
function saveContent() {
  localStorage.setItem(STORAGE_KEY, editor.value);
  localStorage.setItem(FLAGS_KEY, JSON.stringify([...flaggedLines]));
}

// Syllable counting algorithm
function countSyllables(word) {
  word = word.toLowerCase().trim();
  if (word.length === 0) return 0;

  // Remove punctuation
  word = word.replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;

  // Special cases
  const specialCases = {
    the: 1,
    a: 1,
    i: 1,
    are: 1,
    fire: 2,
    hour: 2,
    our: 2,
    every: 3,
    being: 2,
    quiet: 2,
    poem: 2,
  };

  if (specialCases[word]) {
    return specialCases[word];
  }

  // Count vowel groups
  let count = 0;
  let previousWasVowel = false;
  const vowels = "aeiouy";

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);

    if (isVowel && !previousWasVowel) {
      count++;
    }

    previousWasVowel = isVowel;
  }

  // Adjust for silent 'e' at the end
  if (word.endsWith("e") && count > 1) {
    count--;
  }

  // Adjust for words ending in 'le' (like 'table')
  if (
    word.length > 2 &&
    word.endsWith("le") &&
    !vowels.includes(word[word.length - 3])
  ) {
    count++;
  }

  // Every word has at least one syllable
  return Math.max(1, count);
}

// Get last word from a line
function getLastWord(line) {
  const trimmed = line.trim();
  if (!trimmed) return "";

  // Remove punctuation and get last word
  const words = trimmed.replace(/[.,!?;:"'()[\]{}]/g, "").split(/\s+/);
  return words[words.length - 1].toLowerCase();
}

// Normalize a word to letters only for rhyme analysis
function normalizeWord(rawWord) {
  if (!rawWord) return "";

  return rawWord.toLowerCase().replace(/[^a-z]/g, "");
}

// Extract the final vowel cluster and trailing consonants (rime)
function getRimeParts(rawWord) {
  const normalized = normalizeWord(rawWord);
  if (!normalized) {
    return { vowelCluster: "", coda: "", rime: "", ending: "" };
  }

  const vowels = "aeiouy";
  let index = normalized.length - 1;
  let coda = "";
  let vowelCluster = "";

  // Collect trailing consonants
  while (index >= 0 && !vowels.includes(normalized[index])) {
    coda = normalized[index] + coda;
    index--;
  }

  // Collect the last vowel cluster
  while (index >= 0 && vowels.includes(normalized[index])) {
    vowelCluster = normalized[index] + vowelCluster;
    index--;
  }

  if (!vowelCluster) {
    return {
      vowelCluster: "",
      coda: "",
      rime: "",
      ending: normalized.slice(-3),
    };
  }

  const rime = vowelCluster + coda;
  return {
    vowelCluster,
    coda,
    rime,
    ending: normalized.slice(-3),
  };
}

// Get vowel sounds from a word
function getVowelSounds(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  const vowels = "aeiouy";
  let sounds = "";

  for (let char of word) {
    if (vowels.includes(char)) {
      sounds += char;
    }
  }

  return sounds;
}

// Get phonetic patterns for rhyme and assonance detection
function getPhoneticPattern(word) {
  const parts = getRimeParts(word);
  return {
    vowelSound: parts.vowelCluster.toUpperCase(),
    consonantEnding: parts.coda,
    exactEnding: parts.ending,
  };
}

// Check if two words rhyme (perfect rhyme)
function isRhyme(word1, word2) {
  const first = normalizeWord(word1);
  const second = normalizeWord(word2);
  if (!first || !second || first === second) return false;

  const parts1 = getRimeParts(first);
  const parts2 = getRimeParts(second);
  if (!parts1.vowelCluster || !parts2.vowelCluster) return false;

  // Exact rime match (last vowel cluster + trailing consonants)
  if (parts1.rime === parts2.rime) return true;

  // Fallback: exact ending match of 2+ letters
  if (parts1.ending === parts2.ending && parts1.ending.length >= 2) return true;

  return false;
}

// Check for near rhyme (slant rhyme) - similar ending sounds but not perfect
function isNearRhyme(word1, word2) {
  const first = normalizeWord(word1);
  const second = normalizeWord(word2);
  if (!first || !second || first === second) return false;
  if (isRhyme(word1, word2)) return false; // Don't count perfect rhymes

  const pattern1 = getPhoneticPattern(first);
  const pattern2 = getPhoneticPattern(second);

  // Near rhyme / assonance: same vowel cluster but different consonant ending
  if (
    pattern1.vowelSound &&
    pattern1.vowelSound === pattern2.vowelSound &&
    pattern1.consonantEnding !== pattern2.consonantEnding
  ) {
    return true;
  }

  // Soft consonant alignment with slightly different vowels (e.g., time / fine)
  if (
    pattern1.consonantEnding &&
    pattern1.consonantEnding === pattern2.consonantEnding &&
    pattern1.vowelSound !== pattern2.vowelSound
  ) {
    return true;
  }

  return false;
}

// Check if two words have assonance (similar vowel sounds) - now handled by isNearRhyme
// Kept for backwards compatibility
function isAssonance(word1, word2) {
  return isNearRhyme(word1, word2);
}

function countLineSyllables(line) {
  if (!line.trim()) return 0;

  const words = line.split(/\s+/);
  let total = 0;

  for (const word of words) {
    if (word.trim()) {
      total += countSyllables(word);
    }
  }

  return total;
}

function escapeHtml(text) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char])
  );
}

// A hidden clone of the textarea's text box. Rendering the lines into it lets
// us read back how tall each line actually is once soft wrapping is applied,
// which is what keeps the gutters aligned with long lines.
const measureMirror = document.createElement("div");
measureMirror.className = "measure-mirror";
measureMirror.setAttribute("aria-hidden", "true");
document.body.appendChild(measureMirror);

function measureLineHeights(lines) {
  const style = getComputedStyle(editor);
  const contentWidth =
    editor.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);

  measureMirror.style.fontFamily = style.fontFamily;
  measureMirror.style.fontSize = style.fontSize;
  measureMirror.style.fontWeight = style.fontWeight;
  measureMirror.style.fontStyle = style.fontStyle;
  measureMirror.style.letterSpacing = style.letterSpacing;
  measureMirror.style.lineHeight = style.lineHeight;
  measureMirror.style.tabSize = style.tabSize;
  measureMirror.style.width = Math.max(0, contentWidth) + "px";

  // Zero-width space keeps empty lines one row tall
  measureMirror.innerHTML = lines
    .map((line) => `<div>${escapeHtml(line) || "&#8203;"}</div>`)
    .join("");

  return Array.from(measureMirror.children).map(
    (child) => child.getBoundingClientRect().height
  );
}

// Keep flags attached to their lines across edits by diffing the old and new
// line arrays: anything before the edit keeps its index, anything after shifts,
// and flags on lines that were rewritten are dropped.
function remapFlags(oldLines, newLines, flags) {
  if (flags.size === 0) return flags;
  if (oldLines.length === newLines.length) return flags;

  const shortest = Math.min(oldLines.length, newLines.length);
  let start = 0;
  while (start < shortest && oldLines[start] === newLines[start]) {
    start++;
  }

  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (
    oldEnd >= start &&
    newEnd >= start &&
    oldLines[oldEnd] === newLines[newEnd]
  ) {
    oldEnd--;
    newEnd--;
  }

  const delta = newLines.length - oldLines.length;
  const remapped = new Set();

  for (const index of flags) {
    if (index < start) {
      remapped.add(index);
    } else if (index > oldEnd) {
      remapped.add(index + delta);
    }
  }

  return remapped;
}

function isFlaggable(line) {
  return Boolean(line.trim()) && line.trim() !== BREAK_MARKER;
}

function toggleFlag(index) {
  if (flaggedLines.has(index)) {
    flaggedLines.delete(index);
  } else {
    flaggedLines.add(index);
  }
  updateEditor();
}

function updateEditor() {
  const lines = editor.value.split("\n");

  // Reconcile flags with the edit that just happened, then discard any that no
  // longer point at real, flaggable lines.
  flaggedLines = remapFlags(previousLines, lines, flaggedLines);
  flaggedLines = new Set(
    [...flaggedLines].filter(
      (index) => index >= 0 && index < lines.length && isFlaggable(lines[index])
    )
  );
  previousLines = lines;

  saveContent();

  const lineHeights = measureLineHeights(lines);

  // Get last words for rhyme detection
  const lastWords = lines.map((line) => getLastWord(line));

  // Find break positions (lines that contain only ---)
  const breakPositions = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === BREAK_MARKER) {
      breakPositions.push(i);
    }
  }

  // Function to check if two line indices are in the same section (not separated by a break)
  const inSameSection = (i, j) => {
    for (const breakPos of breakPositions) {
      if ((i < breakPos && j >= breakPos) || (j < breakPos && i >= breakPos)) {
        return false;
      }
    }
    return true;
  };

  // Build rhyme, near rhyme, and assonance groups
  const rhymeGroups = [];
  const nearRhymeGroups = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim() || lines[i].trim() === BREAK_MARKER) continue;

    // Check if already in a rhyme group
    let inRhymeGroup = rhymeGroups.some((group) => group.includes(i));

    if (!inRhymeGroup) {
      const rhymeGroup = [i];
      for (let j = i + 1; j < lines.length; j++) {
        if (
          lines[j].trim() &&
          lines[j].trim() !== BREAK_MARKER &&
          inSameSection(i, j) &&
          isRhyme(lastWords[i], lastWords[j])
        ) {
          rhymeGroup.push(j);
        }
      }
      if (rhymeGroup.length > 1) {
        rhymeGroups.push(rhymeGroup);
      }
    }

    // Check if already in a near rhyme/assonance group
    let inNearRhymeGroup = nearRhymeGroups.some((group) => group.includes(i));

    if (!inNearRhymeGroup && !inRhymeGroup) {
      const nearRhymeGroup = [i];
      for (let j = i + 1; j < lines.length; j++) {
        if (
          lines[j].trim() &&
          lines[j].trim() !== BREAK_MARKER &&
          inSameSection(i, j) &&
          isNearRhyme(lastWords[i], lastWords[j])
        ) {
          nearRhymeGroup.push(j);
        }
      }
      if (nearRhymeGroup.length > 1) {
        nearRhymeGroups.push(nearRhymeGroup);
      }
    }
  }

  // Every track uses the measured height of its line so wrapped lines and the
  // rows beside them never drift apart.
  const cell = (index, inner, extraClass = "") =>
    `<div class="gutter-cell${extraClass ? " " + extraClass : ""}" style="height:${
      lineHeights[index]
    }px">${inner}</div>`;

  // Update line numbers
  lineNumbers.innerHTML = lines
    .map((line, i) => cell(i, line.trim() === BREAK_MARKER ? "—" : i + 1))
    .join("");

  // Update syllable counts
  syllableCounts.innerHTML = lines
    .map((line, i) => {
      if (line.trim() === BREAK_MARKER) return cell(i, "");
      return cell(i, line.trim() ? String(countLineSyllables(line)) : "");
    })
    .join("");

  // Update flag buttons
  flagGutter.innerHTML = lines
    .map((line, i) => {
      if (!isFlaggable(line)) return cell(i, "");

      const flagged = flaggedLines.has(i);
      const label = flagged
        ? `Line ${i + 1} flagged as Needs Improvement. Click to clear.`
        : `Flag line ${i + 1} as Needs Improvement`;

      return cell(
        i,
        `<button type="button" class="flag-btn${
          flagged ? " flagged" : ""
        }" data-line="${i}" aria-pressed="${flagged}" title="${label}" aria-label="${label}">${FLAG_ICON}</button>`
      );
    })
    .join("");

  // Update the flagged-line highlight behind the textarea
  highlightInner.innerHTML = lines
    .map(
      (_line, i) =>
        `<div class="highlight-row${
          flaggedLines.has(i) ? " flagged" : ""
        }" style="height:${lineHeights[i]}px"></div>`
    )
    .join("");

  // Update rhyme indicators with colors
  rhymeIndicators.innerHTML = lines
    .map((line, i) => {
      if (!line.trim() || line.trim() === BREAK_MARKER) {
        return cell(i, "");
      }

      // Check if in a rhyme group and get color (filled dot)
      const rhymeGroupIndex = rhymeGroups.findIndex((group) =>
        group.includes(i)
      );
      if (rhymeGroupIndex !== -1) {
        // Cycle through 30 colors
        return cell(
          i,
          '<div class="rhyme-dot"></div>',
          `rhyme-color-${rhymeGroupIndex % 30}`
        );
      }

      // Check if in a near rhyme/assonance group (outlined dot)
      const nearRhymeGroupIndex = nearRhymeGroups.findIndex((group) =>
        group.includes(i)
      );
      if (nearRhymeGroupIndex !== -1) {
        return cell(
          i,
          '<div class="rhyme-dot near-rhyme"></div>',
          `rhyme-color-${nearRhymeGroupIndex % 30}`
        );
      }

      return cell(i, "");
    })
    .join("");

  const flaggedCount = flaggedLines.size;
  flagSummary.textContent = flaggedCount
    ? `${flaggedCount} line${flaggedCount === 1 ? "" : "s"} need improvement`
    : "";

  syncScroll();
}

// The gutters and the highlight layer are fixed viewports; move their inner
// tracks instead of relying on scrollTop, which overflow:hidden ignores.
function syncScroll() {
  const offset = `translateY(${-editor.scrollTop}px)`;
  for (const track of scrollTracks) {
    track.style.transform = offset;
  }
}

let scrollFrame = null;
function requestSyncScroll() {
  if (scrollFrame !== null) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null;
    syncScroll();
  });
}

// Event listeners
editor.addEventListener("input", updateEditor);
editor.addEventListener("scroll", requestSyncScroll);

// The wrapper is wider than the textarea, so forward wheel scrolling that
// starts over a gutter into the editor.
editorWrapper.addEventListener(
  "wheel",
  (event) => {
    if (event.target === editor) return;
    editor.scrollTop += event.deltaY;
    event.preventDefault();
    syncScroll();
  },
  { passive: false }
);

flagGutter.addEventListener("click", (event) => {
  const button = event.target.closest(".flag-btn");
  if (!button) return;
  toggleFlag(Number(button.dataset.line));
});

// Re-measure when the wrap width changes
window.addEventListener("resize", updateEditor);

// Initialize
loadSavedContent(); // Load saved content first
updateEditor();

// Button event listeners
document.getElementById("insertBreak").addEventListener("click", () => {
  const cursorPosition = editor.selectionStart;
  const textBefore = editor.value.substring(0, cursorPosition);
  const textAfter = editor.value.substring(cursorPosition);

  // Insert break marker at cursor position
  editor.value = textBefore + "\n---\n" + textAfter;

  // Move cursor after the inserted break
  const newCursorPosition = cursorPosition + 5; // length of '\n---\n'
  editor.setSelectionRange(newCursorPosition, newCursorPosition);
  editor.focus();

  updateEditor();
});

document.getElementById("removeBlankLines").addEventListener("click", () => {
  const lines = editor.value.split("\n");
  const keptLines = [];
  const remapped = new Set();

  // Track where each surviving line lands so flags move with it
  lines.forEach((line, index) => {
    if (line.trim() === "") return;
    if (flaggedLines.has(index)) {
      remapped.add(keptLines.length);
    }
    keptLines.push(line);
  });

  flaggedLines = remapped;
  editor.value = keptLines.join("\n");
  previousLines = keptLines; // skip the generic diff, we just did the remap
  updateEditor();
});

document.getElementById("clearFlags").addEventListener("click", () => {
  flaggedLines = new Set();
  updateEditor();
});

document.getElementById("clearAll").addEventListener("click", () => {
  if (
    confirm(
      "Are you sure you want to clear all content? This cannot be undone."
    )
  ) {
    editor.value = "";
    flaggedLines = new Set();
    previousLines = [""];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FLAGS_KEY);
    updateEditor();
    editor.focus();
  }
});

document.getElementById("downloadTxt").addEventListener("click", () => {
  const text = editor.value;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lyrics.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document
  .getElementById("copyToClipboard")
  .addEventListener("click", async () => {
    const text = editor.value;
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById("copyToClipboard");
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy to clipboard");
    }
  });
