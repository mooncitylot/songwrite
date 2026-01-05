const editor = document.getElementById('editor');
const lineNumbers = document.getElementById('lineNumbers');
const syllableCounts = document.getElementById('syllableCounts');
const rhymeIndicators = document.getElementById('rhymeIndicators');

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

// Check if two words rhyme (perfect rhyme - last 2+ characters match)
function isRhyme(word1, word2) {
    if (!word1 || !word2 || word1 === word2) return false;
    
    const minLength = Math.min(word1.length, word2.length);
    if (minLength < 2) return false;
    
    // Check last 2 characters minimum for rhyme
    // This catches: bug/hug, cat/bat, etc.
    if (minLength >= 2) {
        const end1 = word1.slice(-2);
        const end2 = word2.slice(-2);
        if (end1 === end2) return true;
    }
    
    // Also check last 3 characters for longer words
    if (minLength >= 3) {
        const end1 = word1.slice(-3);
        const end2 = word2.slice(-3);
        if (end1 === end2) return true;
    }
    
    return false;
}

// Check if two words have assonance (similar vowel sounds)
function isAssonance(word1, word2) {
    if (!word1 || !word2 || word1 === word2) return false;
    
    const vowels1 = getVowelSounds(word1);
    const vowels2 = getVowelSounds(word2);
    
    if (vowels1.length < 2 || vowels2.length < 2) return false;
    
    // Check if they share significant vowel patterns but don't rhyme
    const lastVowels1 = vowels1.slice(-2);
    const lastVowels2 = vowels2.slice(-2);
    
    return lastVowels1 === lastVowels2 && !isRhyme(word1, word2);
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
    
    // Get last words for rhyme detection
    const lastWords = lines.map(line => getLastWord(line));
    
    // Build rhyme and assonance groups
    const rhymeGroups = [];
    const assonanceGroups = [];
    
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Check if already in a rhyme group
        let inRhymeGroup = rhymeGroups.some(group => group.includes(i));
        
        if (!inRhymeGroup) {
            const rhymeGroup = [i];
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() && isRhyme(lastWords[i], lastWords[j])) {
                    rhymeGroup.push(j);
                }
            }
            if (rhymeGroup.length > 1) {
                rhymeGroups.push(rhymeGroup);
            }
        }
        
        // Check if already in an assonance group
        let inAssonanceGroup = assonanceGroups.some(group => group.includes(i));
        
        if (!inAssonanceGroup && !inRhymeGroup) {
            const assonanceGroup = [i];
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() && isAssonance(lastWords[i], lastWords[j])) {
                    assonanceGroup.push(j);
                }
            }
            if (assonanceGroup.length > 1) {
                assonanceGroups.push(assonanceGroup);
            }
        }
    }
    
    // Update line numbers
    lineNumbers.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
    
    // Update syllable counts
    syllableCounts.innerHTML = lines.map(line => {
        const count = countLineSyllables(line);
        return `<div class="syllable-count">${line.trim() ? count : ''}</div>`;
    }).join('');
    
    // Update rhyme indicators with colors
    rhymeIndicators.innerHTML = lines.map((line, i) => {
        if (!line.trim()) return '<div class="rhyme-indicator"></div>';
        
        let colorClass = '';
        
        // Check if in a rhyme group and get color
        const rhymeGroupIndex = rhymeGroups.findIndex(group => group.includes(i));
        if (rhymeGroupIndex !== -1) {
            colorClass = `rhyme-color-${rhymeGroupIndex % 30}`; // Cycle through 30 colors
            return `<div class="rhyme-indicator ${colorClass}"><div class="rhyme-dot"></div></div>`;
        } else {
            // Check if in an assonance group
            const assonanceGroupIndex = assonanceGroups.findIndex(group => group.includes(i));
            if (assonanceGroupIndex !== -1) {
                // Assonance gets a grey dot
                return '<div class="rhyme-indicator"><div class="rhyme-dot" style="background-color: #999;"></div></div>';
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
updateEditor();

// Button event listeners
document.getElementById('removeBlankLines').addEventListener('click', () => {
    const lines = editor.value.split('\n');
    const filteredLines = lines.filter(line => line.trim() !== '');
    editor.value = filteredLines.join('\n');
    updateEditor();
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
