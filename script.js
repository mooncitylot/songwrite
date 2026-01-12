const editor = document.getElementById('editor');
const lineNumbers = document.getElementById('lineNumbers');
const syllableCounts = document.getElementById('syllableCounts');
const rhymeIndicators = document.getElementById('rhymeIndicators');

// LocalStorage key
const STORAGE_KEY = 'songwriting-editor-content';

// Load saved content from localStorage on page load
function loadSavedContent() {
    const savedContent = localStorage.getItem(STORAGE_KEY);
    if (savedContent) {
        editor.value = savedContent;
    }
}

// Save content to localStorage
function saveContent() {
    localStorage.setItem(STORAGE_KEY, editor.value);
}

// Syllable counting algorithm
function countSyllables(word) {
    word = word.toLowerCase().trim();
    if (word.length === 0) return 0;
    
    // Remove punctuation
    word = word.replace(/[^a-z]/g, '');
    if (word.length === 0) return 0;
    
    // Special cases
    const specialCases = {
        'the': 1, 'a': 1, 'i': 1, 'are': 1, 'fire': 2, 'hour': 2,
        'our': 2, 'every': 3, 'being': 2, 'quiet': 2, 'poem': 2
    };
    
    if (specialCases[word]) {
        return specialCases[word];
    }
    
    // Count vowel groups
    let count = 0;
    let previousWasVowel = false;
    const vowels = 'aeiouy';
    
    for (let i = 0; i < word.length; i++) {
        const isVowel = vowels.includes(word[i]);
        
        if (isVowel && !previousWasVowel) {
            count++;
        }
        
        previousWasVowel = isVowel;
    }
    
    // Adjust for silent 'e' at the end
    if (word.endsWith('e') && count > 1) {
        count--;
    }
    
    // Adjust for words ending in 'le' (like 'table')
    if (word.length > 2 && word.endsWith('le') && !vowels.includes(word[word.length - 3])) {
        count++;
    }
    
    // Every word has at least one syllable
    return Math.max(1, count);
}

// Get last word from a line
function getLastWord(line) {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Remove punctuation and get last word
    const words = trimmed.replace(/[.,!?;:"'()[\]{}]/g, '').split(/\s+/);
    return words[words.length - 1].toLowerCase();
}

// Get vowel sounds from a word
function getVowelSounds(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    const vowels = 'aeiouy';
    let sounds = '';
    
    for (let char of word) {
        if (vowels.includes(char)) {
            sounds += char;
        }
    }
    
    return sounds;
}

// Get phonetic patterns for rhyme and assonance detection
function getPhoneticPattern(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length === 0) return { vowelSound: '', consonantEnding: '', exactEnding: '' };
    
    // Strip plural 's' or possessive 's to get the base sound
    // But only if it's just a trailing 's' and the word is long enough
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
        word = word.slice(0, -1);
    }
    
    // Extract the stressed vowel sound and consonant pattern from the ending
    const patterns = [
        // Short O/AH sounds (clock, top, stop, rock, drop, cop, treetop)
        // All variations of short 'o' or 'a' + consonants map to 'AH'
        { regex: /[oa][pbtdkgmnfvszlrw]+$/i, vowel: 'AH' },
        
        // OR/ORE sounds (more, door, core, floor, course, force, anymore)
        // Matches: -or, -ore, -oor, -our, -oar, -orse, -orce
        { regex: /[ou]r[csetd]*$/i, vowel: 'OR' },
        { regex: /ore$/i, vowel: 'OR' },
        { regex: /oor$/i, vowel: 'OR' },
        
        // Long A sounds (day, way, play, weigh)
        { regex: /ay$/i, vowel: 'AY' },
        { regex: /ey$/i, vowel: 'AY' },
        { regex: /eigh$/i, vowel: 'AY' },
        { regex: /ate$/i, vowel: 'AY' },
        
        // Long E sounds (tree, see, key, believe)
        { regex: /ee$/i, vowel: 'EE' },
        { regex: /ea$/i, vowel: 'EE' },
        { regex: /ey$/i, vowel: 'EE' },
        { regex: /ie$/i, vowel: 'EE' },
        { regex: /ieve$/i, vowel: 'EE' },
        
        // Long I sounds (time, mine, light, fight)
        { regex: /i[nm]e$/i, vowel: 'AY' },
        { regex: /ight$/i, vowel: 'AY' },
        { regex: /ite$/i, vowel: 'AY' },
        
        // OW sounds (now, how, down, town)
        { regex: /ow[nts]*$/i, vowel: 'OW' },
        { regex: /ou[nts]*$/i, vowel: 'OW' },
        
        // Long O sounds (go, flow, grow, though)
        { regex: /ow$/i, vowel: 'OH' },
        { regex: /ough$/i, vowel: 'OH' },
        { regex: /oe$/i, vowel: 'OH' },
        
        // OO sounds (blue, true, new, through)
        { regex: /ue$/i, vowel: 'OO' },
        { regex: /ew$/i, vowel: 'OO' },
        { regex: /oo$/i, vowel: 'OO' },
        
        // Short I sounds (string, thing, bring)
        { regex: /ing$/i, vowel: 'IH' },
        
        // Short A sounds (cat, bat, flat)
        { regex: /a[tpdkgn]+$/i, vowel: 'AE' },
    ];
    
    // Find matching pattern
    for (const pattern of patterns) {
        if (pattern.regex.test(word)) {
            return {
                vowelSound: pattern.vowel,
                exactEnding: word.slice(-3)
            };
        }
    }
    
    // Fallback: extract basic vowel pattern from the last syllable
    const vowels = 'aeiouy';
    let lastVowels = '';
    let foundVowels = 0;
    
    // Go backwards and collect vowels from the last part of the word
    for (let i = word.length - 1; i >= 0 && foundVowels < 2; i--) {
        if (vowels.includes(word[i])) {
            lastVowels = word[i] + lastVowels;
            foundVowels++;
        }
    }
    
    return {
        vowelSound: lastVowels.toUpperCase(),
        exactEnding: word.slice(-3)
    };
}

// Check if two words rhyme (perfect rhyme)
function isRhyme(word1, word2) {
    if (!word1 || !word2 || word1 === word2) return false;
    
    const minLength = Math.min(word1.length, word2.length);
    if (minLength < 2) return false;
    
    // Check last 2-3 characters for exact matches (perfect rhyme)
    if (minLength >= 2) {
        const end1 = word1.slice(-2);
        const end2 = word2.slice(-2);
        if (end1 === end2) return true;
    }
    
    if (minLength >= 3) {
        const end1 = word1.slice(-3);
        const end2 = word2.slice(-3);
        if (end1 === end2) return true;
    }
    
    return false;
}

// Check for near rhyme (slant rhyme) - similar ending sounds but not perfect
function isNearRhyme(word1, word2) {
    if (!word1 || !word2 || word1 === word2) return false;
    if (isRhyme(word1, word2)) return false; // Don't count perfect rhymes
    
    const pattern1 = getPhoneticPattern(word1);
    const pattern2 = getPhoneticPattern(word2);
    
    // Check if they share the same vowel sound (near rhyme/assonance)
    if (pattern1.vowelSound && pattern2.vowelSound && 
        pattern1.vowelSound === pattern2.vowelSound) {
        return true;
    }
    
    // Check for similar consonant endings with different vowels
    if (word1.length >= 2 && word2.length >= 2) {
        const lastConsonant1 = word1[word1.length - 1];
        const lastConsonant2 = word2[word2.length - 1];
        const consonants = 'bcdfghjklmnpqrstvwxyz';
        
        if (consonants.includes(lastConsonant1) && 
            consonants.includes(lastConsonant2) &&
            lastConsonant1 === lastConsonant2) {
            // Same ending consonant - check if vowels are similar
            const vowel1 = word1[word1.length - 2];
            const vowel2 = word2[word2.length - 2];
            if (vowel1 !== vowel2) return true; // Different vowel, same consonant = near rhyme
        }
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

function updateEditor() {
    const lines = editor.value.split('\n');
    const scrollTop = editor.scrollTop;
    
    // Save to localStorage whenever content updates
    saveContent();
    
    // Break marker constant
    const BREAK_MARKER = '---';
    
    // Get last words for rhyme detection
    const lastWords = lines.map(line => getLastWord(line));
    
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
        let inRhymeGroup = rhymeGroups.some(group => group.includes(i));
        
        if (!inRhymeGroup) {
            const rhymeGroup = [i];
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() && 
                    lines[j].trim() !== BREAK_MARKER && 
                    inSameSection(i, j) && 
                    isRhyme(lastWords[i], lastWords[j])) {
                    rhymeGroup.push(j);
                }
            }
            if (rhymeGroup.length > 1) {
                rhymeGroups.push(rhymeGroup);
            }
        }
        
        // Check if already in a near rhyme/assonance group
        let inNearRhymeGroup = nearRhymeGroups.some(group => group.includes(i));
        
        if (!inNearRhymeGroup && !inRhymeGroup) {
            const nearRhymeGroup = [i];
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() && 
                    lines[j].trim() !== BREAK_MARKER && 
                    inSameSection(i, j) && 
                    isNearRhyme(lastWords[i], lastWords[j])) {
                    nearRhymeGroup.push(j);
                }
            }
            if (nearRhymeGroup.length > 1) {
                nearRhymeGroups.push(nearRhymeGroup);
            }
        }
    }
    
    // Update line numbers
    lineNumbers.innerHTML = lines.map((line, i) => {
        if (line.trim() === BREAK_MARKER) {
            return '<div>—</div>';
        }
        return `<div>${i + 1}</div>`;
    }).join('');
    
    // Update syllable counts
    syllableCounts.innerHTML = lines.map(line => {
        if (line.trim() === BREAK_MARKER) {
            return '<div class="syllable-count"></div>';
        }
        const count = countLineSyllables(line);
        return `<div class="syllable-count">${line.trim() ? count : ''}</div>`;
    }).join('');
    
    // Update rhyme indicators with colors
    rhymeIndicators.innerHTML = lines.map((line, i) => {
        if (!line.trim() || line.trim() === BREAK_MARKER) {
            return '<div class="rhyme-indicator"></div>';
        }
        
        let colorClass = '';
        
        // Check if in a rhyme group and get color (filled dot)
        const rhymeGroupIndex = rhymeGroups.findIndex(group => group.includes(i));
        if (rhymeGroupIndex !== -1) {
            colorClass = `rhyme-color-${rhymeGroupIndex % 30}`; // Cycle through 30 colors
            return `<div class="rhyme-indicator ${colorClass}"><div class="rhyme-dot"></div></div>`;
        } else {
            // Check if in a near rhyme/assonance group (outlined dot)
            const nearRhymeGroupIndex = nearRhymeGroups.findIndex(group => group.includes(i));
            if (nearRhymeGroupIndex !== -1) {
                colorClass = `rhyme-color-${nearRhymeGroupIndex % 30}`;
                // Use outline style for near rhymes
                return `<div class="rhyme-indicator ${colorClass}"><div class="rhyme-dot near-rhyme"></div></div>`;
            }
        }
        
        return `<div class="rhyme-indicator"></div>`;
    }).join('');
    
    // Sync scroll positions
    lineNumbers.scrollTop = scrollTop;
    syllableCounts.scrollTop = scrollTop;
    rhymeIndicators.scrollTop = scrollTop;
}

// Event listeners
editor.addEventListener('input', updateEditor);
editor.addEventListener('scroll', () => {
    const scrollTop = editor.scrollTop;
    lineNumbers.scrollTop = scrollTop;
    syllableCounts.scrollTop = scrollTop;
    rhymeIndicators.scrollTop = scrollTop;
});

// Initialize
loadSavedContent(); // Load saved content first
updateEditor();

// Button event listeners
document.getElementById('insertBreak').addEventListener('click', () => {
    const cursorPosition = editor.selectionStart;
    const textBefore = editor.value.substring(0, cursorPosition);
    const textAfter = editor.value.substring(cursorPosition);
    
    // Insert break marker at cursor position
    editor.value = textBefore + '\n---\n' + textAfter;
    
    // Move cursor after the inserted break
    const newCursorPosition = cursorPosition + 5; // length of '\n---\n'
    editor.setSelectionRange(newCursorPosition, newCursorPosition);
    editor.focus();
    
    updateEditor();
});

document.getElementById('removeBlankLines').addEventListener('click', () => {
    const lines = editor.value.split('\n');
    const filteredLines = lines.filter(line => line.trim() !== '' || line.trim() === '---');
    editor.value = filteredLines.join('\n');
    updateEditor();
});

document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all content? This cannot be undone.')) {
        editor.value = '';
        localStorage.removeItem(STORAGE_KEY);
        updateEditor();
        editor.focus();
    }
});

document.getElementById('downloadTxt').addEventListener('click', () => {
    const text = editor.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('copyToClipboard').addEventListener('click', async () => {
    const text = editor.value;
    try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('copyToClipboard');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard');
    }
});
